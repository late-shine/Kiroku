import { cleanName, isAvatarDataUrl, PROFILE_GLYPHS } from "./profile";
import { resolveAccent, resolveStamp, type QuestPrefs } from "./quest-prefs";
import { BADGES } from "./rewards";
import { profileStats } from "./writing-stats";
import type { DayLesson, UserProgressState } from "@/types/japanese";

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
  cards?: Record<string, FriendCardState>;
};
export type FriendsLocal = {
  v: 1;
  uid: string | null;
  publicName?: string;
  decoDraft?: FriendDecoration;
  publishSourceUid?: string;
  publishedAt?: number;
  fp?: string;
};
export type FriendsCache = {
  v: 1;
  uid: string;
  links: FriendPeer[];
  fetchedAt: number;
  cards?: Record<string, FriendCardState>;
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

export function decodeFriendsLocal(raw: string | null, uid: string | null): FriendsLocal | null {
  try {
    const row = record(JSON.parse(raw ?? "null") as unknown);
    if (row?.["v"] !== 1 || row["uid"] !== uid) return null;
    const name = row["publicName"];
    const decoDraft = decodeDecoration(row["decoDraft"], true);
    return {
      v: 1,
      uid,
      ...(typeof name === "string" && cleanName(name) ? { publicName: cleanName(name) } : {}),
      ...(decoDraft ? { decoDraft } : {}),
      ...(uid !== null && row["publishSourceUid"] === uid ? { publishSourceUid: uid } : {}),
      ...(typeof row["publishedAt"] === "number" && Number.isFinite(row["publishedAt"])
        ? { publishedAt: row["publishedAt"] }
        : {}),
      ...(typeof row["fp"] === "string" ? { fp: row["fp"] } : {}),
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
    const cards: Record<string, FriendCardState> = {};
    for (const [peer, value] of Object.entries(record(row["cards"]) ?? {})) {
      const entry = record(value);
      if (!isUid(peer) || !entry || entry["kind"] !== "published") continue;
      const decoded = decodeFriendCard(entry["card"]);
      if (decoded.kind === "published") {
        const fetchedAt = entry["fetchedAt"];
        cards[peer] = {
          ...decoded,
          cached: true,
          fetchedAt:
            typeof fetchedAt === "number" && Number.isFinite(fetchedAt) && fetchedAt >= 0
              ? fetchedAt
              : row["fetchedAt"],
        };
      }
    }
    return { v: 1, uid, links, fetchedAt: row["fetchedAt"], cards };
  } catch {
    return null;
  }
}

export const FRIEND_FRAMES = ["plain", "gold", "stitch", "moss", "double", "seal"] as const;
export const FRIEND_EFFECTS = ["none", "vines", "petals", "fireflies"] as const;
export const FRIEND_TAGS = ["n5", "n4", "n3", "n2", "n1", "kanji", "self", "reading"] as const;
export const FRIEND_STATUSES = ["adding", "reviewing", "writing", "carving", "quiet"] as const;
export const FRIEND_SCHEMA_VERSION = 2;
export const MAX_STATUS_LENGTH = 60;
export class UnsupportedFriendSettingsError extends Error {
  constructor() {
    super("Update Kiroku to edit this card");
    this.name = "UnsupportedFriendSettingsError";
  }
}
export function normalizeStatusInput(value: string): string {
  return value.replace(/[\r\n\t\u2028\u2029]/g, " ").replace(/\s+/g, " ");
}
export function validStatusInput(value: string): boolean {
  if (value.length > MAX_STATUS_LENGTH) return false;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit < 32 || (unit >= 127 && unit <= 159)) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
  }
  return true;
}
export function canonicalStatus(value: unknown): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    validStatusInput(value) &&
    normalizeStatusInput(value).trim() === value
    ? value
    : null;
}
const decoKeys = ["fr", "fx", "bk", "tg", "sb", "pin", "statusText"];
function validSavedStatus(row: Record<string, unknown>, version: number): boolean {
  return (
    row["statusText"] === undefined ||
    (version >= 2 && canonicalStatus(row["statusText"]) !== null && row["sb"] === undefined)
  );
}
export type FriendDecoration = {
  fr: (typeof FRIEND_FRAMES)[number];
  fx: (typeof FRIEND_EFFECTS)[number];
  bk?: number;
  tg?: (typeof FRIEND_TAGS)[number];
  sb?: (typeof FRIEND_STATUSES)[number];
  statusText?: string;
  pin?: string;
};
export type FriendSettings = {
  v: 1 | 2;
  rev: string;
  prev: string;
  on: boolean;
  photo: boolean;
  n: string;
  since?: string;
  deco: FriendDecoration;
};
export type FriendCard = {
  v: 1 | 2;
  rev: string;
  ph: boolean;
  t: number | null;
  d: string;
  n: string;
  g: string;
  r: number;
  c: number;
  s: number;
  m: number;
  l: number;
  k: number;
  vc: number;
  a: string;
  w: string;
  bd?: Record<string, string>;
  pin?: string;
  acc: "amber" | "sakura" | "moss" | "sky";
  st: "ink" | "moss" | "paper";
  fr: FriendDecoration["fr"];
  fx: FriendDecoration["fx"];
  bk?: number;
  tg?: FriendDecoration["tg"];
  sb?: FriendDecoration["sb"];
  statusText?: string;
  sh: string;
};
export type FriendPhoto = { rev: string; data: string };
export type FriendCardState = (
  | { kind: "published"; card: FriendCard }
  | { kind: "closed" | "unavailable" | "unsupported" | "invalid" }
) & { cached: boolean; fetchedAt: number };
export type FriendCardSource = {
  stats: ReturnType<typeof profileStats>;
  badges: Record<string, string>;
  g: string;
  photo: string | null;
  acc: FriendCard["acc"];
  st: FriendCard["st"];
  day: string;
};
export type FriendPublication = {
  card: Omit<FriendCard, "t">;
  photo: FriendPhoto | null;
  fp: string;
};

const revisionValid = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
const knownBadges = new Set(BADGES.map((badge) => badge.id));
const dayValid = (value: unknown): value is string => {
  if (!isDay(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
function member<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}
function pins(value: unknown, earned?: Readonly<Record<string, string>>): string | undefined {
  if (typeof value !== "string") return undefined;
  const ids = [...new Set(value.split(","))].filter(
    (id) => knownBadges.has(id) && (!earned || earned[id]),
  );
  return ids.length ? ids.slice(0, 3).join(",") : undefined;
}
export function decodeDecoration(value: unknown, draft = false): FriendDecoration | null {
  const row = record(value);
  if (!row || !member(row["fr"], FRIEND_FRAMES) || !member(row["fx"], FRIEND_EFFECTS)) return null;
  const pin = pins(row["pin"]);
  const rawStatus = row["statusText"];
  if (
    rawStatus !== undefined &&
    (typeof rawStatus !== "string" ||
      !validStatusInput(rawStatus) ||
      normalizeStatusInput(rawStatus) !== rawStatus ||
      row["sb"] !== undefined)
  )
    return null;
  const statusText = typeof rawStatus === "string" ? (draft ? rawStatus : rawStatus.trim()) : "";
  return {
    fr: row["fr"],
    fx: row["fx"],
    ...(Number.isInteger(row["bk"]) && Number(row["bk"]) >= 0 && Number(row["bk"]) <= 3
      ? { bk: Number(row["bk"]) }
      : {}),
    ...(member(row["tg"], FRIEND_TAGS) ? { tg: row["tg"] } : {}),
    ...(member(row["sb"], FRIEND_STATUSES) ? { sb: row["sb"] } : {}),
    ...(statusText ? { statusText } : {}),
    ...(pin ? { pin } : {}),
  };
}
export function decodeFriendSettings(value: unknown): FriendSettings | null {
  if (value === null) return null;
  const row = record(value);
  if (row && row["v"] !== 1 && row["v"] !== 2) throw new UnsupportedFriendSettingsError();
  const deco = decodeDecoration(row?.["deco"]);
  if (
    !row ||
    (row["v"] !== 1 && row["v"] !== 2) ||
    Object.keys(row).some(
      (key) => !["v", "rev", "prev", "on", "photo", "n", "since", "deco"].includes(key),
    ) ||
    Object.keys(record(row["deco"]) ?? {}).some((key) => !decoKeys.includes(key)) ||
    !validSavedStatus(record(row["deco"]) ?? {}, row["v"]) ||
    !revisionValid(row["rev"]) ||
    (row["prev"] !== "" && !revisionValid(row["prev"])) ||
    typeof row["on"] !== "boolean" ||
    typeof row["photo"] !== "boolean" ||
    typeof row["n"] !== "string" ||
    cleanName(row["n"]) !== row["n"] ||
    !row["n"] ||
    !deco ||
    (row["since"] !== undefined && !dayValid(row["since"])) ||
    (row["on"] && !dayValid(row["since"]))
  ) {
    throw new Error("Unsupported sharing settings. Update the app before changing sharing.");
  }
  return {
    v: row["v"],
    rev: row["rev"],
    prev: row["prev"],
    on: row["on"],
    photo: row["photo"],
    n: row["n"],
    deco,
    ...(dayValid(row["since"]) ? { since: row["since"] } : {}),
  };
}
export function newFriendRevision(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const boundedNumber = (value: number, maximum = 99999): number =>
  Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0;
const countValid = (value: unknown, maximum = 99999): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= maximum;
const weekValid = (value: unknown): value is string =>
  typeof value === "string" && /^\d{1,4}(,\d{1,4}){6}$/.test(value);

export function friendCardSource(
  lessons: readonly DayLesson[],
  progress: UserProgressState,
  profile: { glyph: string | null; photo: string | null },
  prefs: QuestPrefs,
  day: string,
): FriendCardSource {
  const stats = profileStats(progress, lessons, day);
  const badges: Record<string, string> = {};
  for (const badge of BADGES) {
    const earned = progress.badges[badge.id];
    if (dayValid(earned)) badges[badge.id] = earned;
  }
  return {
    stats,
    badges,
    day,
    g: publicGlyph(profile.glyph),
    photo: isAvatarDataUrl(profile.photo) ? profile.photo : null,
    acc: resolveAccent(prefs.accent, badges),
    st: resolveStamp(prefs.stamp, stats.rankId),
  };
}

export function buildFriendPublication(
  settings: FriendSettings,
  source: FriendCardSource,
): FriendPublication {
  const s = source.stats;
  const deco = resolveDeco(settings.deco, source.badges);
  const photo = settings.photo && source.photo ? { rev: settings.rev, data: source.photo } : null;
  const pin = pins(deco.pin, source.badges);
  const statusText = settings.v >= 2 ? canonicalStatus(deco.statusText?.trim()) : null;
  // Explicit public allowlist: never spread profile, account, lessons or progress here.
  const card: Omit<FriendCard, "t"> = {
    v: settings.v,
    rev: settings.rev,
    ph: photo !== null,
    d: source.day,
    n: settings.n,
    g: source.g,
    r: boundedNumber(s.rankId, 6),
    c: boundedNumber(s.carved),
    s: boundedNumber(s.streak, 9999),
    m: boundedNumber(s.mastered),
    l: boundedNumber(s.lessons),
    k: boundedNumber(s.kanji),
    vc: boundedNumber(s.vocab),
    a: Array.from({ length: 7 }, (_, i) => boundedNumber(s.answers7[i] ?? 0, 9999)).join(","),
    w: Array.from({ length: 7 }, (_, i) => boundedNumber(s.writing7[i] ?? 0, 9999)).join(","),
    ...(Object.keys(source.badges).length ? { bd: source.badges } : {}),
    ...(pin ? { pin } : {}),
    acc: source.acc,
    st: source.st,
    fr: deco.fr,
    fx: deco.fx,
    ...(deco.bk !== undefined ? { bk: deco.bk } : {}),
    ...(deco.tg !== undefined ? { tg: deco.tg } : {}),
    ...(deco.sb !== undefined ? { sb: deco.sb } : {}),
    ...(statusText ? { statusText } : {}),
    sh: settings.since ?? source.day,
  };
  const serialized = JSON.stringify([card, photo]);
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i++)
    hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619);
  return { card, photo, fp: `${serialized.length}:${(hash >>> 0).toString(16)}` };
}

export function decodeFriendCard(value: unknown): FriendCardState {
  const base = { cached: false, fetchedAt: Date.now() };
  if (value === null) return { ...base, kind: "closed" };
  const row = record(value);
  if (row && row["v"] !== 1 && row["v"] !== 2) return { ...base, kind: "unsupported" };
  const who = row ? identity(row) : null;
  if (
    !row ||
    (row["v"] !== 1 && row["v"] !== 2) ||
    !validSavedStatus(row, row["v"]) ||
    Object.keys(row).some(
      (key) =>
        ![
          "v",
          "rev",
          "ph",
          "t",
          "d",
          "n",
          "g",
          "r",
          "c",
          "s",
          "m",
          "l",
          "k",
          "vc",
          "a",
          "w",
          "bd",
          "pin",
          "acc",
          "st",
          "fr",
          "fx",
          "bk",
          "tg",
          "sb",
          "statusText",
          "sh",
        ].includes(key),
    ) ||
    !who ||
    !revisionValid(row["rev"]) ||
    typeof row["ph"] !== "boolean" ||
    !dayValid(row["d"]) ||
    !dayValid(row["sh"]) ||
    !weekValid(row["a"]) ||
    !weekValid(row["w"]) ||
    !countValid(row["r"], 6) ||
    !countValid(row["s"], 9999) ||
    !countValid(row["c"]) ||
    !countValid(row["m"]) ||
    !countValid(row["l"]) ||
    !countValid(row["k"]) ||
    !countValid(row["vc"])
  )
    return { ...base, kind: "invalid" };
  const bd: Record<string, string> = {};
  for (const badge of BADGES) {
    const earned = record(row["bd"])?.[badge.id];
    if (dayValid(earned)) bd[badge.id] = earned;
  }
  const deco = decodeDecoration({
    ...row,
    fr: member(row["fr"], FRIEND_FRAMES) ? row["fr"] : "plain",
    fx: member(row["fx"], FRIEND_EFFECTS) ? row["fx"] : "none",
  })!;
  const pin = pins(row["pin"], bd);
  const card: FriendCard = {
    v: row["v"],
    rev: row["rev"],
    ph: row["ph"],
    t: typeof row["t"] === "number" && Number.isFinite(row["t"]) && row["t"] >= 0 ? row["t"] : null,
    d: row["d"],
    n: who.n,
    g: who.g,
    r: row["r"],
    c: row["c"],
    s: row["s"],
    m: row["m"],
    l: row["l"],
    k: row["k"],
    vc: row["vc"],
    a: row["a"],
    w: row["w"],
    ...(Object.keys(bd).length ? { bd } : {}),
    ...(pin ? { pin } : {}),
    acc: member(row["acc"], ["amber", "sakura", "moss", "sky"]) ? row["acc"] : "amber",
    st: member(row["st"], ["ink", "moss", "paper"]) ? row["st"] : "ink",
    fr: deco.fr,
    fx: deco.fx,
    ...(deco.bk !== undefined ? { bk: deco.bk } : {}),
    ...(deco.tg ? { tg: deco.tg } : {}),
    ...(deco.sb ? { sb: deco.sb } : {}),
    ...(deco.statusText ? { statusText: deco.statusText } : {}),
    sh: row["sh"],
  };
  return { ...base, kind: "published", card };
}

export function decodeFriendPhoto(value: unknown): FriendPhoto | null {
  const row = record(value);
  return row && revisionValid(row["rev"]) && isAvatarDataUrl(row["data"])
    ? { rev: row["rev"], data: row["data"] }
    : null;
}

export function friendCardAge(timestamp: number | null, now = Date.now()): string {
  if (timestamp === null || !Number.isFinite(timestamp) || timestamp < 0 || timestamp > now)
    return "Update time unavailable";
  const minutes = Math.floor((now - timestamp) / 60000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? "day" : "days"} ago`;
}

export type CardScene = { name: string; url: string };
export const FRAME_BADGES: Readonly<Record<string, string>> = {
  gold: "first-answer",
  stitch: "streak-3",
  moss: "streak-7",
  double: "lessons-10",
  seal: "first-carve",
};
export const EFFECT_BADGES: Readonly<Record<string, string>> = {
  vines: "streak-30",
  petals: "carved-10",
  fireflies: "mastered-20",
};
export const FRIEND_STATUS_LABELS: Readonly<Record<NonNullable<FriendDecoration["sb"]>, string>> = {
  adding: "Adding to my notebook",
  reviewing: "Reviewing a few words",
  writing: "Writing a page by hand",
  carving: "Carving kanji today",
  quiet: "Taking a quiet study day",
};
export const FRIEND_TAG_LABELS: Readonly<Record<NonNullable<FriendDecoration["tg"]>, string>> = {
  n5: "N5",
  n4: "N4",
  n3: "N3",
  n2: "N2",
  n1: "N1",
  kanji: "漢字",
  self: "独学",
  reading: "読書",
};

/** Unlocks affect rendering/selection only. Never rewrite a saved locked choice. */
export function decorationUnlocked(
  slot: "frame" | "effect",
  id: string,
  badges: Readonly<Record<string, string>>,
): boolean {
  if (slot === "effect") return id === "none"; // Animated effects are implemented in F6.
  if (id === "plain") return true;
  const required = FRAME_BADGES[id];
  return required !== undefined && dayValid(badges[required]);
}

export function resolveDeco(
  value: unknown,
  badges: Readonly<Record<string, string>>,
): FriendDecoration {
  const stored = decodeDecoration(value, true) ?? { fr: "plain", fx: "none" };
  const pin = pins(stored.pin, badges);
  return {
    fr: decorationUnlocked("frame", stored.fr, badges) ? stored.fr : "plain",
    fx: "none",
    ...(stored.bk !== undefined ? { bk: stored.bk } : {}),
    ...(stored.tg !== undefined ? { tg: stored.tg } : {}),
    ...(stored.sb !== undefined ? { sb: stored.sb } : {}),
    ...(stored.statusText !== undefined ? { statusText: stored.statusText } : {}),
    ...(pin ? { pin } : {}),
  };
}

export function maskEmail(email: string | null): string {
  if (!email) return "Email unavailable";
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "Email unavailable";
  return `${[...email.slice(0, at)][0] ?? ""}•••@${email.slice(at + 1)}`;
}
