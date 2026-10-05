// Phase 9b: the manual-sync controller. One instance lives in AccountSyncProvider (at the top of the app), so the
// header popover and the Progress card show the same state and share the same dialogs.
//
// Flow, in the order the person meets it:
//  1. Sign in (9a). Nothing is sent.
//  2. "Sync now" the first time on this device for this account: if both sides hold data a dialog asks Merge /
//     Use my account's data / Use this device's data, with "download a backup first" ticked; if the account is
//     empty it offers an upload; if the device is empty it just brings the account's data here.
//  3. Every "Sync now" after that is a plain Merge (no dialog). "Choose how to sync…" reopens the dialog.
//  4. "Delete my cloud data" asks first, then empties the account. This device is never touched.
// The pure rules (what merges, what is refused) are in src/lib/sync.ts; the database calls are in src/lib/firebase.ts.
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
  isSyncConfigured,
  readCloud,
  writeCloud,
} from "@/lib/firebase";
import { STORAGE_KEYS } from "@/lib/storage";
import {
  applyProgress,
  decodeCloud,
  describeSnapshot,
  describeSyncResult,
  encodeSnapshot,
  isEmptySnapshot,
  planSync,
  snapshotOf,
  type SyncMode,
  type SyncSnapshot,
} from "@/lib/sync";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import type { AccountController } from "./useAccount";

export type SyncNotice = { kind: "success" | "error" | "info"; text: string };

export type SyncDialogState =
  | {
      kind: "choose";
      device: { days: number; reviewWords: number };
      cloud: { days: number; reviewWords: number };
      /** The account holds nothing: the dialog becomes a plain "Upload?" with no choices. */
      cloudEmpty: boolean;
      /** This device has no lessons: "Use this device's data" would erase the account, so it is not offered. */
      deviceHasLessons: boolean;
    }
  | { kind: "delete" };

export type SyncController = {
  /** The build has the database address, so sync can run at all. */
  configured: boolean;
  /** The last time this device synced with the signed-in account (ISO), or null. */
  lastSyncedAt: string | null;
  busy: boolean;
  notice: SyncNotice | null;
  dialog: SyncDialogState | null;
  syncNow: () => Promise<void>;
  chooseHow: () => Promise<void>;
  askDelete: () => void;
  closeDialog: () => void;
  /** Called by the choose dialog. Downloads the backup (if asked) BEFORE anything else, then syncs. */
  runChoice: (mode: SyncMode, backupFirst: boolean) => void;
  confirmDelete: () => void;
};

type Link = { uid: string; lastSyncedAt: string };

function readLink(): Link | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sync);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { uid, lastSyncedAt } = parsed as Record<string, unknown>;
    return typeof uid === "string" && typeof lastSyncedAt === "string"
      ? { uid, lastSyncedAt }
      : null;
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

export function useSync({
  account,
  lessons,
  progress,
  setLessons,
  setProgress,
  onApplied,
}: {
  account: AccountController;
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: Dispatch<SetStateAction<DayLesson[]>>;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  /** Told the new lessons after a sync replaced them, so the shell can keep `day` pointing at a real day. */
  onApplied: (lessons: DayLesson[]) => void;
}): SyncController {
  const configured = isSyncConfigured();
  const uid = account.auth.status === "in" ? account.auth.account.uid : null;

  const [link, setLink] = useState<Link | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SyncNotice | null>(null);
  const [dialog, setDialog] = useState<SyncDialogState | null>(null);

  // The handlers run after awaits, so they read the newest lessons/progress through a ref instead of the render they were made in.
  const latest = useRef({ lessons, progress });
  const busyRef = useRef(false);
  useEffect(() => {
    latest.current = { lessons, progress };
  });
  useEffect(() => {
    setLink(readLink());
  }, []);

  // Signing out (or switching account) clears anything on screen that belonged to the old session.
  useEffect(() => {
    if (uid === null) {
      setNotice(null);
      setDialog(null);
    }
  }, [uid]);

  const remember = useCallback((forUid: string) => {
    const next = { uid: forUid, lastSyncedAt: new Date().toISOString() };
    writeLink(next);
    setLink(next);
  }, []);

  const run = useCallback(async (job: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await job();
    } catch (e) {
      console.error("[Kiroku] sync failed", e);
      setNotice({ kind: "error", text: describeSyncError(e) });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const deviceSnapshot = (): SyncSnapshot =>
    snapshotOf(latest.current.lessons, latest.current.progress);

  /** Reads the account's copy. A damaged or too-new copy becomes a message and stops the sync. */
  const loadCloud = async (forUid: string): Promise<SyncSnapshot | null> => {
    const decoded = decodeCloud(await readCloud(forUid));
    if (!decoded.ok) {
      setNotice({ kind: "error", text: decoded.message });
      return null;
    }
    return decoded.snapshot;
  };

  const execute = async (forUid: string, mode: SyncMode) => {
    const cloud = await loadCloud(forUid);
    if (!cloud) return;
    const plan = planSync(mode, deviceSnapshot(), cloud);
    if (!plan.ok) {
      setNotice({ kind: "error", text: plan.message });
      return;
    }
    // Account first: if the write fails nothing on this device has changed and the sync isn't recorded.
    if (plan.writeCloud) await writeCloud(forUid, encodeSnapshot(plan.result));
    if (plan.replaceDevice) {
      setLessons(plan.result.lessons);
      setProgress((p) => applyProgress(plan.result, p));
      onApplied(plan.result.lessons);
    }
    remember(forUid);
    setNotice({ kind: "success", text: describeSyncResult(plan) });
  };

  const openChoose = (cloud: SyncSnapshot, device: SyncSnapshot) =>
    setDialog({
      kind: "choose",
      device: describeSnapshot(device),
      cloud: describeSnapshot(cloud),
      cloudEmpty: isEmptySnapshot(cloud),
      deviceHasLessons: device.lessons.length > 0,
    });

  const syncNow = () =>
    run(async () => {
      if (!uid) return;
      const cloud = await loadCloud(uid);
      if (!cloud) return;
      const device = deviceSnapshot();
      if (link?.uid !== uid) {
        // First time this device meets this account.
        const deviceEmpty = isEmptySnapshot(device);
        const cloudEmpty = isEmptySnapshot(cloud);
        if (deviceEmpty && cloudEmpty) {
          remember(uid);
          setNotice({
            kind: "info",
            text: "Nothing to sync yet. Add a lesson, then press Sync now.",
          });
          return;
        }
        if (!deviceEmpty) {
          openChoose(cloud, device); // both have data → choose; account empty → upload
          return;
        }
        // An empty device just receives the account's data (that cannot lose anything).
      }
      await execute(uid, "merge");
    });

  const chooseHow = () =>
    run(async () => {
      if (!uid) return;
      const cloud = await loadCloud(uid);
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
    void run(() => execute(uid, mode));
  };

  const confirmDelete = () => {
    if (!uid) return;
    setDialog(null);
    void run(async () => {
      await deleteCloud(uid);
      writeLink(null);
      setLink(null);
      setNotice({
        kind: "success",
        text: "Your cloud data is deleted. Lessons and progress on this device are untouched.",
      });
    });
  };

  return {
    configured,
    lastSyncedAt: uid !== null && link?.uid === uid ? link.lastSyncedAt : null,
    busy,
    notice,
    dialog,
    syncNow,
    chooseHow,
    askDelete: () => {
      setNotice(null);
      setDialog({ kind: "delete" });
    },
    closeDialog: () => setDialog(null),
    runChoice,
    confirmDelete,
  };
}
