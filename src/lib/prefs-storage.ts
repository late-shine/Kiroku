/**
 * Phase 9c — the browser side of synced preferences. The three screen prefs live in `progress` (the app already
 * saves those); the only synced pref stored on its own is the list of dismissed first-run tips
 * (`localStorage["kiroku_tips_v1"]`, owned by `useTips`). This file reads and writes it for the sync code and defines
 * the two window events that tie `useTips` and the sync together:
 *  - PREFS_CHANGED_EVENT: `useTips` fires it after the person dismisses a tip, so a sync follows;
 *  - TIPS_RELOAD_EVENT: the sync fires it after it wrote the tips, so `useTips` re-reads them.
 * The voice choice is deliberately NOT synced (see src/lib/voice.ts).
 */
import { STORAGE_KEYS } from "@/lib/storage";
import { parseDismissed, serializeDismissed } from "@/components/tips/tips";

export const PREFS_CHANGED_EVENT = "kiroku:prefs-changed";
export const TIPS_RELOAD_EVENT = "kiroku:tips-reload";

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
