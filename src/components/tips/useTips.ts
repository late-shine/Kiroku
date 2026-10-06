/**
 * Phase 11b — the one place that touches `localStorage["kiroku_tips_v1"]`.
 *
 * `dismissed` is `null` until the component has mounted in the browser. Cards render only when it is
 * non-null, so the server render (and the first client render) never show a tip, which means a
 * returning user who dismissed everything never sees a one-frame flash.
 */
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage";
import { TIPS_RELOAD_EVENT, announcePrefsChanged } from "@/lib/prefs-storage";
import { parseDismissed, serializeDismissed, withDismissed, type TipId } from "./tips";

function save(dismissed: readonly TipId[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.tips, serializeDismissed(dismissed));
  } catch {
    /* storage blocked or full — tips just come back next visit */
  }
  announcePrefsChanged(); // Phase 9c: dismissed tips sync, so tell the sync something changed
}

export function useTips() {
  const [dismissed, setDismissed] = useState<TipId[] | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEYS.tips);
    } catch {
      /* storage blocked — treat as nothing dismissed */
    }
    setDismissed(parseDismissed(raw));
  }, []);

  // Phase 9c: a sync can change the dismissed list (a tip dismissed on another device); re-read it when it does.
  useEffect(() => {
    const reload = () => {
      try {
        setDismissed(parseDismissed(localStorage.getItem(STORAGE_KEYS.tips)));
      } catch {
        /* storage blocked: keep what we have */
      }
    };
    window.addEventListener(TIPS_RELOAD_EVENT, reload);
    return () => window.removeEventListener(TIPS_RELOAD_EVENT, reload);
  }, []);

  const isVisible = useCallback(
    (id: TipId) => dismissed !== null && !dismissed.includes(id),
    [dismissed],
  );

  const dismiss = useCallback((id: TipId) => {
    setDismissed((current) => {
      const next = withDismissed(current ?? [], id);
      save(next);
      return next;
    });
  }, []);

  const showAgain = useCallback(() => {
    setDismissed([]);
    save([]);
  }, []);

  return { isVisible, dismiss, showAgain };
}
