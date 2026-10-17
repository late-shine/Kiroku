// Phase 19b — "today" as the device clock sees it, shared by the 7-day chart and the Progress review numbers.
// (Moved unchanged out of `RhythmChart.tsx`.) It is client-only: the server render and the first client render get
// `null`, then the real day is filled in. It is read again when the tab comes back, so a tab left open past
// midnight moves on.
import { useSyncExternalStore } from "react";
import { localDay } from "@/lib/word-memory";

const subscribeToday = (onChange: () => void) => {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
};

export const useToday = (): string | null =>
  useSyncExternalStore(
    subscribeToday,
    () => localDay(),
    () => null,
  );
