import { getDb } from "./firebase";
import {
  BLOCK_LIMIT,
  FRIEND_LIMIT,
  REQUEST_COOLDOWN_MS,
  collection,
  decodeLink,
  decodeOwn,
  decodeRequest,
  friendsDeletionPaths,
  friendshipState,
  generateFriendCode,
  isUid,
  normalizeFriendCode,
  pairDeletionPaths,
  publicGlyph,
  publicName,
  record,
  buildFriendPublication,
  decodeDecoration,
  decodeFriendCard,
  decodeFriendPhoto,
  decodeFriendSettings,
  newFriendRevision,
  FRIEND_SCHEMA_VERSION,
  UnsupportedFriendSettingsError,
  type FriendCardSource,
  type FriendCardState,
  type FriendDecoration,
  type FriendPublication,
  type FriendSettings,
  type FriendPeer,
  type FriendsSnapshot,
  type PublicIdentity,
} from "./friends";
import { STORAGE_KEYS } from "./storage";
import { localDay } from "./word-memory";
import {
  decodeBannerAsset,
  decodeBannerDraft,
  decodePublicBanner,
  isBannerId,
  sameBannerImage,
  type BannerAsset,
  type BannerEdit,
} from "./friend-banner";

const TIMEOUT_MS = 20_000;
const PENDING_COPY = "The request may still be processing. Reconnect to check its status.";
type Token = { uid: string; generation: number };
type Session = {
  pending: Promise<unknown> | null;
  uncertain: boolean;
  deleting: boolean;
  lastRequest: number;
  outcome: string | null;
};
let active: Token | null = null;
let generation = 0;
const sessions = new Map<string, Session>();
const subscribers = new Set<() => void>();

export class FriendsError extends Error {
  constructor(
    message: string,
    readonly kind = "operation",
  ) {
    super(message);
    this.name = "FriendsError";
  }
}

export function isFriendsUncertain(error: unknown): boolean {
  return error instanceof FriendsError && error.kind === "uncertain";
}

export function isFriendsDenied(error: unknown): boolean {
  const code = record(error)?.["code"];
  return (
    (error instanceof FriendsError && error.kind === "denied") ||
    String(code ?? "")
      .toLowerCase()
      .includes("permission")
  );
}

export function describeFriendsError(error: unknown): string {
  if (error instanceof UnsupportedFriendSettingsError) return error.message;
  if (error instanceof FriendsError) return error.message;
  return "Couldn't access Friends. Try again or check the setup.";
}

function notify(): void {
  for (const subscriber of subscribers) subscriber();
}

export function subscribeFriends(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function clearFriendsStorage(uid?: string, preserveBanner = false): void {
  if (typeof window === "undefined") return;
  for (const key of [
    STORAGE_KEYS.friends,
    STORAGE_KEYS.friendsCache,
    STORAGE_KEYS.friendBannerDraft,
  ]) {
    if (preserveBanner && key === STORAGE_KEYS.friendBannerDraft) continue;
    try {
      const raw = localStorage.getItem(key);
      const row = record(JSON.parse(raw ?? "null") as unknown);
      if (!uid || !row || row["uid"] === uid) localStorage.removeItem(key);
    } catch {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Storage may be disabled. */
      }
    }
  }
}

/** Called only by the mounted controller, from the existing account context. */
export function setFriendsAccount(uid: string | null): void {
  if (active?.uid === uid) return;
  if (active) {
    clearFriendsStorage();
  } else {
    // Reload may reuse this account's own draft/cache, never another account's bucket.
    for (const key of [
      STORAGE_KEYS.friends,
      STORAGE_KEYS.friendsCache,
      STORAGE_KEYS.friendBannerDraft,
    ]) {
      try {
        const row = record(JSON.parse(localStorage.getItem(key) ?? "null") as unknown);
        if (row?.["uid"] !== uid || (uid === null && key === STORAGE_KEYS.friendsCache))
          localStorage.removeItem(key);
      } catch {
        /* Optional device storage. */
      }
    }
  }
  if (!active && !uid) return;
  active = uid ? { uid, generation: ++generation } : null;
  generation++;
  notify();
}

function session(uid: string): Session {
  let value = sessions.get(uid);
  if (!value) {
    value = { pending: null, uncertain: false, deleting: false, lastRequest: 0, outcome: null };
    sessions.set(uid, value);
  }
  return value;
}

export function friendsActivity(uid: string | null) {
  const value = uid ? session(uid) : null;
  return {
    busy: Boolean(value?.pending),
    uncertain: value?.uncertain ?? false,
    deleting: value?.deleting ?? false,
    outcome: value?.outcome ?? null,
  };
}

function tokenFor(uid: string): Token {
  if (!active || active.uid !== uid || !isUid(uid)) {
    throw new FriendsError("The signed-in account changed. Open Friends again.", "account");
  }
  return active;
}

function assertCurrent(token: Token): void {
  if (active !== token) throw new FriendsError("The signed-in account changed.", "account");
}

function online(): void {
  if (navigator.onLine === false) {
    throw new FriendsError("You're offline. Reconnect to use Friends.", "offline");
  }
}

function bounded<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new FriendsError(PENDING_COPY, "uncertain")), TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** REST GET avoids the SDK get() offline-cache fallback during reconciliation. Writes use the SDK. */
async function read(token: Token, path: string): Promise<unknown> {
  assertCurrent(token);
  online();
  const { db, mod, token: idToken } = await getDb(token.uid);
  assertCurrent(token);
  const base = mod.ref(db).toString();
  const url = new URL(`friends/${path.split("/").map(encodeURIComponent).join("/")}.json`, base);
  url.searchParams.set("auth", idToken);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { cache: "no-store", signal: abort.signal });
    assertCurrent(token);
    if (response.status === 401 || response.status === 403) {
      throw new FriendsError("Couldn't access Friends. Try again or check the setup.", "denied");
    }
    if (!response.ok) {
      throw new FriendsError("Couldn't reach Friends. Reconnect and try again.", "network");
    }
    const value: unknown = await response.json();
    assertCurrent(token);
    return value;
  } finally {
    clearTimeout(timer);
  }
}

async function update(
  token: Token,
  paths: Record<string, unknown>,
  canCommit: () => boolean = () => true,
): Promise<void> {
  assertCurrent(token);
  online();
  const { db, mod } = await getDb(token.uid);
  assertCurrent(token);
  if (!canCommit())
    throw new FriendsError(
      "Your progress changed or is still syncing. Review it before updating your card.",
    );
  const rootPaths = Object.fromEntries(
    Object.entries(paths).map(([path, value]) => [`friends/${path}`, value]),
  );
  // mutate() owns this promise even when its caller times out.
  await mod.update(mod.ref(db), rootPaths);
  assertCurrent(token);
}

function mutate<T>(uid: string, job: (token: Token) => Promise<T>, deletion = false): Promise<T> {
  const token = tokenFor(uid);
  const state = session(uid);
  if (state.pending) {
    return Promise.reject(
      new FriendsError(
        state.uncertain
          ? PENDING_COPY
          : "A Friends request is already running. Wait for it to finish.",
        "uncertain",
      ),
    );
  }
  if (state.deleting && !deletion) {
    return Promise.reject(new FriendsError("Finish deleting cloud data before using Friends."));
  }
  state.outcome = null;
  state.uncertain = false;
  const promise = Promise.resolve().then(() => job(token));
  state.pending = promise;
  notify();
  const settled = (error?: unknown) => {
    const wasUncertain = state.uncertain;
    if (state.pending === promise) {
      state.pending = null;
      state.uncertain = false;
      if (wasUncertain) {
        state.outcome = error
          ? describeFriendsError(error)
          : "The Friends request finished. Refresh to see its current status.";
      }
    }
    if (active?.uid === uid) {
      if (active !== token) {
        state.outcome = "An earlier Friends request finished. Refresh to see its current status.";
      }
      notify();
    }
  };
  void promise.then(
    () => settled(),
    (error: unknown) => settled(error),
  );
  return bounded(promise).catch((error: unknown) => {
    if (isFriendsUncertain(error) && state.pending === promise) {
      state.uncertain = true;
      notify();
    }
    throw error;
  });
}

function validateIdentity(who: PublicIdentity): PublicIdentity {
  const n = publicName(who.n, null);
  if (!n) throw new FriendsError("Choose a public name first.");
  return { n, g: publicGlyph(who.g) };
}

async function requireSetup(token: Token): Promise<void> {
  const own = decodeOwn(await read(token, `own/${token.uid}`));
  if (own?.deleting) {
    if (!session(token.uid).deleting) {
      session(token.uid).deleting = true;
      notify();
    }
    throw new FriendsError("Finish deleting cloud data before using Friends.");
  }
  if (!own) throw new FriendsError("Set up friends first.");
}

async function pair(token: Token, peer: string) {
  if (!isUid(peer) || peer === token.uid) throw new FriendsError("That is your own code.");
  const me = token.uid;
  const [own, reciprocal, incoming, sent] = await Promise.all([
    read(token, `links/${me}/${peer}`),
    read(token, `links/${peer}/${me}`),
    read(token, `inbox/${me}/${peer}`),
    read(token, `inbox/${peer}/${me}`),
  ]);
  return {
    own,
    reciprocal,
    incoming,
    sent,
    state: friendshipState(own, reciprocal, incoming, sent),
  };
}

export async function fetchFriends(
  uid: string,
  cachedCards: Record<string, FriendCardState> = {},
): Promise<FriendsSnapshot> {
  const token = tokenFor(uid);
  const own = decodeOwn(await read(token, `own/${uid}`));
  if (own?.deleting) {
    if (!session(uid).deleting) {
      session(uid).deleting = true;
      notify();
    }
    clearFriendsStorage(uid);
    return { own, peers: [], blocks: [], fetchedAt: Date.now(), cached: false };
  }
  if (!own) return { own: null, peers: [], blocks: [], fetchedAt: Date.now(), cached: false };
  const [linksValue, inboxValue, blocksValue] = await Promise.all([
    read(token, `links/${uid}`),
    read(token, `inbox/${uid}`),
    read(token, `blocks/${uid}`),
  ]);
  const links = collection(linksValue);
  const inbox = collection(inboxValue);
  const blocks = collection(blocksValue);
  if (Object.values(blocks).some((value) => value !== true)) {
    throw new FriendsError("Your block list needs cleanup before it can be used.");
  }
  const peers = await Promise.all(
    [...new Set([...Object.keys(links), ...Object.keys(inbox)])].map(
      async (peer): Promise<FriendPeer> => {
        const ownLink = decodeLink(links[peer] ?? null);
        const incoming = decodeRequest(inbox[peer] ?? null);
        const name = incoming?.n ?? (ownLink && "n" in ownLink ? ownLink.n : "Person you invited");
        const glyph = incoming?.g ?? (ownLink && "g" in ownLink ? ownLink.g : "");
        if (blocks[peer] === true) return { uid: peer, state: "unavailable", name, glyph };
        try {
          const [reciprocal, sent] = await Promise.all([
            read(token, `links/${peer}/${uid}`),
            read(token, `inbox/${peer}/${uid}`),
          ]);
          return {
            uid: peer,
            name,
            glyph,
            state: friendshipState(links[peer] ?? null, reciprocal, inbox[peer] ?? null, sent),
          };
        } catch (error) {
          if (!isFriendsDenied(error)) throw error;
          return { uid: peer, state: "unavailable", name, glyph };
        }
      },
    ),
  );
  const cards: Record<string, FriendCardState> = {};
  await Promise.all(
    peers.map(async (peer) => {
      if (peer.state !== "final") return;
      try {
        cards[peer.uid] = decodeFriendCard(await read(token, `cards/${peer.uid}`));
      } catch (error) {
        if (isFriendsDenied(error)) {
          peer.state = "unavailable";
          cards[peer.uid] = { kind: "unavailable", cached: false, fetchedAt: Date.now() };
        } else {
          const cached = cachedCards[peer.uid];
          cards[peer.uid] =
            cached?.kind === "published"
              ? { ...cached, cached: true }
              : { kind: "unavailable", cached: true, fetchedAt: Date.now() };
        }
      }
    }),
  );
  assertCurrent(token);
  return { own, peers, blocks: Object.keys(blocks), fetchedAt: Date.now(), cached: false, cards };
}

/** A denied read is never a collision. Only an occupied candidate permits another candidate. */
export function setupFriends(uid: string): Promise<string> {
  return changeCode(uid, false);
}

export function rotateFriendCode(uid: string): Promise<string> {
  return changeCode(uid, true);
}

function changeCode(uid: string, rotate: boolean): Promise<string> {
  return mutate(uid, async (token) => {
    const own = decodeOwn(await read(token, `own/${uid}`));
    if (own?.deleting) throw new FriendsError("Finish deleting cloud data before using Friends.");
    if (own && !rotate) return own.code;
    if (!own && rotate) throw new FriendsError("Set up friends first.");
    for (let collisions = 0; collisions < 5; collisions++) {
      const code = generateFriendCode(own?.code);
      if ((await read(token, `codes/${code}`)) !== null) continue;
      const paths: Record<string, unknown> = {
        [`own/${uid}`]: { code },
        [`codes/${code}`]: { u: uid },
      };
      if (own) paths[`codes/${own.code}`] = null;
      try {
        await update(token, paths);
        return code;
      } catch (error) {
        // Reconcile competing setup/rotation; never replay stale intent or overwrite it.
        const current = decodeOwn(await read(token, `own/${uid}`));
        if (current?.deleting) {
          throw new FriendsError("Finish deleting cloud data before using Friends.");
        }
        if (current && current.code !== own?.code) {
          throw new FriendsError(
            "Your code changed on another device. Refresh to see the current code.",
          );
        }
        const candidate = record(await read(token, `codes/${code}`));
        if (candidate && candidate["u"] !== uid) continue;
        throw error;
      }
    }
    throw new FriendsError("Couldn't find an unused code. Try setup or rotation again.");
  });
}

export type RequestResult = {
  kind: "sent" | "already-friends" | "already-sent" | "incoming";
  peer: string;
};

export function requestFriend(
  uid: string,
  rawCode: string,
  identity: PublicIdentity,
): Promise<RequestResult> {
  return mutate(uid, async (token) => {
    const who = validateIdentity(identity);
    const code = normalizeFriendCode(rawCode);
    if (!code) {
      throw new FriendsError("Enter a ten-character friend code, such as K7F2M-9XQ4T.");
    }
    await requireSetup(token);
    const match = record(await read(token, `codes/${code}`));
    if (!match || !isUid(match["u"])) {
      throw new FriendsError("No active friend code found. Ask them for their current code.");
    }
    const peer = match["u"];
    if (peer === uid) throw new FriendsError("That is your own code.");
    const blocks = collection(await read(token, `blocks/${uid}`));
    if (blocks[peer] === true) {
      throw new FriendsError("Unblock this person before sending a request.");
    }
    let current;
    try {
      current = await pair(token, peer);
    } catch (error) {
      if (isFriendsDenied(error)) {
        throw new FriendsError(
          "Not connected. Ask them for their current code or try again later.",
        );
      }
      throw error;
    }
    if (current.state === "final") return { kind: "already-friends", peer };
    if (current.state === "incoming-pending" || current.state === "crossing") {
      return { kind: "incoming", peer };
    }
    if (current.state === "outgoing-pending") return { kind: "already-sent", peer };
    if (current.state !== "absent") {
      throw new FriendsError(
        "Not connected. Remove this connection before sending another request.",
      );
    }
    const links = await read(token, `links/${uid}`);
    if (Object.keys(collection(links)).length >= FRIEND_LIMIT) {
      throw new FriendsError(
        "Your friends list is full. Remove a friend or cancel an outgoing request first.",
      );
    }
    const state = session(uid);
    if (Date.now() - state.lastRequest < REQUEST_COOLDOWN_MS) {
      throw new FriendsError("Wait ten seconds between requests.");
    }
    state.lastRequest = Date.now();
    const t = localDay();
    await update(token, {
      [`links/${uid}/${peer}`]: { t, p: true },
      [`inbox/${peer}/${uid}`]: { t, ...who, c: code },
    });
    return { kind: "sent", peer };
  });
}

export function acceptFriend(uid: string, peer: string, identity: PublicIdentity): Promise<void> {
  return mutate(uid, async (token) => {
    const who = validateIdentity(identity);
    await requireSetup(token);
    const current = await pair(token, peer);
    if (current.state === "final") return; // Acknowledged or authoritatively reconciled accept.
    if (current.state !== "incoming-pending" && current.state !== "crossing") {
      throw new FriendsError("This request is no longer available. Refresh Friends.");
    }
    const request = decodeRequest(current.incoming);
    if (!request) throw new FriendsError("This request could not be read. Remove it instead.");
    const links = collection(await read(token, `links/${uid}`));
    if (Object.keys(links).length + (links[peer] === undefined ? 1 : 0) > FRIEND_LIMIT) {
      throw new FriendsError(
        "Your friends list is full. Remove a friend or cancel an outgoing request first.",
      );
    }
    const t = localDay();
    await update(token, {
      [`links/${uid}/${peer}`]: { t, n: request.n, g: request.g },
      [`links/${peer}/${uid}`]: { t, ...who },
      [`inbox/${uid}/${peer}`]: null,
      [`inbox/${peer}/${uid}`]: null,
    });
  });
}

export function removeFriend(uid: string, peer: string, block = false): Promise<void> {
  return mutate(uid, async (token) => {
    const paths: Record<string, unknown> = pairDeletionPaths(uid, peer);
    if (block) {
      await requireSetup(token);
      const blocks = collection(await read(token, `blocks/${uid}`));
      if (blocks[peer] !== true && Object.keys(blocks).length >= BLOCK_LIMIT) {
        throw new FriendsError("Your block list is full. Manage blocked people first.");
      }
      paths[`blocks/${uid}/${peer}`] = true;
    }
    await update(token, paths);
  });
}

export function unblockFriend(uid: string, peer: string): Promise<void> {
  return mutate(uid, async (token) => {
    if (!isUid(peer) || peer === uid) throw new FriendsError("Invalid blocked person.");
    await update(token, { [`blocks/${uid}/${peer}`]: null });
  });
}

/** Steps 1–3; the existing lesson-cloud deletion must be acknowledged before finish(). */
export async function deleteFriendsData(uid: string): Promise<void> {
  const token = tokenFor(uid);
  const state = session(uid);
  state.deleting = true;
  notify();
  if (state.pending) {
    try {
      await bounded(state.pending);
    } catch (error) {
      if (isFriendsUncertain(error)) throw error;
    }
    assertCurrent(token);
  }
  state.deleting = true;
  await mutate(
    uid,
    async (operationToken) => {
      let own = decodeOwn(await read(operationToken, `own/${uid}`));
      if (own && !own.deleting) {
        await update(operationToken, {
          [`own/${uid}/deleting`]: true,
          [`codes/${own.code}`]: null,
        });
        own = { ...own, deleting: true };
      }
      const [links, inbox, cheers, blocks] = await Promise.all([
        read(operationToken, `links/${uid}`),
        read(operationToken, `inbox/${uid}`),
        read(operationToken, `cheers/${uid}`),
        read(operationToken, `blocks/${uid}`),
      ]);
      await update(operationToken, friendsDeletionPaths(uid, own, links, inbox, cheers, blocks));
      clearFriendsStorage(uid);
    },
    true,
  );
}

export async function finishFriendsDeletion(uid: string): Promise<void> {
  await mutate(
    uid,
    async (token) => {
      await update(token, { [`own/${uid}`]: null });
      clearFriendsStorage(uid);
      session(uid).deleting = false;
    },
    true,
  );
  notify();
}

const SETTINGS_CONFLICT =
  "Your sharing settings changed on another device. Review them before saving.";
export type SharingRead = { settings: FriendSettings | null; card: FriendCardState };
export type SharingEdit = {
  on?: boolean;
  photo?: boolean;
  n?: string;
  deco?: FriendDecoration;
  banner?: BannerEdit;
};
export type SharingSave = {
  settings: FriendSettings;
  publication: FriendPublication | null;
  bannerAsset?: BannerAsset | null;
};

export async function readFriendSharing(uid: string): Promise<SharingRead> {
  const token = tokenFor(uid);
  await requireSetup(token);
  const [settings, card] = await Promise.all([
    read(token, `settings/${uid}`),
    read(token, `cards/${uid}`),
  ]);
  return { settings: decodeFriendSettings(settings), card: decodeFriendCard(card) };
}

async function publicationPaths(
  token: Token,
  publication: FriendPublication | null,
  assetChange?: BannerAsset | null,
) {
  const { mod } = await getDb(token.uid);
  assertCurrent(token);
  const paths: Record<string, unknown> = {
    [`cards/${token.uid}`]: publication ? { ...publication.card, t: mod.serverTimestamp() } : null,
    [`photos/${token.uid}`]: publication?.photo ?? null,
  };
  const id = publication?.card.bannerId;
  if (!id) paths[`banners/${token.uid}`] = null;
  else if (assetChange && assetChange.id === id)
    paths[`banners/${token.uid}`] = { id, data: assetChange.data };
  else {
    // Reuse an unchanged published crop. Stats updates never read/upload its large source.
    const publicId = await read(token, `banners/${token.uid}/id`);
    if (publicId !== id) {
      const [privateId, data] = await Promise.all([
        read(token, `bannerAssets/${token.uid}/id`),
        read(token, `bannerAssets/${token.uid}/data`),
      ]);
      const banner = decodePublicBanner({ id: privateId, data });
      if (!banner || banner.id !== id)
        throw new FriendsError(
          "Your saved banner changed. Refresh Friends and review the look before saving.",
          "conflict",
        );
      paths[`banners/${token.uid}`] = banner;
    }
  }
  if (assetChange !== undefined) paths[`bannerAssets/${token.uid}`] = assetChange;
  return paths;
}

export function saveFriendSharing(
  uid: string,
  expectedRevision: string | null,
  edit: SharingEdit,
  source: () => FriendCardSource | null,
  requireReady = false,
  onAcknowledged?: (result: SharingSave) => void,
): Promise<SharingSave> {
  return mutate(uid, async (token) => {
    await requireSetup(token);
    const current = decodeFriendSettings(await read(token, `settings/${uid}`));
    if ((current?.rev ?? null) !== expectedRevision)
      throw new FriendsError(SETTINGS_CONFLICT, "conflict");
    const n = publicName(edit.n ?? current?.n ?? "", null);
    if (!n) throw new FriendsError("Choose a public name first.");
    let deco = decodeDecoration(edit.deco ?? current?.deco ?? { fr: "plain", fx: "none" });
    if (!deco) throw new FriendsError("Choose supported decorations before saving.");
    let assetChange: BannerAsset | null | undefined;
    let selectedAsset: BannerAsset | null = null;
    if (edit.banner?.kind === "remove") {
      const { bannerId: _old, ...rest } = deco;
      deco = rest;
      assetChange = null;
    } else if (edit.banner?.kind === "upload") {
      const candidate = decodeBannerDraft(edit.banner.draft, uid);
      if (!candidate || !candidate.selected)
        throw new FriendsError("Choose this account's banner before saving.");
      const rawAsset = await read(token, `bannerAssets/${uid}`);
      let oldAsset: BannerAsset | null = null;
      try {
        oldAsset = decodeBannerAsset(rawAsset);
      } catch {
        /* An explicit replacement can replace malformed legacy data. The read itself succeeded. */
      }
      if (oldAsset && sameBannerImage(oldAsset, candidate)) selectedAsset = oldAsset;
      else {
        let id = newFriendRevision();
        while (id === record(rawAsset)?.["id"]) id = newFriendRevision();
        selectedAsset = {
          id,
          source: candidate.source,
          data: candidate.data,
          crop: candidate.crop,
        };
        assetChange = selectedAsset;
      }
      const { bk: _builtIn, bannerId: _old, ...rest } = deco;
      deco = { ...rest, bannerId: selectedAsset.id };
    }
    const on = edit.on ?? current?.on ?? false;
    const snapshot = on ? source() : null;
    if (on && requireReady && !snapshot)
      throw new FriendsError("Wait for progress to finish loading or syncing, then try again.");
    const settings: FriendSettings = {
      v: FRIEND_SCHEMA_VERSION,
      rev: newFriendRevision(),
      prev: current?.rev ?? "",
      on,
      photo: on ? (edit.photo ?? current?.photo ?? false) : false,
      n,
      deco,
      ...(current?.since
        ? { since: current.since }
        : on
          ? { since: snapshot?.day ?? localDay() }
          : {}),
    };
    const publication = snapshot ? buildFriendPublication(settings, snapshot) : null;
    const paths = {
      [`settings/${uid}`]: settings,
      ...(await publicationPaths(token, publication, assetChange)),
    };
    try {
      await update(token, paths, () => {
        if (!publication) return true;
        const latest = source();
        return latest !== null && buildFriendPublication(settings, latest).fp === publication.fp;
      });
    } catch (error) {
      // A rejected CAS is reconciled, never replayed with a newer consent revision.
      const latest = decodeFriendSettings(await read(token, `settings/${uid}`));
      if ((latest?.rev ?? null) !== expectedRevision)
        throw new FriendsError(SETTINGS_CONFLICT, "conflict");
      throw error;
    }
    const result: SharingSave = {
      settings,
      publication,
      ...(assetChange !== undefined
        ? { bannerAsset: assetChange }
        : selectedAsset
          ? { bannerAsset: selectedAsset }
          : {}),
    };
    if (!session(uid).deleting) onAcknowledged?.(result);
    return result;
  });
}

/** Ordinary publishing cannot create or change settings, consent or a revision. */
export function publishFriendCard(
  uid: string,
  expectedRevision: string,
  source: () => FriendCardSource | null,
  onAcknowledged?: (publication: FriendPublication) => void,
): Promise<FriendPublication> {
  return mutate(uid, async (token) => {
    await requireSetup(token);
    const settings = decodeFriendSettings(await read(token, `settings/${uid}`));
    if (!settings || settings.rev !== expectedRevision)
      throw new FriendsError(SETTINGS_CONFLICT, "conflict");
    if (!settings.on) throw new FriendsError("Sharing is off. Turn it on to share your card.");
    const snapshot = source();
    if (!snapshot)
      throw new FriendsError(
        "Your progress is not ready for this account. Use this device's progress or finish syncing first.",
      );
    const publication = buildFriendPublication(settings, snapshot);
    await update(token, await publicationPaths(token, publication), () => {
      const latest = source();
      return latest !== null && buildFriendPublication(settings, latest).fp === publication.fp;
    });
    if (!session(uid).deleting) onAcknowledged?.(publication);
    return publication;
  });
}

/** Called only after the UI selects a published ph=true card. No background photo reads. */
export async function readFriendPhoto(uid: string, peer: string, revision: string) {
  const token = tokenFor(uid);
  if (!isUid(peer)) throw new FriendsError("Not connected.");
  const photo = decodeFriendPhoto(await read(token, `photos/${peer}`));
  if (!photo || photo.rev !== revision) return { kind: "refresh" as const };
  return { kind: "photo" as const, photo };
}

/** Private retained source is fetched only when the owner opens the banner editor. */
export async function readOwnerBannerAsset(uid: string): Promise<BannerAsset | null> {
  const token = tokenFor(uid);
  await requireSetup(token);
  return decodeBannerAsset(await read(token, `bannerAssets/${uid}`));
}

/** Selected visible card only; this response never includes source or crop. */
export async function readFriendBanner(uid: string, peer: string, id: string) {
  const token = tokenFor(uid);
  if (!isUid(peer) || !isBannerId(id)) throw new FriendsError("Not connected.");
  const raw = await read(token, `banners/${peer}`);
  const banner = decodePublicBanner(raw);
  return banner && banner.id === id
    ? { kind: "banner" as const, banner }
    : { kind: raw === null ? ("missing" as const) : ("mismatch" as const) };
}
