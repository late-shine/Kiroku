import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Account } from "@/lib/firebase";
import {
  FRIENDS_REFRESH_MS,
  decodeFriendsCache,
  decodeFriendsLocal,
  normalizeFriendCode,
  publicGlyph,
  publicName,
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
} from "@/lib/friends-db";
import { useProfile } from "@/components/profile/useProfile";
import { STORAGE_KEYS } from "@/lib/storage";

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
      ? { own: null, peers: cache.links, blocks: [], fetchedAt: cache.fetchedAt, cached: true }
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
}: {
  account: Account | null;
  resolved: boolean;
  configured: boolean;
  onOpenProfile: () => void;
}) {
  const uid = configured ? (account?.uid ?? null) : null;
  const { profile } = useProfile();
  const [view, setView] = useState<View>(() => emptyView(null));
  const [activity, setActivity] = useState(() => friendsActivity(null));
  const [invite, setInvite] = useState<string | null>(null);
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
      const snapshot = await fetchFriends(uid);
      if (current.current !== captured || sequence !== readSequence.current) return;
      lastRefresh.current = Date.now();
      isSetUp.current = Boolean(snapshot.own && !snapshot.own.deleting);
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
        clearFriendsStorage(uid);
      }
      setView((value) => ({ ...value, uid, snapshot, loading: false, error: null }));
    } catch (error) {
      if (current.current !== captured || sequence !== readSequence.current) return;
      if (isFriendsDenied(error)) {
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
      if (current.current === captured && sequence === readSequence.current) refreshing.current = false;
    }
  }, [uid]);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!resolved) return;
    setFriendsAccount(uid);
    const captured = uid ? { uid, generation: ++generation.current } : null;
    current.current = captured;
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
      ++readSequence.current;
      setFriendsAccount(null);
    };
  }, [uid, resolved]);

  useEffect(() => {
    if (!uid) return;
    const onFocus = () => {
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

  const rememberIdentity = (identity: PublicIdentity) => {
    if (!uid) return;
    const name = publicName(identity.n, null);
    if (!name) return;
    try {
      localStorage.setItem(STORAGE_KEYS.friends, JSON.stringify({ v: 1, uid, publicName: name }));
    } catch {
      /* A device draft is optional. */
    }
    setView((value) => ({ ...value, publicName: name }));
  };

  const perform = async (job: () => Promise<string>, identity?: PublicIdentity) => {
    const captured = current.current;
    if (!uid || captured?.uid !== uid) return false;
    if (friendsActivity(uid).busy || friendsActivity(uid).deleting) return false;
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
    ownView.publicName ?? publicName(profile.name, account?.displayName ?? null) ?? "";
  return {
    ...ownView,
    uid,
    available: Boolean(uid && configured),
    activity: view.uid === uid ? activity : friendsActivity(uid),
    invite: uid ? invite : null,
    suggestedName,
    glyph: publicGlyph(profile.glyph),
    blockedName: (peer: string) => closedCovers.current.get(peer)?.name ?? "Blocked person",
    clearInvite: () => setInvite(null),
    refresh,
    setup: (identity: PublicIdentity) =>
      perform(async () => {
        if (!publicName(identity.n, null)) throw new FriendsError("Choose a public name first.");
        await setupFriends(uid!);
        return "Friends is set up. Progress sharing stays off.";
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
        return "Request sent. Progress sharing stays off.";
      }, identity),
    accept: (peer: string, identity: PublicIdentity) =>
      perform(async () => {
        await acceptFriend(uid!, peer, identity);
        return "You are friends. Progress sharing stays off.";
      }, identity),
    remove: (peer: string, block = false) =>
      perform(async () => {
        await removeFriend(uid!, peer, block);
        return block ? "Person blocked and connection removed." : "Connection and requests removed.";
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
