import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Account } from "@/lib/firebase";
import {
  FRIENDS_REFRESH_MS,
  canCheerToday,
  cheerUnread,
  type Cheer,
  type CheerId,
  friendsDoorVisible,
  decodeFriendsCache,
  decodeFriendsLocal,
  normalizeFriendCode,
  publicGlyph,
  publicName,
  buildFriendPublication,
  friendCardSource,
  decodeDecoration,
  FRIEND_SCHEMA_VERSION,
  UnsupportedFriendSettingsError,
  type FriendDecoration,
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
  readCheerPair,
  sendFriendCheer,
  clearFriendCheer,
  readOwnerBannerAsset,
  readFriendBanner,
  type SharingRead,
  type SharingEdit,
} from "@/lib/friends-db";
import { avatarFor } from "@/lib/profile";
import { useProfile } from "@/components/profile/useProfile";
import { STORAGE_KEYS } from "@/lib/storage";
import { PREFS_CHANGED_EVENT, readProfile } from "@/lib/prefs-storage";
import { addDays, localDay } from "@/lib/word-memory";
import type { QuestPrefs } from "@/lib/quest-prefs";
import {
  decodeBannerDraft,
  readBannerDraft,
  writeBannerDraft,
  type BannerDraft,
  type BannerScope,
  type BannerAsset,
  type PublicBanner,
  sameBannerImage,
} from "@/lib/friend-banner";
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
type SharingView = SharingRead & {
  uid: string | null;
  loaded: boolean;
  error: string | null;
  unsupported: boolean;
};
const emptySharing = (uid: string | null): SharingView => ({
  uid,
  loaded: false,
  settings: null,
  card: { kind: "closed", cached: false, fetchedAt: 0 },
  error: null,
  unsupported: false,
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

type CheerLocal = {
  uid: string | null;
  seen: Record<string, number>;
  sentDay: Record<string, string>;
  sentCheer: Record<string, CheerId>;
};
type CheerInbox = {
  uid: string | null;
  records: Record<string, Cheer>;
  stale: boolean;
  fetchedAt: number;
  error: string | null;
};
type CheerPane = {
  outgoing: Cheer | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;
};
const emptyCheerPane = (): CheerPane => ({
  outgoing: null,
  loaded: false,
  loading: false,
  error: null,
});

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
  const [cheerLocal, setCheerLocal] = useState<CheerLocal>({
    uid: null,
    seen: {},
    sentDay: {},
    sentCheer: {},
  });
  const cheerLocalRef = useRef(cheerLocal);
  const [cheerInbox, setCheerInbox] = useState<CheerInbox>({
    uid: null,
    records: {},
    stale: true,
    fetchedAt: 0,
    error: null,
  });
  const cheerInboxRef = useRef(cheerInbox);
  const [cheerPanes, setCheerPanes] = useState<Record<string, CheerPane>>({});
  const cheerPanesRef = useRef(cheerPanes);
  const cheerPeers = useRef(new Set<string>());
  const cheerRelationsFresh = useRef(false);
  const activeCheerPeer = useRef<string | null>(null);
  const cheerPaneSequence = useRef(0);
  const cheerReading = useRef<string | null>(null);
  const loadCheerPaneRef = useRef<(peer: string) => Promise<void>>(async () => {});
  const [invite, setInvite] = useState<string | null>(null);
  const [sharing, setSharing] = useState<SharingView>(() => emptySharing(null));
  const sharingRef = useRef(sharing);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ peer: string; photo: FriendPhoto } | null>(
    null,
  );
  const [decoration, setDecoration] = useState<{
    uid: string | null;
    value: FriendDecoration | null;
  }>({ uid: null, value: null });
  const [previewPhoto, setPreviewPhoto] = useState<FriendPhoto | null>(null);
  const [ownerBanner, setOwnerBanner] = useState<{
    uid: string | null;
    loaded: boolean;
    loading: boolean;
    asset: BannerAsset | null;
    error: string | null;
  }>({ uid: null, loaded: false, loading: false, asset: null, error: null });
  const ownerBannerRef = useRef(ownerBanner);
  const ownerBannerSequence = useRef(0);
  const [bannerRemoving, setBannerRemoving] = useState(false);
  const removingRef = useRef(false);
  const [selectedBanner, setSelectedBanner] = useState<{
    peer: string;
    banner: PublicBanner;
  } | null>(null);
  const [bannerRead, setBannerRead] = useState<{
    peer: string;
    id: string;
    error: string | null;
    loading: boolean;
  } | null>(null);
  const selectedBannerSequence = useRef(0);
  const [previewBanner, setPreviewBanner] = useState<PublicBanner | null>(null);
  const [previewBannerError, setPreviewBannerError] = useState<string | null>(null);
  const previewBannerSequence = useRef(0);
  const previewBannerMismatch = useRef<string | null>(null);
  const [localBanner, setLocalBanner] = useState<{
    scope: BannerScope;
    draft: BannerDraft | null;
    error: string | null;
  }>({ scope: { uid: null, generation: 0 }, draft: null, error: null });
  const localBannerRef = useRef(localBanner);
  const bannerEdited = useRef(false);
  const bannerScopeRef = useRef<BannerScope | null>(null);
  const bannerGeneration = useRef(0);
  const bannerOwner = useRef(uid);
  bannerOwner.current = uid;
  localBannerRef.current = localBanner;
  const previewPhotoSequence = useRef(0);
  const previewMismatch = useRef<string | null>(null);
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

  const saveCheerLocal = useCallback(
    (next: CheerLocal) => {
      if (
        next.uid !== uid ||
        current.current?.uid !== uid ||
        (uid && friendsActivity(uid).deleting)
      )
        return;
      cheerLocalRef.current = next;
      setCheerLocal(next);
      if (uid)
        patchLocal(uid, {
          seen: { cheers: next.seen },
          sentDay: next.sentDay,
          sentCheer: next.sentCheer,
        });
    },
    [uid],
  );
  const resetCheerData = useCallback(
    (restore = true) => {
      ++cheerPaneSequence.current;
      cheerReading.current = null;
      activeCheerPeer.current = null;
      cheerPeers.current = new Set();
      cheerRelationsFresh.current = false;
      const local = restore && uid ? readLocal(uid) : null;
      const next: CheerLocal = {
        uid,
        seen: local?.seen?.cheers ?? {},
        sentDay: local?.sentDay ?? {},
        sentCheer: local?.sentCheer ?? {},
      };
      cheerLocalRef.current = next;
      setCheerLocal(next);
      const inbox: CheerInbox = { uid, records: {}, stale: true, fetchedAt: 0, error: null };
      cheerInboxRef.current = inbox;
      setCheerInbox(inbox);
      cheerPanesRef.current = {};
      setCheerPanes({});
    },
    [uid],
  );
  const reconcileCheers = useCallback(
    (snapshot: FriendsSnapshot) => {
      const allowed = new Set(
        snapshot.peers.filter((peer) => peer.state === "final").map((peer) => peer.uid),
      );
      cheerPeers.current = allowed;
      cheerRelationsFresh.current = Boolean(
        snapshot.own && !snapshot.own.deleting && !snapshot.cached,
      );
      const keep = <T>(map: Record<string, T>) =>
        Object.fromEntries(Object.entries(map).filter(([peer]) => allowed.has(peer)));
      const local = cheerLocalRef.current;
      saveCheerLocal({
        uid,
        seen: keep(local.seen),
        sentDay: keep(local.sentDay),
        sentCheer: keep(local.sentCheer),
      });
      const read = snapshot.cheers;
      const records = read?.loaded ? { ...read.records } : keep(cheerInboxRef.current.records);
      for (const peer of read?.invalid ?? [])
        if (cheerInboxRef.current.records[peer])
          records[peer] = cheerInboxRef.current.records[peer]!;
      const inbox: CheerInbox = {
        uid,
        records: keep(records),
        stale: !read?.loaded || Boolean(read.invalid.length),
        fetchedAt: read?.loaded ? read.fetchedAt : cheerInboxRef.current.fetchedAt,
        error: read?.error ?? null,
      };
      cheerInboxRef.current = inbox;
      setCheerInbox(inbox);
      cheerPanesRef.current = keep(cheerPanesRef.current);
      setCheerPanes(cheerPanesRef.current);
      if (activeCheerPeer.current && !allowed.has(activeCheerPeer.current)) {
        activeCheerPeer.current = null;
        ++cheerPaneSequence.current;
        cheerReading.current = null;
      }
    },
    [uid, saveCheerLocal],
  );
  const evictCheerPeer = useCallback(
    (peer: string) => {
      if (current.current?.uid !== uid) return;
      cheerPeers.current.delete(peer);
      if (activeCheerPeer.current === peer) {
        activeCheerPeer.current = null;
        ++cheerPaneSequence.current;
        cheerReading.current = null;
      }
      const local = cheerLocalRef.current;
      const { [peer]: _seen, ...seen } = local.seen;
      const { [peer]: _day, ...sentDay } = local.sentDay;
      const { [peer]: _kind, ...sentCheer } = local.sentCheer;
      saveCheerLocal({ uid, seen, sentDay, sentCheer });
      const { [peer]: _record, ...records } = cheerInboxRef.current.records;
      const inbox = { ...cheerInboxRef.current, records };
      cheerInboxRef.current = inbox;
      setCheerInbox(inbox);
      const { [peer]: _pane, ...panes } = cheerPanesRef.current;
      cheerPanesRef.current = panes;
      setCheerPanes(panes);
    },
    [uid, saveCheerLocal],
  );
  const loadCheerPane = useCallback(
    async (peer: string) => {
      const captured = current.current;
      if (
        !uid ||
        captured?.uid !== uid ||
        !cheerRelationsFresh.current ||
        !cheerPeers.current.has(peer) ||
        refreshing.current ||
        friendsActivity(uid).deleting ||
        friendsActivity(uid).busy ||
        document.visibilityState === "hidden" ||
        !navigator.onLine ||
        cheerReading.current === peer
      )
        return;
      const sequence = ++cheerPaneSequence.current;
      cheerReading.current = peer;
      const pending = {
        ...(cheerPanesRef.current[peer] ?? emptyCheerPane()),
        loading: true,
        error: null,
      };
      cheerPanesRef.current = { ...cheerPanesRef.current, [peer]: pending };
      setCheerPanes(cheerPanesRef.current);
      try {
        const value = await readCheerPair(uid, peer);
        if (
          current.current !== captured ||
          sequence !== cheerPaneSequence.current ||
          !cheerPeers.current.has(peer)
        )
          return;
        const records = { ...cheerInboxRef.current.records };
        if (value.incoming) records[peer] = value.incoming;
        else delete records[peer];
        const inbox = { ...cheerInboxRef.current, records };
        cheerInboxRef.current = inbox;
        setCheerInbox(inbox);
        cheerPanesRef.current = {
          ...cheerPanesRef.current,
          [peer]: { outgoing: value.outgoing, loaded: true, loading: false, error: null },
        };
        setCheerPanes(cheerPanesRef.current);
      } catch (error) {
        if (current.current !== captured || sequence !== cheerPaneSequence.current) return;
        if (isFriendsDenied(error)) evictCheerPeer(peer);
        cheerPanesRef.current = {
          ...cheerPanesRef.current,
          [peer]: {
            ...(cheerPanesRef.current[peer] ?? emptyCheerPane()),
            loaded: false,
            loading: false,
            error: describeFriendsError(error),
          },
        };
        setCheerPanes(cheerPanesRef.current);
        if (isFriendsDenied(error)) await refreshRef.current();
      } finally {
        if (current.current === captured && sequence === cheerPaneSequence.current)
          cheerReading.current = null;
      }
    },
    [uid, evictCheerPeer],
  );
  loadCheerPaneRef.current = loadCheerPane;

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
    ++cheerPaneSequence.current;
    cheerReading.current = null;
    cheerPanesRef.current = Object.fromEntries(
      Object.entries(cheerPanesRef.current).map(([peer, pane]) => [
        peer,
        { ...pane, loading: false },
      ]),
    );
    setCheerPanes(cheerPanesRef.current);
    lastRefresh.current = Date.now();
    refreshing.current = true;
    setView((value) => ({ ...value, loading: true }));
    try {
      const snapshot = await fetchFriends(uid, cardCache.current);
      if (current.current !== captured || sequence !== readSequence.current) return;
      lastRefresh.current = Date.now();
      isSetUp.current = Boolean(snapshot.own && !snapshot.own.deleting);
      reconcileCheers(snapshot);
      cardCache.current = snapshot.cards ?? {};
      ++selectedBannerSequence.current;
      setBannerRead((old) => (old ? { ...old, loading: false } : null));
      setSelectedBanner((old) => {
        const entry = old ? snapshot.cards?.[old.peer] : null;
        return old &&
          entry?.kind === "published" &&
          entry.card.bannerId === old.banner.id &&
          snapshot.peers.some((peer) => peer.uid === old.peer && peer.state === "final")
          ? old
          : null;
      });
      ++photoSequence.current;
      setSelectedPhoto((old) => {
        const entry = old ? snapshot.cards?.[old.peer] : null;
        return old &&
          entry?.kind === "published" &&
          !entry.cached &&
          entry.card.ph &&
          entry.card.rev === old.photo.rev &&
          snapshot.peers.some((peer) => peer.uid === old.peer && peer.state === "final")
          ? old
          : null;
      });
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
        setPreviewBanner(null);
        setPreviewBannerError(null);
        ++previewBannerSequence.current;
        setSharing(sharingRef.current);
        ++sharingSequence.current;
        clearFriendsStorage(uid, true);
      }
      setView((value) => ({ ...value, uid, snapshot, loading: false, error: null }));
      if (snapshot.own && !snapshot.own.deleting) {
        await refreshSharingRef.current();
        if (current.current === captured) schedulePublishRef.current(true);
      }
    } catch (error) {
      if (current.current !== captured || sequence !== readSequence.current) return;
      cheerRelationsFresh.current = false;
      const failedInbox = {
        ...cheerInboxRef.current,
        stale: true,
        error: "Couldn't refresh cheers. Last-known indicators are kept.",
      };
      cheerInboxRef.current = failedInbox;
      setCheerInbox(failedInbox);
      if (isFriendsDenied(error)) {
        reconcileCheers({ own: null, peers: [], blocks: [], fetchedAt: Date.now(), cached: false });
        setSelectedBanner(null);
        setPreviewBanner(null);
        ++selectedBannerSequence.current;
        ++previewBannerSequence.current;
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
      if (current.current === captured && sequence === readSequence.current) {
        refreshing.current = false;
        if (activeCheerPeer.current) void loadCheerPaneRef.current(activeCheerPeer.current);
      }
    }
  }, [uid, cancelPublish, reconcileCheers]);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!resolved) return;
    setFriendsAccount(uid);
    resetCheerData();
    ownerBannerRef.current = { uid, loaded: false, loading: false, asset: null, error: null };
    setOwnerBanner(ownerBannerRef.current);
    ++ownerBannerSequence.current;
    setBannerRemoving(false);
    removingRef.current = false;
    setSelectedBanner(null);
    setBannerRead(null);
    setPreviewBanner(null);
    setPreviewBannerError(null);
    ++selectedBannerSequence.current;
    ++previewBannerSequence.current;
    previewBannerMismatch.current = null;
    const restoredBanner = readBannerDraft(uid);
    bannerEdited.current = Boolean(restoredBanner && !restoredBanner.id);
    const bannerScope = { uid, generation: ++bannerGeneration.current };
    bannerScopeRef.current = bannerScope;
    const restoredLocal = { scope: bannerScope, draft: restoredBanner, error: null };
    localBannerRef.current = restoredLocal;
    setLocalBanner(restoredLocal);
    let draftDeco: FriendDecoration | null = null;
    try {
      draftDeco =
        decodeFriendsLocal(localStorage.getItem(STORAGE_KEYS.friends), uid)?.decoDraft ?? null;
    } catch {
      /* Optional local draft. */
    }
    if (draftDeco && restoredBanner) bannerEdited.current = true;
    setDecoration({ uid, value: draftDeco });
    setPreviewPhoto(null);
    ++previewPhotoSequence.current;
    previewMismatch.current = null;
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
        resetCheerData(false);
        ownerBannerRef.current = { uid, loaded: false, loading: false, asset: null, error: null };
        setOwnerBanner(ownerBannerRef.current);
        ++ownerBannerSequence.current;
        setBannerRemoving(false);
        removingRef.current = false;
        setSelectedBanner(null);
        setBannerRead(null);
        setPreviewBanner(null);
        setPreviewBannerError(null);
        ++selectedBannerSequence.current;
        ++previewBannerSequence.current;
        const clearedBannerScope = { uid, generation: ++bannerGeneration.current };
        bannerScopeRef.current = clearedBannerScope;
        setLocalBanner({ scope: clearedBannerScope, draft: null, error: null });
        setDecoration({ uid, value: null });
        setPreviewPhoto(null);
        ++previewPhotoSequence.current;
        cancelPublish();
        sourceUid.current = null;
        cosmeticPending.current = false;
        cardCache.current = {};
        ++photoSequence.current;
        sharingRef.current = emptySharing(uid);
        setPreviewBanner(null);
        setPreviewBannerError(null);
        ++previewBannerSequence.current;
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
      ++cheerPaneSequence.current;
      cheerReading.current = null;
      activeCheerPeer.current = null;
      ++ownerBannerSequence.current;
      ++selectedBannerSequence.current;
      ++previewBannerSequence.current;
      bannerScopeRef.current = null;
      cancelPublish();
      ++sharingSequence.current;
      ++readSequence.current;
      setFriendsAccount(null);
    };
  }, [uid, resolved, cancelPublish, resetCheerData]);

  const backgroundReady =
    view.uid === uid && Boolean(view.snapshot?.own && !view.snapshot.own.deleting);
  useEffect(() => {
    if (!uid) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const allowed = () =>
      !stopped &&
      document.visibilityState !== "hidden" &&
      navigator.onLine &&
      isSetUp.current &&
      !friendsActivity(uid).busy &&
      !friendsActivity(uid).deleting;
    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (!allowed()) return;
      timer = setTimeout(
        onFocus,
        Math.max(250, FRIENDS_REFRESH_MS - (Date.now() - lastRefresh.current)),
      );
    };
    function onFocus(event?: Event) {
      if (!allowed()) {
        arm();
        return;
      }
      setDay(localDay());
      void refreshSharingRef.current().then(() => schedulePublishRef.current(true));
      if (refreshing.current || Date.now() - lastRefresh.current < FRIENDS_REFRESH_MS) {
        if (event?.type === "online" && !refreshing.current && activeCheerPeer.current)
          void loadCheerPaneRef.current(activeCheerPeer.current);
        arm();
        return;
      }
      void refreshRef.current().finally(arm);
    }
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    window.addEventListener("offline", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    arm();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.removeEventListener("offline", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [uid, backgroundReady, activity.busy, activity.deleting]);

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
    ++previewPhotoSequence.current;
    setPreviewPhoto(null);
    ++previewBannerSequence.current;
    setPreviewBanner((old) =>
      value.settings?.on && value.card.kind === "published" && value.card.card.bannerId === old?.id
        ? old
        : null,
    );
    if (!value.settings?.on || value.card.kind !== "published" || !value.card.card.bannerId) {
      setPreviewBannerError(null);
      previewBannerMismatch.current = null;
    }
    sharingRef.current = { ...value, uid, loaded: true, error: null, unsupported: false };
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
        unsupported: error instanceof UnsupportedFriendSettingsError,
        error: describeFriendsError(error),
      };
      if (isFriendsDenied(error)) {
        setPreviewBanner(null);
        ++previewBannerSequence.current;
        setPreviewBannerError("Couldn't access the shared banner. Refresh and retry.");
      }
      setSharing(sharingRef.current);
    }
  };
  refreshSharingRef.current = refreshSharing;

  const setDecoDraft = (value: FriendDecoration | null) => {
    if (
      (uid !== null && current.current?.uid !== uid) ||
      (uid === null && current.current !== null)
    )
      return false;
    if (uid && friendsActivity(uid).deleting) return false;
    const parsed = value === null ? null : decodeDecoration(value, true);
    if (value !== null && !parsed) return false;
    try {
      const saved = decodeFriendsLocal(localStorage.getItem(STORAGE_KEYS.friends), uid) ?? {
        v: 1,
        uid,
      };
      const { decoDraft: _old, ...rest } = saved;
      localStorage.setItem(
        STORAGE_KEYS.friends,
        JSON.stringify({ ...rest, ...(parsed ? { decoDraft: parsed } : {}) }),
      );
    } catch {
      /* The in-memory draft still works when storage is blocked. */
    }
    setDecoration({ uid, value: parsed });
    return true;
  };

  const setBannerDraft = (value: BannerDraft, scope: BannerScope): boolean => {
    if (
      bannerScopeRef.current !== scope ||
      bannerOwner.current !== scope.uid ||
      (scope.uid && friendsActivity(scope.uid).deleting)
    )
      return false;
    const parsed = decodeBannerDraft(value, scope.uid);
    if (!parsed) return false;
    let error: string | null = null;
    try {
      writeBannerDraft(parsed);
    } catch {
      error =
        "This banner is applied for this session but could not be kept on this device. The previous saved banner is unchanged.";
    }
    bannerEdited.current = true;
    removingRef.current = false;
    setBannerRemoving(false);
    const next = { scope, draft: parsed, error };
    localBannerRef.current = next;
    setLocalBanner(next);
    return error === null;
  };

  const installOwnerBanner = (
    asset: BannerAsset | null,
    settings: FriendSettings | null,
    replaceLocal = false,
  ) => {
    if (!uid || current.current?.uid !== uid || friendsActivity(uid).deleting) return;
    ++ownerBannerSequence.current;
    ownerBannerRef.current = { uid, loaded: true, loading: false, asset, error: null };
    setOwnerBanner(ownerBannerRef.current);
    const scope = bannerScopeRef.current;
    const local = localBannerRef.current.draft;
    if (!scope || scope.uid !== uid) return;
    if (!asset) {
      if (replaceLocal || !bannerEdited.current) {
        try {
          writeBannerDraft(null);
        } catch {
          /* Cleared in memory; preserve storage error feedback below. */
        }
        const next = { scope, draft: null, error: null };
        localBannerRef.current = next;
        setLocalBanner(next);
      }
    } else if (replaceLocal || !bannerEdited.current || !local) {
      const draft: BannerDraft = {
        v: 1,
        uid,
        ...asset,
        selected: (replaceLocal || !bannerEdited.current) && settings?.deco.bannerId === asset.id,
      };
      let error: string | null = null;
      try {
        writeBannerDraft(draft);
      } catch {
        error = "The saved banner is loaded, but this device couldn't keep a local copy.";
      }
      const next = { scope, draft, error };
      localBannerRef.current = next;
      setLocalBanner(next);
    } else if (sameBannerImage(local, asset)) {
      const draft = { ...local, id: asset.id };
      let error: string | null = null;
      try {
        writeBannerDraft(draft);
      } catch {
        error = "This device couldn't keep the banner draft.";
      }
      const next = { scope, draft, error };
      localBannerRef.current = next;
      setLocalBanner(next);
    }
  };

  const loadBannerAsset = useCallback(
    async (force = false) => {
      const captured = current.current;
      if (
        !uid ||
        captured?.uid !== uid ||
        friendsActivity(uid).deleting ||
        friendsActivity(uid).busy ||
        ownerBannerRef.current.loading ||
        (ownerBannerRef.current.loaded && !force)
      )
        return;
      const sequence = ++ownerBannerSequence.current;
      ownerBannerRef.current = { ...ownerBannerRef.current, uid, loading: true, error: null };
      setOwnerBanner(ownerBannerRef.current);
      try {
        const asset = await readOwnerBannerAsset(uid);
        if (
          current.current !== captured ||
          sequence !== ownerBannerSequence.current ||
          friendsActivity(uid).deleting
        )
          return;
        installOwnerBanner(asset, sharingRef.current.settings);
      } catch (error) {
        if (current.current !== captured || sequence !== ownerBannerSequence.current) return;
        ownerBannerRef.current = {
          uid,
          asset: null,
          loaded: false,
          loading: false,
          error: error instanceof Error ? error.message : describeFriendsError(error),
        };
        setOwnerBanner(ownerBannerRef.current);
        if (!bannerEdited.current && localBannerRef.current.draft?.id) {
          const scope = bannerScopeRef.current;
          if (scope) {
            try {
              writeBannerDraft(null);
            } catch {
              /* Memory is evicted even if optional storage is unavailable. */
            }
            const next = { scope, draft: null, error: null };
            localBannerRef.current = next;
            setLocalBanner(next);
          }
        }
      }
      // installOwnerBanner reads mutable refs; its identity need not restart an editor load.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [uid],
  );

  const removeBanner = () => {
    if (
      uid &&
      (current.current?.uid !== uid || friendsActivity(uid).busy || friendsActivity(uid).deleting)
    )
      return;
    if (!uid || !view.snapshot?.own) {
      const scope = bannerScopeRef.current;
      if (scope) {
        let error: string | null = null;
        try {
          writeBannerDraft(null);
        } catch {
          error =
            "The banner was cleared for this session, but this device could not remove its saved copy.";
        }
        const next = { scope, draft: null, error };
        localBannerRef.current = next;
        setLocalBanner(next);
      }
      return;
    }
    bannerEdited.current = true;
    removingRef.current = true;
    setBannerRemoving(true);
  };
  const discardBanner = () => {
    bannerEdited.current = false;
    removingRef.current = false;
    setBannerRemoving(false);
    if (!uid || current.current?.uid !== uid || friendsActivity(uid).deleting) return;
    if (ownerBannerRef.current.loaded)
      installOwnerBanner(ownerBannerRef.current.asset, sharingRef.current.settings, true);
    else {
      const scope = bannerScopeRef.current;
      if (scope) {
        try {
          writeBannerDraft(null);
        } catch {
          /* A failed local clear does not change the account. */
        }
        const next = { scope, draft: null, error: null };
        localBannerRef.current = next;
        setLocalBanner(next);
      }
      void loadBannerAsset(true);
    }
  };

  const loadPreviewBanner = useCallback(
    async (force = false) => {
      const captured = current.current;
      const entry = sharingRef.current.card;
      const settings = sharingRef.current.settings;
      if (
        !uid ||
        captured?.uid !== uid ||
        friendsActivity(uid).deleting ||
        document.visibilityState === "hidden" ||
        !settings?.on ||
        entry.kind !== "published" ||
        !entry.card.bannerId ||
        entry.card.rev !== settings.rev
      )
        return;
      const key = `${entry.card.bannerId}:${entry.card.rev}`;
      if (!force && previewBannerMismatch.current === key) return;
      const sequence = ++previewBannerSequence.current;
      setPreviewBannerError(null);
      try {
        const result = await readFriendBanner(uid, uid, entry.card.bannerId);
        if (current.current !== captured || sequence !== previewBannerSequence.current) return;
        if (result.kind === "banner") setPreviewBanner(result.banner);
        else {
          setPreviewBanner(null);
          previewBannerMismatch.current = key;
          setPreviewBannerError("The shared banner changed or is unavailable. Refresh and retry.");
          await refreshSharingRef.current();
        }
      } catch (error) {
        if (current.current !== captured || sequence !== previewBannerSequence.current) return;
        setPreviewBanner(null);
        setPreviewPhoto(null);
        previewBannerMismatch.current = key;
        setPreviewBannerError("Couldn't load the shared banner. Refresh and retry.");
        if (isFriendsDenied(error)) await refreshSharingRef.current();
      }
    },
    [uid],
  );

  const selectBanner = async (peer: string) => {
    const captured = current.current;
    const entry = cardCache.current[peer];
    if (
      !uid ||
      captured?.uid !== uid ||
      document.visibilityState === "hidden" ||
      entry?.kind !== "published" ||
      entry.cached ||
      !entry.card.bannerId
    )
      return;
    const sequence = ++selectedBannerSequence.current;
    setSelectedBanner(null);
    setBannerRead({ peer, id: entry.card.bannerId, loading: true, error: null });
    try {
      const result = await readFriendBanner(uid, peer, entry.card.bannerId);
      if (
        current.current !== captured ||
        sequence !== selectedBannerSequence.current ||
        cardCache.current[peer] !== entry
      )
        return;
      if (result.kind === "banner") {
        setSelectedBanner({ peer, banner: result.banner });
        setBannerRead({ peer, id: entry.card.bannerId, loading: false, error: null });
      } else {
        setBannerRead({
          peer,
          id: entry.card.bannerId,
          loading: false,
          error: "Banner unavailable. Refresh and retry.",
        });
        if (result.kind === "missing") evictBannerCover(peer);
        await refreshRef.current();
      }
    } catch (error) {
      if (current.current !== captured || sequence !== selectedBannerSequence.current) return;
      setSelectedBanner(null);
      setBannerRead({
        peer,
        id: entry.card.bannerId,
        loading: false,
        error: "Couldn't load this banner. Retry when connected.",
      });
      if (isFriendsDenied(error)) {
        evictBannerCover(peer);
        await refreshRef.current();
      }
    }
  };
  const evictBannerCover = (peer: string) => {
    if (!uid) return;
    delete cardCache.current[peer];
    setSelectedBanner(null);
    setSelectedPhoto(null);
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
  };

  const loadPreviewPhoto = useCallback(async () => {
    const captured = current.current;
    const card = sharingRef.current.card;
    if (
      !uid ||
      captured?.uid !== uid ||
      friendsActivity(uid).deleting ||
      card.kind !== "published" ||
      !card.card.ph
    )
      return;
    if (!sharingRef.current.settings?.on || sharingRef.current.settings.rev !== card.card.rev)
      return;
    const key = `${card.card.rev}:${card.card.t}`;
    if (previewMismatch.current === key) return;
    const sequence = ++previewPhotoSequence.current;
    setPreviewPhoto(null);
    try {
      const result = await readFriendPhoto(uid, uid, card.card.rev);
      if (current.current !== captured || sequence !== previewPhotoSequence.current) return;
      if (result.kind === "photo") setPreviewPhoto(result.photo);
      else {
        previewMismatch.current = key;
        await refreshSharingRef.current();
      }
    } catch {
      if (current.current === captured && sequence === previewPhotoSequence.current)
        setPreviewPhoto(null);
    }
  }, [uid]);

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
  // `sharing.loaded` re-runs this after explicit setup (isSetUp is true by then); the conditions are unchanged.
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
  }, [uid, study.hydrated, study.syncBusy, study.syncLinked, study.syncStamp, sharing.loaded]);

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
        (result) => {
          if (current.current !== captured || friendsActivity(captured.uid).deleting) return;
          acknowledge(captured, result.settings, result.publication);
          if ("bannerAsset" in result) {
            bannerEdited.current = false;
            installOwnerBanner(result.bannerAsset ?? null, result.settings, true);
            removingRef.current = false;
            setBannerRemoving(false);
          }
        },
      );
      if (!result.settings.on)
        return "Sharing is off. Your public card, picture and banner have been removed.";
      if (result.publication)
        return edit.on
          ? "Sharing is on. Your card is saved."
          : "Your sharing choices and card are saved.";
      return edit.on
        ? "Sharing is on. No card is shared until this device's progress is ready."
        : "Your choices are saved. No card is shared until this device's progress is ready.";
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
      v: settings?.v ?? FRIEND_SCHEMA_VERSION,
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
        setSelectedBanner(null);
        ++selectedBannerSequence.current;
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
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setView((value) => ({ ...value, error: "You're offline. Try again when you're back." }));
      return false;
    }
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

  const sendCheer = (peer: string, kind: CheerId) =>
    perform(async () => {
      const captured = current.current!;
      const pane = cheerPanesRef.current[peer];
      const today = localDay();
      if (
        !cheerRelationsFresh.current ||
        !cheerPeers.current.has(peer) ||
        !pane?.loaded ||
        pane.loading ||
        pane.error
      )
        throw new FriendsError("Refresh this friend's cheer before sending.");
      if (!canCheerToday(today, cheerLocalRef.current.sentDay[peer], pane.outgoing))
        throw new FriendsError("A cheer is already recorded for this local day or a later day.");
      await sendFriendCheer(uid!, peer, kind, today, () => {
        if (
          current.current !== captured ||
          friendsActivity(captured.uid).deleting ||
          !cheerPeers.current.has(peer)
        )
          return;
        const local = cheerLocalRef.current;
        saveCheerLocal({
          ...local,
          sentDay: { ...local.sentDay, [peer]: today },
          sentCheer: { ...local.sentCheer, [peer]: kind },
        });
      });
      return "Cheer sent. This device will keep your choice for the rest of this local day.";
    });
  const clearCheer = (peer: string) =>
    perform(async () => {
      const captured = current.current!;
      if (!cheerRelationsFresh.current || !cheerPeers.current.has(peer))
        throw new FriendsError("Refresh this friendship before clearing its cheer.");
      await clearFriendCheer(uid!, peer, () => {
        if (current.current !== captured || friendsActivity(captured.uid).deleting) return;
        const { [peer]: _old, ...records } = cheerInboxRef.current.records;
        const next = { ...cheerInboxRef.current, records };
        cheerInboxRef.current = next;
        setCheerInbox(next);
      });
      return "Received cheer cleared.";
    });

  const ownView = view.uid === uid ? view : emptyView(uid);
  const suggestedName =
    (sharing.uid === uid ? sharing.settings?.n : null) ??
    ownView.publicName ??
    publicName(profile.name, account?.displayName ?? null) ??
    "";
  const ownInbox: CheerInbox =
    cheerInbox.uid === uid
      ? cheerInbox
      : { uid, records: {}, stale: true, fetchedAt: 0, error: null };
  const ownCheerLocal: CheerLocal =
    cheerLocal.uid === uid ? cheerLocal : { uid, seen: {}, sentDay: {}, sentCheer: {} };
  const unreadPeers: Record<string, boolean> = Object.fromEntries(
    (ownView.snapshot?.peers ?? [])
      .filter((peer) => peer.state === "final")
      .map((peer) => [
        peer.uid,
        cheerUnread(ownInbox.records[peer.uid], ownCheerLocal.seen[peer.uid]),
      ]),
  );
  const cheersStale =
    ownInbox.stale ||
    !cheerRelationsFresh.current ||
    ownView.loading ||
    Boolean(ownView.snapshot?.cached);
  return {
    ...ownView,
    uid,
    unreadCheers: unreadPeers,
    unreadCheerCount: Object.values(unreadPeers).filter(Boolean).length,
    cheersStale,
    cheersError: ownInbox.error,
    openCheerPane: (peer: string) => {
      activeCheerPeer.current = peer;
      void loadCheerPaneRef.current(peer);
    },
    closeCheerPane: (peer: string) => {
      if (activeCheerPeer.current !== peer) return;
      activeCheerPeer.current = null;
      ++cheerPaneSequence.current;
      cheerReading.current = null;
      if (cheerPanesRef.current[peer]) {
        cheerPanesRef.current = {
          ...cheerPanesRef.current,
          [peer]: { ...cheerPanesRef.current[peer]!, loaded: false, loading: false },
        };
        setCheerPanes(cheerPanesRef.current);
      }
    },
    refreshCheerPane: async (peer: string) => {
      if (!cheerRelationsFresh.current) await refreshRef.current();
      await loadCheerPaneRef.current(peer);
    },
    cheerFor: (peer: string) => {
      const pane =
        cheerLocal.uid === uid ? (cheerPanes[peer] ?? emptyCheerPane()) : emptyCheerPane();
      const incoming = unreadPeers[peer] !== undefined ? (ownInbox.records[peer] ?? null) : null;
      const fresh =
        cheerRelationsFresh.current &&
        cheerPeers.current.has(peer) &&
        !ownView.loading &&
        !ownView.snapshot?.cached;
      const cached =
        !fresh || (ownInbox.stale && (!pane.loaded || pane.loading || pane.error !== null));
      const stamp = ownCheerLocal.sentDay[peer];
      const outgoing = pane.outgoing;
      const chosen =
        day === null
          ? null
          : outgoing && outgoing.d >= day && (!stamp || outgoing.d >= stamp)
            ? outgoing.k
            : stamp && stamp >= day
              ? (ownCheerLocal.sentCheer[peer] ?? null)
              : null;
      return {
        incoming,
        outgoing,
        loading: pane.loading || ownView.loading,
        loaded: pane.loaded,
        cached,
        error: pane.error ?? (!pane.loaded ? ownInbox.error : null),
        canSend:
          day !== null &&
          fresh &&
          pane.loaded &&
          !pane.loading &&
          !pane.error &&
          canCheerToday(day, stamp, outgoing),
        sentKind: chosen,
        sentDay:
          day === null
            ? null
            : stamp && stamp >= day
              ? stamp
              : outgoing && outgoing.d >= day
                ? outgoing.d
                : null,
      };
    },
    markCheerSeen: (peer: string, time: number) => {
      if (
        !uid ||
        current.current?.uid !== uid ||
        !cheerRelationsFresh.current ||
        !cheerPeers.current.has(peer) ||
        cheerInboxRef.current.records[peer]?.t !== time ||
        (cheerLocalRef.current.seen[peer] ?? -1) >= time
      )
        return;
      const local = cheerLocalRef.current;
      saveCheerLocal({ ...local, seen: { ...local.seen, [peer]: time } });
    },
    sendCheer,
    clearCheer,
    available: Boolean(uid && configured),
    showFriends: friendsDoorVisible(
      ownView.snapshot,
      Boolean(uid && configured && !activity.deleting),
    ),
    comparisonData: (day: string) => {
      if (!uid || current.current?.uid !== uid || friendsActivity(uid).deleting) return null;
      const input = latestStudy.current;
      if (!input.hydrated || input.syncBusy) return null;
      const ownProfile = readProfile();
      const previousAnswers = Array.from(
        { length: 7 },
        (_, i) => input.progress.studyLog[addDays(day, i - 13)]?.answered ?? 0,
      ).reduce((sum, n) => sum + n, 0);
      return {
        source: friendCardSource(input.lessons, input.progress, ownProfile, input.prefs, day),
        previousAnswers,
        avatar: avatarFor(ownProfile, account),
      };
    },
    clearSelectedImages: () => {
      ++photoSequence.current;
      ++selectedBannerSequence.current;
      setSelectedPhoto(null);
      setSelectedPeer(null);
      setSelectedBanner(null);
      setBannerRead(null);
    },
    activity: view.uid === uid ? activity : friendsActivity(uid),
    invite: uid ? invite : null,
    suggestedName,
    sharing: sharing.uid === uid ? sharing : emptySharing(uid),
    decoDraft: decoration.uid === uid ? decoration.value : null,
    setDecoDraft,
    previewPhoto: sharing.uid === uid ? previewPhoto : null,
    loadPreviewPhoto,
    bannerDraft: localBanner.scope.uid === uid ? localBanner.draft : null,
    bannerScope:
      localBanner.scope.uid === uid && bannerScopeRef.current === localBanner.scope
        ? localBanner.scope
        : null,
    bannerError: localBanner.scope.uid === uid ? localBanner.error : null,
    setBannerDraft,
    // Why a card may be missing while sharing is On: still loading/syncing, or this device is not yet associated.
    deviceProgress: (!study.hydrated || study.syncBusy
      ? "loading"
      : sourceUid.current === uid
        ? "ready"
        : "needs-device") as "loading" | "needs-device" | "ready",
    readyToPublish: getSource() !== null,
    readyToUpdate: getSource(false, true) !== null,
    uploadedPhotoAvailable: Boolean(getSource(true)?.photo),
    previewSharing,
    selectPhoto,
    selectedPeer,
    selectedPhoto,
    saveSharing: saveSharingEdit,
    bannerAsset: ownerBanner.uid === uid ? ownerBanner.asset : null,
    bannerAssetLoaded: ownerBanner.uid === uid && ownerBanner.loaded,
    bannerAssetLoading: ownerBanner.uid === uid && ownerBanner.loading,
    bannerAssetError: ownerBanner.uid === uid ? ownerBanner.error : null,
    loadBannerAsset,
    bannerRemoving,
    removeBanner,
    deselectBanner: () => {
      bannerEdited.current = true;
      const local = localBannerRef.current;
      if (local.scope.uid !== uid || !local.draft) return;
      const draft = { ...local.draft, selected: false };
      let error: string | null = null;
      try {
        writeBannerDraft(draft);
      } catch {
        error = "This device couldn't keep the banner draft.";
      }
      const next = { ...local, draft, error };
      localBannerRef.current = next;
      setLocalBanner(next);
    },
    discardBanner,
    previewBanner: sharing.uid === uid ? previewBanner : null,
    previewBannerError: sharing.uid === uid ? previewBannerError : null,
    loadPreviewBanner,
    selectedBanner: view.uid === uid ? selectedBanner : null,
    bannerRead: view.uid === uid ? bannerRead : null,
    selectBanner,
    saveLook: (deco: FriendDecoration, revision: string | null) => {
      const local = localBannerRef.current.scope.uid === uid ? localBannerRef.current.draft : null;
      const currentId = sharingRef.current.settings?.deco.bannerId;
      const owner = ownerBannerRef.current.asset;
      if (removingRef.current)
        return saveSharingEdit({ deco, banner: { kind: "remove" } }, revision);
      if (
        local?.selected &&
        (!local.id ||
          local.id !== currentId ||
          (owner && local.id === owner.id && !sameBannerImage(local, owner)))
      ) {
        return saveSharingEdit({ deco, banner: { kind: "upload", draft: local } }, revision);
      }
      if (local?.selected && currentId) {
        const { bk: _scene, ...rest } = deco;
        return saveSharingEdit({ deco: { ...rest, bannerId: currentId } }, revision);
      }
      return saveSharingEdit({ deco }, revision);
    },

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
        return "This device's progress is confirmed and your card is saved.";
      }),
    updateNow: () =>
      perform(async () => {
        const captured = current.current!;
        const value = await readFriendSharing(uid!);
        if (current.current !== captured) throw new FriendsError("The signed-in account changed.");
        applySharing(value);
        if (!value.settings?.on) return "Sharing is off. Turn it on to share your card.";
        if (!getSource(false, true))
          return "Use this device's progress or finish syncing this account before updating your card.";
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
            : "Your choices are saved. No card is shared until this device's progress is ready.";
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
    // Explicit new setup only: the person's switch (default On) is saved as their first settings record.
    // Nothing here runs on sign-in or mount. Off is saved too, so a later reopen never re-applies the default.
    setup: (identity: PublicIdentity, share = true) =>
      perform(async () => {
        const n = publicName(identity.n, null);
        if (!n) throw new FriendsError("Choose a public name first.");
        await setupFriends(uid!);
        const captured = current.current!;
        const result = await saveFriendSharing(
          uid!,
          null,
          { on: share, photo: false, n },
          () => getSource(false, true),
          false,
          ({ settings, publication }) => acknowledge(captured, settings, publication),
        );
        if (!result.settings.on) return "Friends is set up. Sharing is off.";
        return result.publication
          ? "Friends is set up. Sharing is on and your card is saved."
          : "Friends is set up. Sharing is on; no card is shared until this device's progress is ready.";
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
        evictCheerPeer(peer);
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
