/**
 * Phase 9c — the browser side of synced preferences. The three screen prefs live in `progress` (the app already
 * saves those); the only synced pref stored on its own is the list of dismissed first-run tips
 * (`localStorage["kiroku_tips_v1"]`, owned by `useTips`). This file reads and writes it for the sync code and defines
 * the two window events that tie `useTips` and the sync together:
 *  - PREFS_CHANGED_EVENT: `useTips` fires it after the person dismisses a tip, so a sync follows;
 *  - TIPS_RELOAD_EVENT: the sync fires it after it wrote the tips, so `useTips` re-reads them.
 * Phase 19a adds the profile (`localStorage["kiroku_profile_v1"]`, owned by `useProfile`): its name and avatar choice
 * sync as `prefs.name` / `prefs.glyph`; `lastExportAt` stays on the device.
 * The voice choice is deliberately NOT synced (see src/lib/voice.ts).
 */
import { STORAGE_KEYS } from "@/lib/storage";
import { parseDismissed, serializeDismissed } from "@/components/tips/tips";
import {
  cleanName,
  isGlyphId,
  isPhotoValue,
  parseStoredProfile,
  profileSyncFields,
  serializeProfile,
  type Profile,
} from "@/lib/profile";

export const PREFS_CHANGED_EVENT = "kiroku:prefs-changed";
export const TIPS_RELOAD_EVENT = "kiroku:tips-reload";
/** Phase 19a: fired after the profile was written (by the Profile page, an export, or a sync) so every `useProfile` re-reads it. */
export const PROFILE_RELOAD_EVENT = "kiroku:profile-reload";

export function readDismissedTips(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return parseDismissed(localStorage.getItem(STORAGE_KEYS.tips));
  } catch {
    return [];
  }
}

/** Saves the list (unknown ids are dropped, like `useTips` does) and tells `useTips` to re-read it. */
export function writeDismissedTips(ids: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEYS.tips,
      serializeDismissed(parseDismissed(JSON.stringify({ dismissed: ids }))),
    );
  } catch {
    /* storage blocked or full: the tips just stay as they were */
  }
  window.dispatchEvent(new Event(TIPS_RELOAD_EVENT));
}

export function announcePrefsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PREFS_CHANGED_EVENT));
}

/** The whole stored profile (defaults on the server, when storage is blocked, or when nothing is saved). */
export function readProfile(): Profile {
  if (typeof window === "undefined") return parseStoredProfile(null);
  try {
    return parseStoredProfile(localStorage.getItem(STORAGE_KEYS.profile));
  } catch {
    return parseStoredProfile(null);
  }
}

/** Saves the profile and tells every `useProfile` to re-read it. Does NOT announce a prefs change: the caller decides. */
export function saveProfile(profile: Profile): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.profile, serializeProfile(profile));
  } catch {
    /* storage blocked or full: the profile just stays as it was */
  }
  window.dispatchEvent(new Event(PROFILE_RELOAD_EVENT));
}

/** What this device offers the sync: the name and avatar it has chosen (a field never set is left out). */
export function readProfileForSync(): { name?: string; glyph?: string; photo?: string } {
  return profileSyncFields(readProfile());
}

/**
 * A sync brought a name or avatar from the account: save them (keeping this device's `lastExportAt`) and tell
 * `useProfile`. Only the fields the sync result actually has are written, and nothing is announced as a change,
 * so applying the account's values never triggers another sync by itself.
 */
export function writeProfileFromSync(prefs: {
  name?: string;
  glyph?: string;
  photo?: string;
}): void {
  const current = readProfile();
  const next: Profile = {
    ...current,
    ...(prefs.name !== undefined ? { name: cleanName(prefs.name) } : {}),
    ...(prefs.glyph !== undefined && isGlyphId(prefs.glyph) ? { glyph: prefs.glyph } : {}),
    ...(prefs.photo !== undefined && isPhotoValue(prefs.photo) ? { photo: prefs.photo } : {}),
  };
  if (serializeProfile(next) === serializeProfile(current)) return;
  saveProfile(next);
}
