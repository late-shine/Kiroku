import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Account } from "@/lib/firebase";
import {
  FRIENDS_REFRESH_MS,
  decodeFriendsCache,
  decodeFriendsLocal,
  normalizeFriendCode,
  publicGlyph,
  publicName,
  buildFriendPublication,
  friendCardSource,
  type FriendSettings,
  type FriendPublication,
  type FriendCardState,
  type FriendPhoto,
  type FriendsCache,
  type FriendsSnapshot,
  type PublicIdentity,
} from "@/lib/friends";
import {
  acceptFriend,
  FriendsError,
  clearFriendsStorage,
  describeFriendsError,
  fetchFriends,
  friendsActivity,
  isFriendsDenied,
  removeFriend,
  requestFriend,
  rotateFriendCode,
  setFriendsAccount,
  setupFriends,
  subscribeFriends,
  unblockFriend,
  readFriendSharing,
  saveFriendSharing,
  publishFriendCard,
  readFriendPhoto,
  type SharingRead,
  type SharingEdit,
} from "@/lib/friends-db";
import { useProfile } from "@/components/profile/useProfile";
import { STORAGE_KEYS } from "@/lib/storage";
import { PREFS_CHANGED_EVENT, readProfile } from "@/lib/prefs-storage";
import { localDay } from "@/lib/word-memory";
import type { QuestPrefs } from "@/lib/quest-prefs";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export type FriendsStudyInput = {
  lessons: readonly DayLesson[];
  progress: UserProgressState;
  prefs: QuestPrefs;
  hydrated: boolean;
  syncBusy: boolean;
  syncLinked: boolean;
  syncStamp: string | null;
};
type SharingView = SharingRead & { uid: string | null; loaded: boolean; error: string | null };
const emptySharing = (uid: string | null): SharingView => ({
  uid,
  loaded: false,
  settings: null,
  card: { kind: "closed", cached: false, fetchedAt: 0 },
  error: null,
});

function readLocal(uid: string) {
  try {
    return decodeFriendsLocal(localStorage.getItem(STORAGE_KEYS.friends), uid);
  } catch {
    return null;
  }
}
function patchLocal(uid: string, patch: Partial<NonNullable<ReturnType<typeof readLocal>>>) {
  try {
    localStorage.setItem(
      STORAGE_KEYS.friends,
      JSON.stringify({ ...readLocal(uid), ...patch, v: 1, uid }),
    );
  } catch {
    /* Optional device metadata. */
  }
}

type View = {
  uid: string | null;
  snapshot: FriendsSnapshot | null;
  error: string | null;
  notice: string | null;
  loading: boolean;
  publicName: string | null;
};
const emptyView = (uid: string | null): View => ({
  uid,
  snapshot: null,
  error: null,
  notice: null,
  loading: false,
  publicName: null,
});

function readLocalName(uid: string): string | null {
  try {
    return decodeFriendsLocal(localStorage.getItem(STORAGE_KEYS.friends), uid)?.publicName ?? null;
  } catch {
    return null;
  }
}

function readCache(uid: string): FriendsSnapshot | null {
  try {
    const cache = decodeFriendsCache(localStorage.getItem(STORAGE_KEYS.friendsCache), uid);
    // Codes, inbox consent proofs and blocked UIDs never come from this display cache.
    return cache
      ? {
          own: null,
          peers: cache.links,
          blocks: [],
          fetchedAt: cache.fetchedAt,
          cached: true,
          cards: cache.cards ?? {},
        }
      : null;
  } catch {
    return null;
  }
}

function saveCache(uid: string, snapshot: FriendsSnapshot, covers: FriendsCache["links"]): void {
  const cache: FriendsCache = {
    v: 1,
    uid,
    links: [...snapshot.peers, ...covers],
    fetchedAt: snapshot.fetchedAt,
    cards: Object.fromEntries(
      Object.entries(snapshot.cards ?? {}).filter(([, card]) => card.kind === "published"),
    ),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.friendsCache, JSON.stringify(cache));
  } catch {
    /* A cache is optional. */
  }
}

/** One controller, owned by FriendsProvider above all shell modes. */
export function useFriendsController({
  account,
  resolved,
  configured,
  onOpenProfile,
  study,
}: {
  account: Account | null;
  resolved: boolean;
  configured: boolean;
  onOpenProfile: () => void;
  study: FriendsStudyInput;
}) {
  const uid = configured ? (account?.uid ?? null) : null;
  const { profile } = useProfile();
  const [view, setView] = useState<View>(() => emptyView(null));
  const [activity, setActivity] = useState(() => friendsActivity(null));
  const [invite, setInvite] = useState<string | null>(null);
  const [sharing, setSharing] = useState<SharingView>(() => emptySharing(null));
  const sharingRef = useRef(sharing);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ peer: string; photo: FriendPhoto } | null>(
    null,
  );
  const [day, setDay] = useState<string | null>(null);
  const [sourceTick, setSourceTick] = useState(0);
  const latestStudy = useRef(study);
  latestStudy.current = study;
  const cosmeticPending = useRef(false);
  const cosmeticSaveRef = useRef<() => void>(() => {});
  const previousLook = useRef<string | null>(null);
  const sourceUid = useRef<string | null>(null);
  const sessionStartedAt = useRef(0);
  const cardCache = useRef<Record<string, FriendCardState>>({});
  const publishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishGeneration = useRef(0);
  const publishing = useRef(false);
  const queuedAgeCheck = useRef(false);
  const quietUntil = useRef(0);
  const photoSequence = useRef(0);
  const lastPublished = useRef(0);
  const sharingSequence = useRef(0);
  const refreshSharingRef = useRef<() => Promise<void>>(async () => {});
  const schedulePublishRef = useRef<(ageCheck?: boolean) => void>(() => {});
  const cancelPublish = useCallback(() => {
    if (publishTimer.current) clearTimeout(publishTimer.current);
    publishTimer.current = null;
    queuedAgeCheck.current = false;
    ++publishGeneration.current;
  }, []);
  const current = useRef<{ uid: string; generation: number } | null>(null);
  const generation = useRef(0);
  const readSequence = useRef(0);
  const refreshing = useRef(false);
  const lastRefresh = useRef(0);
  const isSetUp = useRef(false);
  const closedCovers = useRef(new Map<string, FriendsCache["links"][number]>());
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const openProfileRef = useRef(onOpenProfile);
  openProfileRef.current = onOpenProfile;

  const refresh = useCallback(async () => {
    const captured = current.current;
    if (
      !uid ||
      captured?.uid !== uid ||
      refreshing.current ||
      document.visibilityState === "hidden" ||
      friendsActivity(uid).busy
    ) {
      return;
    }
    const sequence = ++readSequence.current;
    refreshing.current = true;
    setView((value) => ({ ...value, loading: true }));
    try {
      const snapshot = await fetchFriends(uid, cardCache.current);
      if (current.current !== captured || sequence !== readSequence.current) return;
      lastRefresh.current = Date.now();
      isSetUp.current = Boolean(snapshot.own && !snapshot.own.deleting);
      cardCache.current = snapshot.cards ?? {};
      ++photoSequence.current;
      setSelectedPhoto(null);
      if (snapshot.own?.deleting) {
        clearFriendsStorage(uid);
      } else if (snapshot.own) {
        for (const peer of snapshot.peers) closedCovers.current.set(peer.uid, peer);
        const covers = snapshot.blocks
          .map((peer) => closedCovers.current.get(peer))
          .filter((peer) => peer !== undefined);
        saveCache(
          uid,
          snapshot,
          covers.map((peer) => ({ ...peer, state: "unavailable" })),
        );
      } else {
        cancelPublish();
        sourceUid.current = null;
        cosmeticPending.current = false;
        sharingRef.current = emptySharing(uid);
        setSharing(sharingRef.current);
        ++sharingSequence.current;
        clearFriendsStorage(uid);
      }
      setView((value) => ({ ...value, uid, snapshot, loading: false, error: null }));
      if (snapshot.own && !snapshot.own.deleting) {
        await refreshSharingRef.current();
        if (current.current === captured) schedulePublishRef.current(true);
      }
    } catch (error) {
      if (current.current !== captured || sequence !== readSequence.current) return;
      if (isFriendsDenied(error)) {
        cancelPublish();
        isSetUp.current = false;
        sharingRef.current = {
          ...sharingRef.current,
          loaded: false,
          error: describeFriendsError(error),
        };
        setSharing(sharingRef.current);
        cardCache.current = {};
        setSelectedPhoto(null);
        try {
          localStorage.removeItem(STORAGE_KEYS.friendsCache);
        } catch {
          /* Optional. */
        }
      }
      setView((value) => {
        const previous = value.uid === uid ? value.snapshot : null;
        const cached = isFriendsDenied(error) ? null : (previous ?? readCache(uid));
        return {
          ...value,
          uid,
          loading: false,
          error: describeFriendsError(error),
          snapshot: cached ? { ...cached, cached: true } : null,
        };
      });
    } finally {
      if (current.current === captured && sequence === readSequence.current)
        refreshing.current = false;
    }
  }, [uid, cancelPublish]);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!resolved) return;
    setFriendsAccount(uid);
    const captured = uid ? { uid, generation: ++generation.current } : null;
    current.current = captured;
    sessionStartedAt.current = Date.now();
    quietUntil.current = 0;
    ++photoSequence.current;
    cosmeticPending.current = false;
    previousLook.current = null;
    publishing.current = false;
    cancelPublish();
    sourceUid.current = uid && readLocal(uid)?.publishSourceUid === uid ? uid : null;
    lastPublished.current = uid ? (readLocal(uid)?.publishedAt ?? 0) : 0;
    cardCache.current = uid ? (readCache(uid)?.cards ?? {}) : {};
    sharingRef.current = emptySharing(uid);
    setSharing(sharingRef.current);
    ++sharingSequence.current;
    setSelectedPeer(null);
    setSelectedPhoto(null);
    setDay(localDay());
    lastRefresh.current = 0;
    isSetUp.current = false;
    closedCovers.current.clear();
    if (uid) {
      for (const peer of readCache(uid)?.peers ?? []) closedCovers.current.set(peer.uid, peer);
    }
    refreshing.current = false;
    setView({ ...emptyView(uid), publicName: uid ? readLocalName(uid) : null });
    setActivity(friendsActivity(uid));
    if (!uid) setInvite(null);
    let deletionWasActive = friendsActivity(uid).deleting;
    let lastOutcome: string | null = null;
    const stop = subscribeFriends(() => {
      if (current.current !== captured) return;
      const next = friendsActivity(uid);
      setActivity(next);
      if (next.busy) lastOutcome = null;
      if (next.deleting) {
        cancelPublish();
        sourceUid.current = null;
        cosmeticPending.current = false;
        cardCache.current = {};
        ++photoSequence.current;
        sharingRef.current = emptySharing(uid);
        setSharing(sharingRef.current);
        ++sharingSequence.current;
        setSelectedPeer(null);
        setSelectedPhoto(null);
        deletionWasActive = true;
        ++readSequence.current;
        refreshing.current = false;
        closedCovers.current.clear();
        setView((value) => ({
          ...value,
          snapshot: null,
          loading: false,
          publicName: null,
          notice: null,
        }));
      }
      if (!next.busy && !next.deleting && deletionWasActive) {
        deletionWasActive = false;
        void refreshRef.current();
      }
      if (!next.busy && next.outcome && next.outcome !== lastOutcome && uid) {
        lastOutcome = next.outcome;
        void refreshRef.current();
      }
    });
    if (uid) void refreshRef.current();
    return () => {
      stop();
      current.current = null;
      cancelPublish();
      ++sharingSequence.current;
      ++readSequence.current;
      setFriendsAccount(null);
    };
  }, [uid, resolved, cancelPublish]);

  useEffect(() => {
    if (!uid) return;
    const onFocus = () => {
      if (
        document.visibilityState !== "hidden" &&
        isSetUp.current &&
        !friendsActivity(uid).deleting &&
        !friendsActivity(uid).busy
      ) {
        setDay(localDay());
        void refreshSharingRef.current().then(() => schedulePublishRef.current(true));
      }
      if (
        document.visibilityState === "hidden" ||
        refreshing.current ||
        !isSetUp.current ||
        friendsActivity(uid).busy ||
        friendsActivity(uid).deleting ||
        Date.now() - lastRefresh.current < FRIENDS_REFRESH_MS
      ) {
        return;
      }
      void refreshRef.current();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [uid]);

  // Capture before redirect, consume once signed in and the add UI can receive it.
  useEffect(() => {
    const capture = () => {
      const raw = new URLSearchParams(window.location.hash.slice(1)).get("friend");
      const code = raw ? normalizeFriendCode(raw) : null;
      if (code) {
        try {
          sessionStorage.setItem(STORAGE_KEYS.friendInvite, code);
        } catch {
          /* Hash still holds it. */
        }
      }
      let stored: string | null = null;
      try {
        stored = sessionStorage.getItem(STORAGE_KEYS.friendInvite);
      } catch {
        /* Optional. */
      }
      const pending = code ?? (stored ? normalizeFriendCode(stored) : null);
      if (pending) {
        openProfileRef.current();
        if (resolved && uid) {
          setInvite(pending);
          try {
            sessionStorage.removeItem(STORAGE_KEYS.friendInvite);
          } catch {
            /* Optional. */
          }
          const hash = new URLSearchParams(window.location.hash.slice(1));
          hash.delete("friend");
          const rest = hash.toString();
          history.replaceState(
            history.state,
            "",
            `${location.pathname}${location.search}${rest ? `#${rest}` : ""}`,
          );
        }
      }
    };
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, [uid, resolved]);

  const getSource = useCallback(
    (explicit = false, allowCosmetic = false) => {
      if (
        !uid ||
        current.current?.uid !== uid ||
        friendsActivity(uid).deleting ||
        document.visibilityState === "hidden"
      )
        return null;
      const input = latestStudy.current;
      if (
        !input.hydrated ||
        input.syncBusy ||
        (!explicit && sourceUid.current !== uid) ||
        (!explicit && !allowCosmetic && cosmeticPending.current)
      )
        return null;
      return friendCardSource(
        input.lessons,
        input.progress,
        readProfile(),
        input.prefs,
        localDay(),
      );
    },
    [uid],
  );

  const applySharing = (value: SharingRead) => {
    if (!uid || current.current?.uid !== uid || friendsActivity(uid).deleting) return;
    ++sharingSequence.current;
    sharingRef.current = { ...value, uid, loaded: true, error: null };
    setSharing(sharingRef.current);
  };

  const refreshSharing = async () => {
    const captured = current.current;
    if (!uid || captured?.uid !== uid || friendsActivity(uid).busy || friendsActivity(uid).deleting)
      return;
    const sequence = ++sharingSequence.current;
    try {
      const value = await readFriendSharing(uid);
      if (current.current !== captured || sequence !== sharingSequence.current) return;
      applySharing(value);
    } catch (error) {
      if (current.current !== captured || sequence !== sharingSequence.current) return;
      sharingRef.current = {
        ...sharingRef.current,
        loaded: false,
        error: describeFriendsError(error),
      };
      setSharing(sharingRef.current);
    }
  };
  refreshSharingRef.current = refreshSharing;

  const acknowledge = (
    captured: NonNullable<typeof current.current>,
    settings: FriendSettings,
    publication: FriendPublication | null,
    associate = false,
  ) => {
    if (current.current !== captured || friendsActivity(captured.uid).deleting) return;
    cosmeticPending.current = false;
    if (associate) sourceUid.current = captured.uid;
    if (publication) lastPublished.current = Date.now();
    patchLocal(captured.uid, {
      publicName: settings.n,
      ...(sourceUid.current === captured.uid ? { publishSourceUid: captured.uid } : {}),
      ...(publication ? { publishedAt: lastPublished.current, fp: publication.fp } : {}),
    });
    applySharing({
      settings,
      card: publication
        ? {
            kind: "published",
            card: { ...publication.card, t: null },
            cached: false,
            fetchedAt: Date.now(),
          }
        : { kind: "closed", cached: false, fetchedAt: Date.now() },
    });
    setSourceTick((value) => value + 1);
  };

  const runPublisher = async (ageCheck: boolean, epoch: number) => {
    const captured = current.current;
    if (
      !uid ||
      captured?.uid !== uid ||
      publishing.current ||
      epoch !== publishGeneration.current ||
      friendsActivity(uid).busy ||
      friendsActivity(uid).deleting ||
      !getSource()
    )
      return;
    publishing.current = true;
    try {
      const read = await readFriendSharing(uid);
      if (current.current !== captured || epoch !== publishGeneration.current) return;
      applySharing(read);
      const source = getSource();
      if (!read.settings?.on || !source || friendsActivity(uid).busy) return;
      const publication = buildFriendPublication(read.settings, source);
      const unchanged = publication.fp === readLocal(uid)?.fp;
      const timestamp = read.card.kind === "published" ? read.card.card.t : null;
      const old =
        timestamp === null || timestamp > Date.now() || Date.now() - timestamp >= 6 * 60 * 60_000;
      if (unchanged && read.card.kind === "published" && (!ageCheck || !old)) return;
      if (Date.now() - lastPublished.current < 60_000) {
        schedulePublishRef.current(ageCheck);
        return;
      }
      await publishFriendCard(
        uid,
        read.settings.rev,
        () => (epoch === publishGeneration.current ? getSource() : null),
        (published) => acknowledge(captured, read.settings!, published),
      );
      if (current.current === captured) await refreshSharingRef.current();
    } catch (error) {
      if (current.current !== captured) return;
      if (!friendsActivity(uid).busy) await refreshSharingRef.current();
      if (current.current !== captured) return;
      sharingRef.current = { ...sharingRef.current, error: describeFriendsError(error) };
      setSharing(sharingRef.current);
    } finally {
      if (current.current === captured) publishing.current = false;
    }
  };

  const schedulePublish = (ageCheck = false) => {
    if (
      !uid ||
      friendsActivity(uid).busy ||
      friendsActivity(uid).deleting ||
      !sharingRef.current.loaded
    )
      return;
    const settings = sharingRef.current.settings;
    const source = getSource();
    if (!settings?.on || !source) return;
    const publication = buildFriendPublication(settings, source);
    const card = sharingRef.current.card;
    const timestamp = card.kind === "published" ? card.card.t : null;
    const old =
      timestamp === null || timestamp > Date.now() || Date.now() - timestamp >= 6 * 60 * 60_000;
    if (publication.fp === readLocal(uid)?.fp && card.kind === "published" && (!ageCheck || !old))
      return;
    queuedAgeCheck.current ||= ageCheck;
    if (publishTimer.current) clearTimeout(publishTimer.current);
    const delay = Math.max(
      ageCheck ? 0 : 30_000,
      publication.fp !== readLocal(uid)?.fp ? quietUntil.current - Date.now() : 0,
      60_000 - (Date.now() - lastPublished.current),
    );
    const epoch = ++publishGeneration.current;
    publishTimer.current = setTimeout(() => {
      publishTimer.current = null;
      const checkAge = queuedAgeCheck.current;
      queuedAgeCheck.current = false;
      void runPublisher(checkAge, epoch);
    }, delay);
  };
  schedulePublishRef.current = schedulePublish;

  // Association is established by an acknowledged sync in this session, or the explicit preview.
  useEffect(() => {
    if (
      !uid ||
      current.current?.uid !== uid ||
      !isSetUp.current ||
      !study.hydrated ||
      study.syncBusy ||
      !study.syncLinked ||
      !isSetUp.current ||
      !study.syncStamp ||
      Date.parse(study.syncStamp) < sessionStartedAt.current ||
      !Number.isFinite(Date.parse(study.syncStamp)) ||
      friendsActivity(uid).deleting
    )
      return;
    sourceUid.current = uid;
    patchLocal(uid, { publishSourceUid: uid });
    setSourceTick((value) => value + 1);
  }, [uid, study.hydrated, study.syncBusy, study.syncLinked, study.syncStamp]);

  useEffect(() => {
    if (!study.hydrated || study.syncBusy) {
      cancelPublish();
      return;
    }
    quietUntil.current = Date.now() + 30_000;
    schedulePublishRef.current();
  }, [
    uid,
    study.lessons,
    study.progress,
    study.prefs,
    study.hydrated,
    study.syncBusy,
    profile,
    day,
    sourceTick,
    sharing.loaded,
    sharing.settings?.rev,
    cancelPublish,
  ]);

  // One local-midnight wakeup, disarmed while hidden; this is not an inbox polling loop.
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (document.visibilityState === "hidden") {
        cancelPublish();
        return;
      }
      setDay(localDay());
      if (!isSetUp.current || friendsActivity(uid).deleting) return;
      const next = new Date();
      next.setHours(24, 0, 0, 50);
      timer = setTimeout(arm, Math.max(1, next.getTime() - Date.now()));
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    window.addEventListener("focus", arm);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
      window.removeEventListener("focus", arm);
    };
  }, [uid, sharing.loaded, cancelPublish]);

  const saveSharingEdit = (edit: SharingEdit, expectedRevision: string | null) =>
    perform(async () => {
      const captured = current.current!;
      const result = await saveFriendSharing(
        uid!,
        expectedRevision,
        edit,
        () => getSource(false, true),
        false,
        ({ settings, publication }) => acknowledge(captured, settings, publication),
      );
      if (!result.settings.on)
        return "Sharing is off. Your public card and picture have been removed.";
      return result.publication
        ? "Your sharing choices and card are saved."
        : "Your choices are saved. Update your card when your progress is ready.";
    });
  cosmeticSaveRef.current = () => {
    if (
      !uid ||
      !sharingRef.current.loaded ||
      !sharingRef.current.settings ||
      friendsActivity(uid).deleting
    )
      return;
    cosmeticPending.current = true;
    if (friendsActivity(uid).busy) {
      setView((value) => ({
        ...value,
        notice:
          "Your picture or look changed on this device. Use Update now after the current request finishes.",
      }));
      return;
    }
    void saveSharingEdit({}, sharingRef.current.settings.rev);
  };

  useEffect(() => {
    if (!uid) return;
    let previous = JSON.stringify([readProfile().glyph, readProfile().photo]);
    const changed = () => {
      const currentProfile = readProfile();
      const next = JSON.stringify([currentProfile.glyph, currentProfile.photo]);
      if (next === previous) return;
      previous = next;
      cosmeticSaveRef.current();
    };
    window.addEventListener(PREFS_CHANGED_EVENT, changed);
    return () => window.removeEventListener(PREFS_CHANGED_EVENT, changed);
  }, [uid]);
  useEffect(() => {
    const next = JSON.stringify([study.prefs.accent, study.prefs.stamp]);
    const previous = previousLook.current;
    previousLook.current = next;
    if (previous !== null && previous !== next && study.hydrated) cosmeticSaveRef.current();
  }, [study.prefs.accent, study.prefs.stamp, study.hydrated]);

  const previewSharing = (name: string, photo: boolean, revision: string | null) => {
    const source = getSource(true);
    const settings = sharingRef.current.settings;
    const n = publicName(name, null);
    if (!source || !n || !sharingRef.current.loaded || revision !== (settings?.rev ?? null))
      return null;
    const proposed: FriendSettings = {
      v: 1,
      rev: settings?.rev ?? "0".repeat(32),
      prev: settings?.prev ?? "",
      on: true,
      photo,
      n,
      since: settings?.since ?? source.day,
      deco: settings?.deco ?? { fr: "plain", fx: "none" },
    };
    return {
      revision,
      name: n,
      photo,
      sourceKey: JSON.stringify(source),
      publication: buildFriendPublication(proposed, source),
    };
  };

  const selectPhoto = async (peer: string) => {
    const captured = current.current;
    const sequence = ++photoSequence.current;
    const entry = cardCache.current[peer];
    setSelectedPeer(peer);
    setSelectedPhoto(null);
    if (
      !uid ||
      captured?.uid !== uid ||
      entry?.kind !== "published" ||
      !entry.card.ph ||
      entry.cached
    )
      return;
    try {
      const result = await readFriendPhoto(uid, peer, entry.card.rev);
      if (
        current.current !== captured ||
        sequence !== photoSequence.current ||
        cardCache.current[peer] !== entry
      )
        return;
      if (result.kind === "photo") setSelectedPhoto({ peer, photo: result.photo });
      else {
        await refreshRef.current();
        if (current.current === captured)
          setView((value) => ({
            ...value,
            notice:
              "The picture changed. The card was refreshed; select it again to view the picture.",
          }));
      }
    } catch (error) {
      if (current.current !== captured || sequence !== photoSequence.current) return;
      if (isFriendsDenied(error)) {
        delete cardCache.current[peer];
        setView((value) => {
          if (!value.snapshot) return value;
          const snapshot = {
            ...value.snapshot,
            cards: { ...cardCache.current },
            peers: value.snapshot.peers.map((person) =>
              person.uid === peer ? { ...person, state: "unavailable" as const } : person,
            ),
          };
          saveCache(uid, snapshot, []);
          return { ...value, snapshot };
        });
      }
      setSelectedPhoto(null);
    }
  };

  const rememberIdentity = (identity: PublicIdentity) => {
    if (!uid) return;
    const name = publicName(identity.n, null);
    if (!name) return;
    try {
      patchLocal(uid, { publicName: name });
    } catch {
      /* A device draft is optional. */
    }
    setView((value) => ({ ...value, publicName: name }));
  };

  const perform = async (job: () => Promise<string>, identity?: PublicIdentity) => {
    const captured = current.current;
    if (!uid || captured?.uid !== uid) return false;
    if (friendsActivity(uid).busy || friendsActivity(uid).deleting) return false;
    cancelPublish();
    ++readSequence.current;
    refreshing.current = false;
    setView((value) => ({ ...value, loading: false, error: null, notice: null }));
    try {
      const notice = await job();
      if (current.current !== captured || friendsActivity(uid).deleting) return false;
      if (identity) rememberIdentity(identity);
      setView((value) => ({ ...value, notice }));
      await refreshRef.current();
      return true;
    } catch (error) {
      if (current.current !== captured) return false;
      // Reconcile a confirmed rejection without replaying the user's operation.
      if (!friendsActivity(uid).busy) await refreshRef.current();
      if (current.current !== captured) return false;
      setView((value) => ({ ...value, error: describeFriendsError(error) }));
      return false;
    }
  };

  const ownView = view.uid === uid ? view : emptyView(uid);
  const suggestedName =
    (sharing.uid === uid ? sharing.settings?.n : null) ??
    ownView.publicName ??
    publicName(profile.name, account?.displayName ?? null) ??
    "";
  return {
    ...ownView,
    uid,
    available: Boolean(uid && configured),
    activity: view.uid === uid ? activity : friendsActivity(uid),
    invite: uid ? invite : null,
    suggestedName,
    sharing: sharing.uid === uid ? sharing : emptySharing(uid),
    readyToPublish: getSource() !== null,
    readyToUpdate: getSource(false, true) !== null,
    uploadedPhotoAvailable: Boolean(getSource(true)?.photo),
    previewSharing,
    selectPhoto,
    selectedPeer,
    selectedPhoto,
    saveSharing: saveSharingEdit,
    stopSharing: () =>
      saveSharingEdit({ on: false, photo: false }, sharingRef.current.settings?.rev ?? null),
    startSharing: (preview: NonNullable<ReturnType<typeof previewSharing>>) =>
      perform(async () => {
        const captured = current.current!;
        const source = () => {
          const value = getSource(true);
          return value && JSON.stringify(value) === preview.sourceKey ? value : null;
        };
        await saveFriendSharing(
          uid!,
          preview.revision,
          { on: true, photo: preview.photo, n: preview.name },
          source,
          true,
          ({ settings, publication }) => acknowledge(captured, settings, publication, true),
        );
        return "Sharing is on. Your card is saved.";
      }),
    updateNow: () =>
      perform(async () => {
        const captured = current.current!;
        const value = await readFriendSharing(uid!);
        if (current.current !== captured) throw new FriendsError("The signed-in account changed.");
        applySharing(value);
        if (!value.settings?.on) return "Sharing is off. Review the preview to start sharing.";
        if (!getSource(false, true))
          return "Review this device's progress before updating your card, or finish syncing this account.";
        if (cosmeticPending.current) {
          const result = await saveFriendSharing(
            uid!,
            value.settings.rev,
            {},
            () => getSource(false, true),
            false,
            ({ settings, publication }) => acknowledge(captured, settings, publication),
          );
          return result.publication
            ? "Your choices and card are saved."
            : "Your choices are saved. Update your card when your progress is ready.";
        }
        await publishFriendCard(
          uid!,
          value.settings.rev,
          () => getSource(),
          (publication) => acknowledge(captured, value.settings!, publication),
        );
        return "Your card is updated.";
      }),
    glyph: publicGlyph(profile.glyph),
    blockedName: (peer: string) => closedCovers.current.get(peer)?.name ?? "Blocked person",
    clearInvite: () => setInvite(null),
    refresh,
    setup: (identity: PublicIdentity) =>
      perform(async () => {
        if (!publicName(identity.n, null)) throw new FriendsError("Choose a public name first.");
        await setupFriends(uid!);
        return "Friends is set up. Review sharing separately below.";
      }, identity),
    rotate: () =>
      perform(async () => {
        await rotateFriendCode(uid!);
        return "Your friend code has changed. Existing requests still work.";
      }),
    request: (code: string, identity: PublicIdentity) =>
      perform(async () => {
        const result = await requestFriend(uid!, code, identity);
        if (result.kind === "already-friends") return "Already friends.";
        if (result.kind === "already-sent") return "A request is already pending.";
        if (result.kind === "incoming") {
          return "They already invited you. Choose Accept in Incoming requests below.";
        }
        return "Request sent. Your sharing choice is unchanged.";
      }, identity),
    accept: (peer: string, identity: PublicIdentity) =>
      perform(async () => {
        await acceptFriend(uid!, peer, identity);
        return "You are friends. Your sharing choice is unchanged.";
      }, identity),
    remove: (peer: string, block = false) =>
      perform(async () => {
        await removeFriend(uid!, peer, block);
        return block
          ? "Person blocked and connection removed."
          : "Connection and requests removed.";
      }),
    unblock: (peer: string) =>
      perform(async () => {
        await unblockFriend(uid!, peer);
        return "Person unblocked. No friend request was sent.";
      }),
  };
}

export type FriendsController = ReturnType<typeof useFriendsController>;
export const FriendsContext = createContext<FriendsController | null>(null);

export function useFriends(): FriendsController {
  const value = useContext(FriendsContext);
  if (!value) throw new Error("useFriends must be used inside FriendsProvider.");
  return value;
}
