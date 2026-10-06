// Phases 9b + 9c: the sync controller. One instance lives in AccountSyncProvider (at the top of the app), so the
// header popover, the Progress card and the Reset / Restore / curriculum controls all share the same state.
//
// The person's journey:
//  1. Sign in (9a). Nothing is sent.
//  2. "Sync now" the first time this device meets this account: if both sides hold data a dialog asks Merge /
//     Use my account's data / Use this device's data, with "download a backup first" ticked; an empty account gets an
//     Upload confirm; an empty device just receives the account's data. THIS CHOICE IS ALWAYS MANUAL.
//  3. From then on (9c) the device is "linked" and syncs by itself, with the same Merge as "Sync now": at app start,
//     when the tab regains focus or the connection returns, and about two seconds after a local change. The person can
//     switch that off ("Sync automatically"); "Sync now" and "Choose how to sync…" keep working either way.
//  4. Days deleted on a linked device are remembered (`noteDeleted`) until a sync tells the account, so they never come back.
// The pure rules are in src/lib/sync.ts (read its header), the one-sync procedure in src/lib/sync-run.ts, the database
// calls in src/lib/firebase.ts. This file only decides WHEN to sync and puts the result on screen.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { downloadBackupFile } from "@/lib/backup-download";
import {
  deleteCloud,
  describeSyncError,
  isOfflineError,
  isSyncConfigured,
  readCloud,
  readCloudStamp,
  writeCloud,
} from "@/lib/firebase";
import { PREFS_CHANGED_EVENT, readDismissedTips, writeDismissedTips } from "@/lib/prefs-storage";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  applyProgress,
  decodeCloud,
  describeSnapshot,
  describeSyncResult,
  deviceKey,
  isEmptySnapshot,
  mergeSnapshots,
  sanitizePrefs,
  snapshotOf,
  stripDays,
  type SyncContext,
  type SyncMode,
  type SyncPlan,
  type SyncPrefs,
  type SyncSnapshot,
} from "@/lib/sync";
import { runSync } from "@/lib/sync-run";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import type { AccountController } from "./useAccount";

/** How long after the last local change an automatic upload waits (PLAN.md, 9c: "about 2 seconds"). */
export const AUTO_DEBOUNCE_MS = 2000;
/** Focus events closer together than this don't start another sync. */
const FOCUS_THROTTLE_MS = 15000;
/** After a failed automatic sync (not offline), try again once this long later. */
const RETRY_AFTER_MS = 60000;

export type SyncNotice = { kind: "success" | "error" | "info"; text: string };

/** What the status line and the header dot show. "off" = not linked yet, or automatic sync is switched off. */
export type SyncStatus = "off" | "idle" | "syncing" | "offline" | "error";

type Counts = { days: number; reviewWords: number };

export type SyncDialogState =
  | {
      kind: "choose";
      device: Counts;
      cloud: Counts;
      /** The account holds nothing: the dialog becomes a plain "Upload?" with no choices. */
      cloudEmpty: boolean;
      /** This device has no lessons: "Use this device's data" would erase the account, so it is not offered. */
      deviceHasLessons: boolean;
    }
  | { kind: "delete" }
  | { kind: "wipe"; device: Counts };

export type SyncController = {
  /** The build has the database address, so sync can run at all. */
  configured: boolean;
  /** This device has synced with the signed-in account before (so it syncs by itself, unless switched off). */
  linked: boolean;
  /** Automatic sync is on (only meaningful when `linked`). */
  auto: boolean;
  setAuto: (on: boolean) => void;
  status: SyncStatus;
  /** The short reason when `status` is "error". */
  statusError: string | null;
  /** The last time this device synced with the signed-in account (ISO), or null. */
  lastSyncedAt: string | null;
  busy: boolean;
  /** The outcome of something the person just pressed. */
  notice: SyncNotice | null;
  /** The outcome of an automatic sync that changed this device ("Added 1 day from your account."). */
  activity: string | null;
  dialog: SyncDialogState | null;
  syncNow: () => Promise<void>;
  chooseHow: () => Promise<void>;
  retry: () => void;
  askDelete: () => void;
  closeDialog: () => void;
  /** Called by the choose dialog. Downloads the backup (if asked) BEFORE anything else, then syncs. */
  runChoice: (mode: SyncMode, backupFirst: boolean) => void;
  confirmDelete: () => void;
  /** Tell the sync that days were deleted on this device (call it right after deleting). No-op if never synced. */
  noteDeleted: (days: number[]) => void;
  /** Signed in with sync available: the person can delete the account copy (Reset offers it). */
  canDeleteCloud: boolean;
  /** Deletes the account copy now (no dialog: the caller has already asked). Never touches this device. */
  deleteCloudData: () => Promise<void>;
  /** Opens the "remove this device's data and sign out" dialog. */
  askWipeSignOut: () => void;
  confirmWipeSignOut: (backupFirst: boolean) => void;
};

// ---- the per-device record --------------------------------------------------------------------

type Link = {
  uid: string;
  lastSyncedAt: string;
  /** Automatic sync on. Records written by 9b have no such field and count as on. */
  auto: boolean;
  /** Days deleted here that the account hasn't been told about yet. */
  pending: number[];
  /** Tombstones already seen or created by this device (see src/lib/sync.ts). */
  seen: Record<string, string>;
  /** The prefs both sides held after the last sync. */
  base: SyncPrefs | null;
};

function readLink(): Link | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sync);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const r = parsed as Record<string, unknown>;
    if (typeof r["uid"] !== "string" || typeof r["lastSyncedAt"] !== "string") return null;
    const seen: Record<string, string> = {};
    if (typeof r["seen"] === "object" && r["seen"] !== null && !Array.isArray(r["seen"])) {
      for (const [k, v] of Object.entries(r["seen"])) if (typeof v === "string") seen[k] = v;
    }
    return {
      uid: r["uid"],
      lastSyncedAt: r["lastSyncedAt"],
      auto: r["auto"] !== false,
      pending: Array.isArray(r["pending"])
        ? r["pending"].filter((d): d is number => Number.isInteger(d) && d > 0)
        : [],
      seen,
      base: "base" in r ? sanitizePrefs(r["base"]) : null,
    };
  } catch {
    return null;
  }
}

function writeLink(link: Link | null): void {
  try {
    if (link) localStorage.setItem(STORAGE_KEYS.sync, JSON.stringify(link));
    else localStorage.removeItem(STORAGE_KEYS.sync);
  } catch {
    /* storage blocked: the next sync simply behaves like a first one */
  }
}

// ---- the hook ---------------------------------------------------------------------------------

export function useSync({
  account,
  lessons,
  progress,
  setLessons,
  setProgress,
  onApplied,
  onClearDevice,
}: {
  account: AccountController;
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: Dispatch<SetStateAction<DayLesson[]>>;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  /** Told the new lessons after a sync replaced them, so the shell can keep `day` pointing at a real day. */
  onApplied: (lessons: DayLesson[]) => void;
  /** Empties this device's lessons and progress (the same as Reset), used by "sign out and remove my data". */
  onClearDevice: () => void;
}): SyncController {
  const configured = isSyncConfigured();
  const uid = account.auth.status === "in" ? account.auth.account.uid : null;

  const [link, setLinkState] = useState<Link | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [dialog, setDialog] = useState<SyncDialogState | null>(null);
  const [lastError, setLastError] = useState<{ text: string } | null>(null);
  const [online, setOnline] = useState(true);
  const [prefsTick, setPrefsTick] = useState(0);
  const [, setMinuteTick] = useState(0);

  // The handlers run after awaits, so they read the newest values through refs instead of the render they were made in.
  const latest = useRef({ lessons, progress });
  const uidRef = useRef<string | null>(uid);
  const linkRef = useRef<Link | null>(null);
  const busyCount = useRef(0);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const rerun = useRef(false);
  const lastKey = useRef<string | null>(null);
  const startedFor = useRef<string | null>(null);
  const lastRunEnd = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onApplied, onClearDevice, setLessons, setProgress, account });
  useEffect(() => {
    latest.current = { lessons, progress };
    uidRef.current = uid;
    callbacks.current = { onApplied, onClearDevice, setLessons, setProgress, account };
  });

  const setLink = useCallback((next: Link | null) => {
    linkRef.current = next;
    writeLink(next);
    setLinkState(next);
  }, []);

  useEffect(() => {
    const stored = readLink();
    linkRef.current = stored;
    setLinkState(stored);
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  }, []);

  // Signing out (or switching account) clears anything on screen that belonged to the old session.
  const prevUid = useRef(uid);
  useEffect(() => {
    if (prevUid.current !== null && uid === null) {
      setNotice(null);
      setActivity(null);
      setDialog(null);
      setLastError(null);
    }
    prevUid.current = uid;
  }, [uid]);

  // The "Synced · 2 min ago" text needs a nudge now and then.
  useEffect(() => {
    const timer = setInterval(() => setMinuteTick((n) => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const deviceSnapshot = useCallback(
    (): SyncSnapshot =>
      snapshotOf(latest.current.lessons, latest.current.progress, readDismissedTips()),
    [],
  );

  const isLinkedTo = (forUid: string | null) =>
    forUid !== null && linkRef.current !== null && linkRef.current.uid === forUid;
  const autoEligible = () =>
    configured && isLinkedTo(uidRef.current) && linkRef.current?.auto !== false;

  // ---- running jobs one at a time --------------------------------------------------------------
  // Manual jobs wait their turn (a Reset that deletes the account copy must not be dropped because an automatic
  // sync happened to be running). Automatic requests that arrive while busy are folded into one rerun.
  const run = useCallback(
    (job: () => Promise<void>, { manual = true }: { manual?: boolean } = {}): Promise<void> => {
      if (!manual && busyCount.current > 0) {
        rerun.current = true;
        return Promise.resolve();
      }
      busyCount.current++;
      setBusy(true);
      const start = async () => {
        if (manual) setNotice(null);
        try {
          await job();
        } catch (e) {
          console.error("[Kiroku] sync failed", e);
          const text = describeSyncError(e);
          setLastError({ text });
          if (manual) setNotice({ kind: "error", text });
          else if (!isOfflineError(e)) {
            if (retryTimer.current) clearTimeout(retryTimer.current);
            retryTimer.current = setTimeout(() => requestAutoRef.current(), RETRY_AFTER_MS);
          }
        } finally {
          busyCount.current--;
          lastRunEnd.current = Date.now();
          if (busyCount.current === 0) {
            setBusy(false);
            if (rerun.current) {
              rerun.current = false;
              requestAutoRef.current();
            }
          }
        }
      };
      const next = chain.current.then(start);
      chain.current = next;
      return next;
    },
    [],
  );

  // ---- one sync ---------------------------------------------------------------------------------

  /**
   * Runs one sync and puts the result on this device. Returns true when it worked. A refusal (damaged account copy,
   * "use this device" on an empty device, the account changing under us) is reported and returns false; a network
   * or database error throws to `run`.
   */
  const syncOnce = async (forUid: string, mode: SyncMode, manual: boolean): Promise<boolean> => {
    const before = linkRef.current;
    const linked = before !== null && before.uid === forUid;
    const ctx: SyncContext = {
      linked,
      pendingDeletes: linked && before ? before.pending : [],
      seenTombstones: linked && before ? before.seen : {},
      basePrefs: linked && before ? before.base : null,
      now: new Date(),
    };
    const result = await runSync(
      {
        read: () => readCloud(forUid),
        readStamp: () => readCloudStamp(forUid),
        write: (tree) => writeCloud(forUid, tree),
      },
      mode,
      deviceSnapshot,
      ctx,
    );
    if (!result.ok) {
      setLastError({ text: result.message });
      if (manual) setNotice({ kind: "error", text: result.message });
      return false;
    }
    const { plan } = result;

    // Put the result on this device. For a Merge it is merged once more with what the device holds NOW (the person
    // may have kept working during the sync) and days deleted meanwhile or deleted on another device are kept off.
    let finalSnap: SyncSnapshot = plan.result;
    if (plan.replaceDevice) {
      if (mode === "merge") {
        const gone = [...plan.removedDays, ...(linkRef.current?.pending ?? [])];
        finalSnap = {
          ...stripDays(mergeSnapshots(deviceSnapshot(), plan.result), gone),
          prefs: plan.result.prefs,
          tombstones: plan.result.tombstones,
        };
      }
      callbacks.current.setLessons(finalSnap.lessons);
      callbacks.current.setProgress((p) => applyProgress(finalSnap, p));
      if (finalSnap.prefs.tips) writeDismissedTips(finalSnap.prefs.tips);
      callbacks.current.onApplied(finalSnap.lessons);
    }

    const now = linkRef.current;
    const included = new Set(ctx.pendingDeletes);
    setLink({
      uid: forUid,
      lastSyncedAt: new Date().toISOString(),
      auto: now !== null && now.uid === forUid ? now.auto : true,
      pending:
        now !== null && now.uid === forUid ? now.pending.filter((d) => !included.has(d)) : [],
      seen: plan.nextSeen,
      base: plan.nextBasePrefs,
    });
    startedFor.current = forUid;
    lastKey.current = deviceKey(plan.replaceDevice ? finalSnap : result.device);
    setLastError(null);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    reportResult(plan, manual);
    return true;
  };

  const reportResult = (plan: Extract<SyncPlan, { ok: true }>, manual: boolean) => {
    if (manual) {
      setActivity(null);
      setNotice({ kind: "success", text: describeSyncResult(plan) });
    } else if (plan.replaceDevice) {
      setActivity(describeSyncResult(plan));
    }
  };

  // ---- automatic triggers -----------------------------------------------------------------------

  const requestAuto = useCallback(() => {
    if (!autoEligible()) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return; // "online" brings it back
    const forUid = uidRef.current;
    if (forUid === null) return;
    void run(async () => void (await syncOnce(forUid, "merge", false)), { manual: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const requestAutoRef = useRef(requestAuto);
  useEffect(() => {
    requestAutoRef.current = requestAuto;
  });

  // App start / sign-in: one sync per page load per account, once the sign-in state is known.
  const linkedUid = link?.uid ?? null;
  const autoOn = link?.auto !== false;
  useEffect(() => {
    if (!configured || uid === null || linkedUid !== uid || !autoOn) return;
    if (startedFor.current === uid) return;
    startedFor.current = uid;
    requestAutoRef.current();
  }, [configured, uid, linkedUid, autoOn]);

  // The tab comes back to the front, or the connection returns.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastRunEnd.current < FOCUS_THROTTLE_MS) return;
      requestAutoRef.current();
    };
    const onOnline = () => {
      setOnline(true);
      requestAutoRef.current();
    };
    const onOffline = () => setOnline(false);
    const onPrefs = () => setPrefsTick((n) => n + 1);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(PREFS_CHANGED_EVENT, onPrefs);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(PREFS_CHANGED_EVENT, onPrefs);
    };
  }, []);

  // A local change: wait for the person to pause, then sync if anything that syncs really differs from the last sync.
  useEffect(() => {
    if (!configured || uid === null || linkedUid !== uid || !autoOn) return;
    const timer = setTimeout(() => {
      const unsent = (linkRef.current?.pending.length ?? 0) > 0;
      if (!unsent && lastKey.current !== null && deviceKey(deviceSnapshot()) === lastKey.current)
        return;
      requestAutoRef.current();
    }, AUTO_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [configured, uid, linkedUid, autoOn, lessons, progress, prefsTick, deviceSnapshot]);

  useEffect(
    () => () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
    },
    [],
  );

  // ---- what the buttons do ----------------------------------------------------------------------

  const counts = (s: SyncSnapshot): Counts => describeSnapshot(s);

  const loadCloudSnapshot = async (forUid: string): Promise<SyncSnapshot | null> => {
    const decoded = decodeCloud(await readCloud(forUid));
    if (!decoded.ok) {
      setLastError({ text: decoded.message });
      setNotice({ kind: "error", text: decoded.message });
      return null;
    }
    return decoded.snapshot;
  };

  const openChoose = (cloud: SyncSnapshot, device: SyncSnapshot) =>
    setDialog({
      kind: "choose",
      device: counts(device),
      cloud: counts(cloud),
      cloudEmpty: isEmptySnapshot(cloud),
      deviceHasLessons: device.lessons.length > 0,
    });

  const syncNow = () =>
    run(async () => {
      if (!uid) return;
      if (!isLinkedTo(uid)) {
        // First time this device meets this account: always the manual choice, never automatic.
        const cloud = await loadCloudSnapshot(uid);
        if (!cloud) return;
        const device = deviceSnapshot();
        const deviceEmpty = isEmptySnapshot(device);
        const cloudEmpty = isEmptySnapshot(cloud);
        if (deviceEmpty && cloudEmpty) {
          setLink({
            uid,
            lastSyncedAt: new Date().toISOString(),
            auto: true,
            pending: [],
            seen: {},
            base: null,
          });
          startedFor.current = uid;
          setNotice({
            kind: "info",
            text: "Nothing to sync yet. Add a lesson and it will sync by itself.",
          });
          return;
        }
        if (!deviceEmpty) {
          openChoose(cloud, device); // both have data → choose; account empty → upload
          return;
        }
        // An empty device just receives the account's data (that cannot lose anything).
      }
      await syncOnce(uid, "merge", true);
    });

  const chooseHow = () =>
    run(async () => {
      if (!uid) return;
      const cloud = await loadCloudSnapshot(uid);
      if (!cloud) return;
      const device = deviceSnapshot();
      if (isEmptySnapshot(device) && isEmptySnapshot(cloud)) {
        setNotice({
          kind: "info",
          text: "Nothing to sync yet. Add a lesson, then press Sync now.",
        });
        return;
      }
      openChoose(cloud, device);
    });

  const runChoice = (mode: SyncMode, backupFirst: boolean) => {
    if (!uid) return;
    // The download happens right here, inside the click, before any waiting, so the browser allows it.
    if (backupFirst) {
      const { lessons: l, progress: p } = latest.current;
      downloadBackupFile(l, p, "kiroku-backup-before-sync.json");
    }
    setDialog(null);
    void run(async () => void (await syncOnce(uid, mode, true)));
  };

  const deleteCloudData = () =>
    run(async () => {
      if (!uid) return;
      await deleteCloud(uid);
      setLink(null);
      lastKey.current = null;
      startedFor.current = null;
      setActivity(null);
      setLastError(null);
      setNotice({
        kind: "success",
        text: "Your cloud data is deleted. Lessons and progress on this device are untouched.",
      });
    });

  const confirmDelete = () => {
    setDialog(null);
    void deleteCloudData();
  };

  const confirmWipeSignOut = (backupFirst: boolean) => {
    if (backupFirst) {
      const { lessons: l, progress: p } = latest.current;
      downloadBackupFile(l, p, "kiroku-backup-before-sign-out.json");
    }
    setDialog(null);
    void run(async () => {
      try {
        // Save the latest changes to the account first; if that fails nothing is removed.
        if (uid && isLinkedTo(uid)) {
          const ok = await syncOnce(uid, "merge", true);
          if (!ok) throw new Error("sync refused");
        }
      } catch (e) {
        const reason =
          e instanceof Error && e.message === "sync refused" ? "" : ` ${describeSyncError(e)}`;
        setNotice({
          kind: "error",
          text: `Couldn't save your latest changes to your account first, so nothing was removed and you are still signed in.${reason}`,
        });
        return;
      }
      callbacks.current.onClearDevice();
      setLink(null);
      lastKey.current = null;
      startedFor.current = null;
      await callbacks.current.account.signOut();
    });
  };

  const setAuto = (on: boolean) => {
    const current = linkRef.current;
    if (!current) return;
    setLink({ ...current, auto: on });
    setActivity(null);
    if (on) requestAutoRef.current();
  };

  const noteDeleted = (days: number[]) => {
    const current = linkRef.current;
    if (!current || days.length === 0) return;
    setLink({
      ...current,
      pending: [...new Set([...current.pending, ...days])].sort((a, b) => a - b),
    });
  };

  // ---- what to show -----------------------------------------------------------------------------

  const linked = uid !== null && link !== null && link.uid === uid;
  const auto = linked && link.auto;
  let status: SyncStatus = "off";
  if (auto) {
    if (busy) status = "syncing";
    else if (!online) status = "offline";
    else if (lastError) status = "error";
    else status = "idle";
  }

  return {
    configured,
    linked,
    auto,
    setAuto,
    status,
    statusError: status === "error" ? (lastError?.text ?? null) : null,
    lastSyncedAt: linked ? link.lastSyncedAt : null,
    busy,
    notice,
    activity,
    dialog,
    syncNow,
    chooseHow,
    retry: () => {
      setLastError(null);
      requestAutoRef.current();
    },
    askDelete: () => {
      setNotice(null);
      setDialog({ kind: "delete" });
    },
    closeDialog: () => setDialog(null),
    runChoice,
    confirmDelete,
    noteDeleted,
    canDeleteCloud: configured && uid !== null,
    deleteCloudData,
    askWipeSignOut: () => {
      setNotice(null);
      setDialog({ kind: "wipe", device: counts(deviceSnapshot()) });
    },
    confirmWipeSignOut,
  };
}
