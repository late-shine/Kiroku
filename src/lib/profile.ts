/**
 * Phase 19a — the Profile page's pure part: the stored shape (`localStorage["kiroku_profile_v1"]`), name cleaning,
 * the avatar presets, and the fallbacks that decide what name and picture to show. No React, no localStorage, no
 * Firebase, so it can be checked from a plain script (handoffs/phase-19a-profile-check.ts).
 *
 * WHAT SYNCS: `name`, `glyph` (the avatar choice) and, since 19a-2, `photo` (a tiny uploaded picture), as entries of
 * the account's `prefs` (see src/lib/sync.ts).
 * WHAT DOES NOT: `lastExportAt` (when THIS device last made a backup file) stays on the device, and nothing here is
 * in a backup file. The Google photo is never stored by Kiroku at all: it comes from the signed-in account each time.
 *
 * `null` means "never set on this device": it takes no part in a sync, so a device that was only used to export a
 * backup can never overwrite the name another device chose. An empty string `""` for the name is a real choice
 * ("use my Google name"), and it syncs.
 */

/** The rules cap `prefs/name` at this many characters (UTF-16 units, as the rules' `.length` counts them). */
export const MAX_NAME_LENGTH = 24;

/** The avatar the person can pick instead of the automatic one. The ids are what is stored and synced. */
export const PROFILE_GLYPHS = [
  { id: "ki", char: "記", label: "Record" },
  { id: "neko", char: "猫", label: "Cat" },
  { id: "tsuki", char: "月", label: "Moon" },
  { id: "ha", char: "葉", label: "Leaf" },
  { id: "hana", char: "花", label: "Flower" },
  { id: "hoshi", char: "星", label: "Star" },
  { id: "hotaru", char: "蛍", label: "Firefly" },
  { id: "koke", char: "苔", label: "Moss" },
] as const;

/** "Automatic": your Google photo when signed in and it has one, otherwise your initial. The default. */
export const GLYPH_AUTO = "auto";

/** 19a-2: "use the picture I uploaded" (kept in `photo`). With no uploaded picture it behaves like Automatic. */
export const GLYPH_UPLOAD = "upload";

export const PROFILE_GLYPH_IDS: readonly string[] = [
  GLYPH_AUTO,
  GLYPH_UPLOAD,
  ...PROFILE_GLYPHS.map((g) => g.id),
];

/** The uploaded picture is shrunk to this many pixels square before it is stored (see src/lib/avatar-image.ts). */
export const AVATAR_PIXELS = 128;
/** The rules cap `prefs/photo` at this many characters (the whole `data:` address). A 128 px picture is a few KB. */
export const MAX_PHOTO_LENGTH = 16000;

const PHOTO_RE = /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * An uploaded picture as it is stored and synced: a base64 `data:` address of a JPEG or WebP, within the size cap.
 * Anything else (SVG, PNG, another scheme, too long) is refused, so the value is safe to put in an `<img>`.
 * The same test is in `firebase/database.rules.json`.
 */
export const isAvatarDataUrl = (value: unknown): value is string =>
  typeof value === "string" && value.length <= MAX_PHOTO_LENGTH && PHOTO_RE.test(value);

/** A stored or synced `photo` value: a valid picture, or `""` (the person removed their picture). */
export const isPhotoValue = (value: unknown): value is string =>
  value === "" || isAvatarDataUrl(value);

export const isGlyphId = (value: unknown): value is string =>
  typeof value === "string" && PROFILE_GLYPH_IDS.includes(value);

export interface Profile {
  /** The name the person typed (`""` = deliberately empty); `null` = never set on this device. */
  name: string | null;
  /** `GLYPH_AUTO` or one of `PROFILE_GLYPHS`; `null` = never set on this device. */
  glyph: string | null;
  /** The uploaded picture (`isAvatarDataUrl`); `""` = removed on purpose; `null` = never set on this device. */
  photo: string | null;
  /** ISO time this device last made a backup file. Device-only, never synced. */
  lastExportAt: string | null;
}

export const DEFAULT_PROFILE: Profile = {
  name: null,
  glyph: null,
  photo: null,
  lastExportAt: null,
};

/**
 * Turns whatever was typed into a storable name: control characters dropped, runs of whitespace collapsed, trimmed,
 * at most `MAX_NAME_LENGTH` UTF-16 units (a character is never cut in half).
 */
export function cleanName(raw: string): string {
  let text = raw
    // eslint-disable-next-line no-control-regex -- dropping control characters is the point
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > MAX_NAME_LENGTH) {
    text = text.slice(0, MAX_NAME_LENGTH);
    const last = text.charCodeAt(text.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1); // half of an emoji
    text = text.trim();
  }
  return text;
}

const validTime = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 40 && !Number.isNaN(Date.parse(value));

/** Reads the stored text back safely. Missing, corrupt or odd data → the default; one bad field is just dropped. */
export function parseStoredProfile(raw: string | null): Profile {
  if (!raw) return { ...DEFAULT_PROFILE };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_PROFILE };
    }
    const record = parsed as Record<string, unknown>;
    const name = record["name"];
    const glyph = record["glyph"];
    const photo = record["photo"];
    const exported = record["lastExportAt"];
    return {
      name: typeof name === "string" ? cleanName(name) : null,
      glyph: isGlyphId(glyph) ? glyph : null,
      photo: isPhotoValue(photo) ? photo : null,
      lastExportAt: validTime(exported) ? exported : null,
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export const serializeProfile = (profile: Profile): string => JSON.stringify(profile);

/** The part of the profile that syncs (nothing for a field that was never set). */
export function profileSyncFields(profile: Profile): {
  name?: string;
  glyph?: string;
  photo?: string;
} {
  return {
    ...(profile.name !== null ? { name: profile.name } : {}),
    ...(profile.glyph !== null ? { glyph: profile.glyph } : {}),
    ...(profile.photo !== null ? { photo: profile.photo } : {}),
  };
}

/** What the sign-in knows about the person (all optional: nobody is signed in, or Google gave less). */
export interface AccountIdentity {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const localPart = (email: string) => email.split("@")[0] ?? "";

/** The name to show: the typed one, else the Google name, else the start of the email, else "Learner". */
export function resolveName(
  profile: Pick<Profile, "name">,
  account: AccountIdentity | null,
): string {
  const typed = profile.name ? cleanName(profile.name) : "";
  if (typed) return typed;
  const google = account?.displayName ? cleanName(account.displayName) : "";
  if (google) return google;
  const mail = account?.email ? cleanName(localPart(account.email)) : "";
  return mail || "Learner";
}

/** First letter of a name, upper-cased (a whole character, so an emoji or a kanji is not cut in half). */
export const initialOf = (name: string): string => {
  const first = [...name.trim()][0] ?? "";
  return first.toUpperCase();
};

export type Avatar =
  | { kind: "photo"; url: string }
  | { kind: "glyph"; char: string; id: string }
  | { kind: "initial"; char: string }
  | { kind: "none" };

/** Only a plain https address is ever used as a picture. */
const safePhoto = (url: string | null): string | null =>
  url !== null && /^https:\/\//i.test(url) ? url : null;

/**
 * Which picture to show. A chosen glyph always wins; so does a chosen upload (when one is stored; without it the
 * choice behaves like Automatic); otherwise the Google photo (signed in, and Google has one); otherwise the initial of
 * the resolved name, but only when there IS a name to take it from (typed, or signed in). With none of those the
 * caller shows its neutral icon (`none`). An uploaded picture comes back as a `photo`, like the Google one.
 */
export function avatarFor(profile: Profile, account: AccountIdentity | null): Avatar {
  const glyph = PROFILE_GLYPHS.find((g) => g.id === profile.glyph);
  if (profile.glyph === GLYPH_UPLOAD && profile.photo && isAvatarDataUrl(profile.photo)) {
    return { kind: "photo", url: profile.photo };
  }
  if (glyph) return { kind: "glyph", char: glyph.char, id: glyph.id };
  const photo = safePhoto(account?.photoURL ?? null);
  if (photo) return { kind: "photo", url: photo };
  const hasSource = Boolean(profile.name) || account !== null;
  if (!hasSource) return { kind: "none" };
  const initial = initialOf(resolveName(profile, account));
  return initial ? { kind: "initial", char: initial } : { kind: "none" };
}
