/**
 * Phase 19a — the one hook that reads and writes `localStorage["kiroku_profile_v1"]` for the UI (the sync reaches the
 * same key through `src/lib/prefs-storage.ts`). Several parts of the screen use it at once (the header avatar, the
 * Profile page); `saveProfile` fires `PROFILE_RELOAD_EVENT`, so they all re-read and never disagree.
 *
 * The profile is `DEFAULT_PROFILE` until the component has mounted in the browser, so the server render and the first
 * client render match.
 */
import { useCallback, useEffect, useState } from "react";
import { cleanName, isGlyphId, DEFAULT_PROFILE, type Profile } from "@/lib/profile";
import {
  PROFILE_RELOAD_EVENT,
  announcePrefsChanged,
  readProfile,
  saveProfile,
} from "@/lib/prefs-storage";

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    const reload = () => setProfile(readProfile());
    reload();
    window.addEventListener(PROFILE_RELOAD_EVENT, reload);
    return () => window.removeEventListener(PROFILE_RELOAD_EVENT, reload);
  }, []);

  /** Saves a typed name (cleaned, at most 24 characters). Emptying a name that was never set changes nothing. */
  const setName = useCallback((raw: string) => {
    const current = readProfile();
    const name = cleanName(raw);
    if (current.name === name || (current.name === null && name === "")) return;
    saveProfile({ ...current, name });
    announcePrefsChanged(); // name and avatar sync, so tell the sync something changed
  }, []);

  const setGlyph = useCallback((glyph: string) => {
    const current = readProfile();
    if (!isGlyphId(glyph) || current.glyph === glyph) return;
    saveProfile({ ...current, glyph });
    announcePrefsChanged();
  }, []);

  /** Remembers that this device just made a backup file. Device-only: not announced to the sync. */
  const markExported = useCallback(() => {
    saveProfile({ ...readProfile(), lastExportAt: new Date().toISOString() });
  }, []);

  return { profile, setName, setGlyph, markExported };
}
