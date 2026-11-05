import { cleanName, PROFILE_GLYPHS } from "./profile";

export const FRIEND_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const FRIEND_LIMIT = 12;
export const BLOCK_LIMIT = 50;
export const INBOX_BATCH = 20;
export const REQUEST_COOLDOWN_MS = 10_000;
export const FRIENDS_REFRESH_MS = 5 * 60_000;

export type PublicIdentity = { n: string; g: string };
export type FriendsOwn = { code: string; deleting?: true };
export type FriendLink = { t: string; p: true } | ({ t: string } & PublicIdentity);
export type FriendRequest = { t: string; c: string } & PublicIdentity;
export type FriendshipState =
  | "absent"
  | "outgoing-pending"
  | "incoming-pending"
  | "crossing"
  | "final"
  | "inconsistent"
  | "unavailable";
export type FriendPeer = {
  uid: string;
  state: FriendshipState;
  name: string;
  glyph: string;
};
export type FriendsSnapshot = {
  own: FriendsOwn | null;
  peers: FriendPeer[];
  blocks: string[];
  fetchedAt: number;
  cached: boolean;
};
export type FriendsLocal = { v: 1; uid: string; publicName?: string };
export type FriendsCache = {
  v: 1;
  uid: string;
  links: FriendPeer[];
  fetchedAt: number;
};

export function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function isUid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    ![".", "#", "$", "[", "]", "/"].some((character) => value.includes(character)) &&
    [...value].every((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
  );
}

export function normalizeFriendCode(raw: string): string | null {
  const code = raw.toUpperCase().replace(/[\s-]/g, "");
  return /^[2-9A-HJKMNP-TV-Z]{10}$/.test(code) ? code : null;
}

export function groupedFriendCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

export function generateFriendCode(previous?: string): string {
  for (;;) {
    let code = "";
    while (code.length < 10) {
      const bytes = crypto.getRandomValues(new Uint8Array(20));
      for (const byte of bytes) {
        if (byte < 240) code += FRIEND_CODE_ALPHABET[byte % 30];
        if (code.length === 10) break;
      }
    }
    if (code !== previous) return code;
  }
}

/** Deliberately excludes email and resolveName's email fallback. */
export function publicName(typed: string | null, google: string | null): string | null {
  return cleanName(typed ?? "") || cleanName(google ?? "") || null;
}

export function publicGlyph(value: unknown): string {
  return PROFILE_GLYPHS.some((glyph) => glyph.id === value) ? String(value) : "";
}

function identity(value: Record<string, unknown>): PublicIdentity | null {
  const n = value["n"];
  const g = value["g"];
  return typeof n === "string" &&
    n.length > 0 &&
    n.length <= 24 &&
    cleanName(n) === n &&
    typeof g === "string" &&
    (g === "" || publicGlyph(g) === g)
    ? { n, g }
    : null;
}

const isDay = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function decodeOwn(value: unknown): FriendsOwn | null {
  if (value === null) return null;
  const row = record(value);
  const code = row?.["code"];
  if (
    !row ||
    typeof code !== "string" ||
    normalizeFriendCode(code) !== code ||
    Object.keys(row).some((key) => key !== "code" && key !== "deleting") ||
    (row["deleting"] !== undefined && row["deleting"] !== true)
  ) {
    throw new Error("Your Friends record is not supported. Cleanup or a newer app may be needed.");
  }
  return row["deleting"] === true ? { code, deleting: true } : { code };
}

export function decodeLink(value: unknown): FriendLink | null {
  const row = record(value);
  if (!row || !isDay(row["t"])) return null;
  if (row["p"] === true && Object.keys(row).every((key) => key === "t" || key === "p")) {
    return { t: row["t"], p: true };
  }
  const who = identity(row);
  return who && Object.keys(row).every((key) => ["t", "n", "g"].includes(key))
    ? { t: row["t"], ...who }
    : null;
}

export function decodeRequest(value: unknown): FriendRequest | null {
  const row = record(value);
  if (
    !row ||
    !isDay(row["t"]) ||
    typeof row["c"] !== "string" ||
    normalizeFriendCode(row["c"]) !== row["c"] ||
    Object.keys(row).some((key) => !["t", "n", "g", "c"].includes(key))
  ) {
    return null;
  }
  const who = identity(row);
  return who ? { ...who, t: row["t"], c: row["c"] } : null;
}

/** Null means an absent node; malformed records are never interpreted as absence. */
export function friendshipState(
  ownValue: unknown,
  reciprocalValue: unknown,
  incomingValue: unknown,
  sentValue: unknown,
  unavailable = false,
): FriendshipState {
  if (unavailable) return "unavailable";
  const own = decodeLink(ownValue);
  const reciprocal = decodeLink(reciprocalValue);
  const incoming = decodeRequest(incomingValue);
  const sent = decodeRequest(sentValue);
  if (
    (ownValue !== null && !own) ||
    (reciprocalValue !== null && !reciprocal) ||
    (incomingValue !== null && !incoming) ||
    (sentValue !== null && !sent)
  ) {
    return "inconsistent";
  }
  if (!own && !reciprocal && !incoming && !sent) return "absent";
  const ownPending = own && "p" in own;
  const peerPending = reciprocal && "p" in reciprocal;
  if (own && !ownPending && reciprocal && !peerPending && !incoming && !sent) return "final";
  if (ownPending && sent && peerPending && incoming) return "crossing";
  if (ownPending && sent && !reciprocal && !incoming) return "outgoing-pending";
  if (!own && !sent && peerPending && incoming) return "incoming-pending";
  return "inconsistent";
}

export function collection(value: unknown): Record<string, unknown> {
  if (value === null) return {};
  const rows = record(value);
  if (!rows || Object.keys(rows).some((key) => !isUid(key))) {
    throw new Error("Couldn't read the complete Friends collection. Nothing was treated as empty.");
  }
  return rows;
}

export function pairDeletionPaths(me: string, them: string): Record<string, null> {
  if (!isUid(me) || !isUid(them) || me === them) throw new Error("Invalid friend pair.");
  return Object.fromEntries(
    ["links", "inbox", "cheers"].flatMap((branch) => [
      [`${branch}/${me}/${them}`, null],
      [`${branch}/${them}/${me}`, null],
    ]),
  );
}

export function friendsDeletionPaths(
  uid: string,
  own: FriendsOwn | null,
  links: unknown,
  inbox: unknown,
  cheers: unknown,
  blocks: unknown,
): Record<string, null> {
  const paths: Record<string, null> = {};
  const peers = new Set([links, inbox, cheers].flatMap((rows) => Object.keys(collection(rows))));
  for (const peer of peers) Object.assign(paths, pairDeletionPaths(uid, peer));
  for (const peer of Object.keys(collection(blocks))) paths[`blocks/${uid}/${peer}`] = null;
  for (const branch of ["settings", "cards", "photos"]) paths[`${branch}/${uid}`] = null;
  if (own) paths[`codes/${own.code}`] = null;
  return paths;
}

export function decodeFriendsLocal(raw: string | null, uid: string): FriendsLocal | null {
  try {
    const row = record(JSON.parse(raw ?? "null") as unknown);
    if (row?.["v"] !== 1 || row["uid"] !== uid) return null;
    const name = row["publicName"];
    return {
      v: 1,
      uid,
      ...(typeof name === "string" && cleanName(name) ? { publicName: cleanName(name) } : {}),
    };
  } catch {
    return null;
  }
}

export function decodeFriendsCache(raw: string | null, uid: string): FriendsCache | null {
  try {
    const row = record(JSON.parse(raw ?? "null") as unknown);
    if (
      !row ||
      row["v"] !== 1 ||
      row["uid"] !== uid ||
      !Array.isArray(row["links"]) ||
      typeof row["fetchedAt"] !== "number" ||
      !Number.isFinite(row["fetchedAt"])
    ) {
      return null;
    }
    const links: FriendPeer[] = [];
    const states = [
      "outgoing-pending",
      "incoming-pending",
      "crossing",
      "final",
      "inconsistent",
      "unavailable",
    ];
    for (const value of row["links"]) {
      const peer = record(value);
      if (
        !peer ||
        !isUid(peer["uid"]) ||
        typeof peer["name"] !== "string" ||
        typeof peer["glyph"] !== "string" ||
        !states.includes(String(peer["state"]))
      ) {
        return null;
      }
      links.push({
        uid: peer["uid"],
        name: cleanName(peer["name"]),
        glyph: publicGlyph(peer["glyph"]),
        state: peer["state"] as FriendshipState,
      });
    }
    return { v: 1, uid, links, fetchedAt: row["fetchedAt"] };
  } catch {
    return null;
  }
}
