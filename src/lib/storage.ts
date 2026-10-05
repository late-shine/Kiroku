/**
 * Kiroku's localStorage keys, plus the one-time migration from the app's old name (Komorebi).
 *
 * Before the Phase 4 rebrand every key started with `komorebi_`. Renaming them without a migration
 * would silently drop saved days, progress, AI Studio options, the user's Gemini key and music
 * settings, so `migrateLegacyStorage()` copies each old value across once.
 *
 * Rules the migration follows:
 * - It only COPIES, and only when the new key is empty and the old one has data. Old keys are left
 *   in place (nothing is deleted), so a rollback to the old build still finds its data.
 * - It runs once per browser. A marker key records that, so after that the old keys are never read
 *   again. Without the marker, clearing something on purpose (e.g. "Remove key") would bring the
 *   old copy back on the next load.
 * - It only moves values between localStorage keys in the browser; nothing is logged or sent.
 */

export const STORAGE_KEYS = {
  progress: "kiroku_progress_v2",
  lessons: "kiroku_lessons_v1",
  aiStudio: "kiroku_ai_studio_v1",
  geminiKey: "kiroku_gemini_key_v1",
  music: "kiroku_music_v1",
  voice: "kiroku_voice_v1", // Phase 8 — new key, has no legacy (komorebi_*) counterpart
  tips: "kiroku_tips_v1", // Phase 11b — dismissed tip ids; new key, no legacy counterpart
  sync: "kiroku_sync_v1", // Phase 9b — { uid, lastSyncedAt }: which account this device last synced with; no legacy counterpart, never in a backup
} as const;

/** The pre-rebrand keys, paired with what replaced them. Never write to these. */
export const LEGACY_STORAGE_KEYS = {
  progress: "komorebi_progress_v2",
  lessons: "komorebi_lessons_v1",
  aiStudio: "komorebi_ai_studio_v1",
  geminiKey: "komorebi_gemini_key_v1",
  music: "komorebi_music_v1",
} as const;

const MIGRATION_MARKER = "kiroku_storage_migrated_v1";

// Only keys that existed before the rebrand have something to migrate. Keys added later (e.g. `voice`)
// are in STORAGE_KEYS but deliberately absent here.
type StorageName = keyof typeof LEGACY_STORAGE_KEYS;

/** Idempotent and cheap: safe to call before every read. Does nothing on the server. */
export function migrateLegacyStorage(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_MARKER) !== null) return;
    for (const name of Object.keys(LEGACY_STORAGE_KEYS) as StorageName[]) {
      const newKey = STORAGE_KEYS[name];
      if (localStorage.getItem(newKey) !== null) continue;
      const oldValue = localStorage.getItem(LEGACY_STORAGE_KEYS[name]);
      if (oldValue !== null) localStorage.setItem(newKey, oldValue);
    }
    localStorage.setItem(MIGRATION_MARKER, "1");
  } catch {
    /* storage blocked or full — the app just starts fresh, same as it would with no saved data */
  }
}
