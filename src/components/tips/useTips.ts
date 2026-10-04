/**
 * Phase 11b — the one place that touches `localStorage["kiroku_tips_v1"]`.
 *
 * `dismissed` is `null` until the component has mounted in the browser. Cards render only when it is
 * non-null, so the server render (and the first client render) never show a tip, which means a
 * returning user who dismissed everything never sees a one-frame flash.
 */
import { useCallback, useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/lib/storage";
import { parseDismissed, serializeDismissed, withDismissed, type TipId } from "./tips";

function save(dismissed: readonly TipId[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.tips, serializeDismissed(dismissed));
  } catch {
    /* storage blocked or full — tips just come back next visit */
  }
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
