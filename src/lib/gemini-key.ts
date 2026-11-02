// The learner's own Gemini key (BYOK). It lives only in this browser, under its own storage key, so it is never bundled
// with anything that could be exported, backed up or synced; Kiroku's server only relays it per request.
//
// Phase Q5 added `readGeminiKey` (the photo check reads it). Phase Q8 adds the writers and a small change signal, so the
// key can be added or removed in Profile as well as in the AI Lesson Studio, and whichever screen is already mounted
// (the Studio stays mounted while hidden) follows the change. The storage-taking functions are pure enough to check
// from a plain script; the three wrappers below them bind them to this browser's localStorage.
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";

/** The event the writers dispatch on `window` after the key changes (the `storage` event never fires in its own tab). */
export const GEMINI_KEY_EVENT = "kiroku:gemini-key";

type Reader = { getItem(key: string): string | null };
type Writer = Reader & {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function readGeminiKey(): string {
  if (typeof window === "undefined") return "";
  migrateLegacyStorage();
  try {
    return localStorage.getItem(STORAGE_KEYS.geminiKey) ?? "";
  } catch {
    return "";
  }
}

/** The last four characters, to tell two keys apart without showing the key. Under 8 characters: nothing. */
export function keyTail(key: string): string {
  const trimmed = key.trim();
  return trimmed.length >= 8 ? trimmed.slice(-4) : "";
}

/**
 * Stores the key, trimmed. An empty or blank value stores nothing and returns false (the field was empty). A blocked or
 * full storage also returns false: the key would not survive a reload, so the caller must not say it was saved.
 */
export function storeGeminiKey(storage: Writer, value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  try {
    storage.setItem(STORAGE_KEYS.geminiKey, trimmed);
    return storage.getItem(STORAGE_KEYS.geminiKey) === trimmed;
  } catch {
    return false;
  }
}

/**
 * Removes the key. The rebrand migration copied the key and left the old one in place, so Remove key clears that copy
 * too (the same as the Studio does). Never throws.
 */
export function clearGeminiKey(storage: Writer): void {
  try {
    storage.removeItem(STORAGE_KEYS.geminiKey);
    storage.removeItem(LEGACY_STORAGE_KEYS.geminiKey);
  } catch {
    /* storage blocked: nothing to remove */
  }
}

const announce = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(GEMINI_KEY_EVENT));
};

/** Saves the key in this browser and tells every listener. False when nothing was saved (see `storeGeminiKey`). */
export function saveGeminiKey(value: string): boolean {
  if (typeof window === "undefined") return false;
  migrateLegacyStorage();
  let saved = false;
  try {
    saved = storeGeminiKey(localStorage, value);
  } catch {
    saved = false;
  }
  if (saved) announce();
  return saved;
}

/** Removes the key from this browser and tells every listener. */
export function removeGeminiKey(): void {
  if (typeof window === "undefined") return;
  try {
    clearGeminiKey(localStorage);
  } catch {
    /* ignore */
  }
  announce();
}

/**
 * Calls `onChange` whenever the key is saved or removed through this module, or changed in another tab. Returns the
 * function that stops listening (use it as an effect's cleanup). Does nothing on the server.
 */
export function subscribeGeminiKey(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    // `key` is null when the whole storage was cleared.
    if (event.key === null || event.key === STORAGE_KEYS.geminiKey) onChange();
  };
  window.addEventListener(GEMINI_KEY_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(GEMINI_KEY_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
