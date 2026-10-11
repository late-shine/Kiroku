// Phase 16b-3: stop the page behind an overlay from scrolling.
//
// Every hand-rolled overlay (Lesson Studio, help card, confirm dialog, sync dialogs) calls `useScrollLock()`.
// It is reference-counted so stacked overlays work (a sync dialog opens above the Studio): the page is locked
// while ANY lock is held and unlocked, with its previous `overflow` restored, when the last one releases.
// No scrollbar-width compensation is needed because `html { scrollbar-gutter: stable }` (styles.css) keeps the
// gutter in place.
import { useEffect } from "react";

type Lockable = { style: { overflow: string } };

let locks = 0;
let previousOverflow = "";

/** Take one lock. The first lock remembers the element's current `overflow` and sets `hidden`. */
export function acquireScrollLock(el: Lockable): void {
  if (locks === 0) previousOverflow = el.style.overflow;
  locks += 1;
  el.style.overflow = "hidden";
}

/** Release one lock. The last release restores what `overflow` was before the first lock. */
export function releaseScrollLock(el: Lockable): void {
  if (locks === 0) return;
  locks -= 1;
  if (locks === 0) el.style.overflow = previousOverflow;
}

/** How many locks are held right now (for tests). */
export function scrollLockCount(): number {
  return locks;
}

export function useScrollLock(active = true): void {
  useEffect(() => {
    if (!active) return;
    const el = document.documentElement;
    acquireScrollLock(el);
    return () => releaseScrollLock(el);
  }, [active]);
}
