# Phase 3d2 — multi-select delete, and dropping window.confirm

Follow-up to `phase-3d.md`, prompted by user feedback after testing 3d locally: a request for
multi-select delete, and a report that "the deleting option freezes and I need to refresh the page
to continue" (single-day delete). File touched: `src/routes/index.tsx` only, plus `PLAN.md` and
`context.md`.

## On the freeze report

I can't reproduce browser runtime behavior in this sandbox (no real browser here — see the
sandbox-limits note in `context.md`), so this is a hypothesis, not a confirmed root cause. Phase
3d's single-delete used `window.confirm(...)`, a native OS/browser dialog. These are known to
sometimes not grab focus reliably on some OS/window-manager/browser combinations, which can look
exactly like a frozen page — the page isn't actually hung, but a dialog is waiting for input
somewhere off-screen or behind the window, and a refresh is the obvious thing to try, which also
happens to dismiss the stuck dialog. I don't have a way to confirm this is what happened.

Given multi-select needed richer confirmation UI anyway (a bulk `window.confirm` can't cleanly show
"Delete 3 days?" styled to match the app), I replaced `window.confirm` entirely with a new in-page
`ConfirmDialog` component for both single and multi delete. This is a real improvement regardless
of whether it was the freeze's cause, and it's worth retesting specifically for the freeze.

**If it still freezes after this**, it isn't the native-dialog theory, and I'd want: which browser,
whether it happens on the very first delete or only after several, whether `npm run dev` and a
production build (`npm run build && npx vite preview`) both show it, and anything in the browser's
console (F12 → Console tab) at the moment it happens.

## What changed

- **`deleteDay(dayNumber)` → `deleteDays(dayNumbers: number[])`.** Same logic as before (strip
  `d{day}-*` ids from `masteredVocabIds`/`weakVocabIds`, drop from `completedDays`, jump to the
  nearest remaining day — higher first, then lower, then Day 1 if none remain — if the current day
  was among those deleted), generalized from one day to a set. No `window.confirm` inside it
  anymore; confirmation now happens in the UI before this is called.
- **`CurriculumList`** (new component, factored out of `LessonWorkspace`'s inline curriculum
  markup): a "Select" button toggles select mode. In select mode, each row gets a checkbox instead
  of (not in addition to) its hover-reveal trash icon, and a bar at the bottom shows "N selected"
  with a "Delete N" button. Both the single-row trash icon and the bulk "Delete N" button open the
  same `ConfirmDialog`.
- **`ConfirmDialog`** (new, reusable): a styled in-page overlay — title, body, Cancel/Delete
  buttons — used for both delete flows. `ProgressView`'s "Reset all progress" keeps its own
  separate type-"reset" control (unchanged; it never used `window.confirm` to begin with).

## Checks run
- `tsc --noEmit` (strict): clean.
- `eslint` (prettier off, same convention as prior handoffs): clean.
- `npm run build`: succeeds.
- A standalone reimplementation of `deleteDays`' selection/stripping logic for the *bulk* case (the
  real function is a closure) — 5 cases, all pass: bulk delete including the current day jumps to
  the nearest higher survivor; bulk delete of other days leaves the current day alone; deleting
  every remaining day empties the curriculum and resets to Day 1; bulk delete where only lower
  survivors remain picks the nearest lower one; the `d1-*`/`d11-*` vs `d10-*`/`d12-*` prefix-
  collision case, now with two days deleted at once.

## Not verified
- Nothing in a real browser — the Select-mode toggle, checkboxes, the bulk delete bar, and the new
  `ConfirmDialog` all need an actual click-through.
- Whether the freeze is actually gone. That's the main thing to retest.

## Verifier addendum (separate session)
- Reviewed the diff against the 3d baseline: logic in `deleteDays` is correct (nearest-higher, then lower, then Day 1; prefix stripping uses `d{n}-` so `d1-` can't match `d10-`).
- Typecheck, eslint (prettier off) and `npm run build` were clean before and after the fix below.
- **One fix made:** `ConfirmDialog` is now rendered with `createPortal(..., document.body)`. The curriculum's `GlassPane` has `backdrop-blur` and a rotate transform, and either makes a `position: fixed` child size and position itself relative to the pane, not the screen, so the dialog would have appeared squashed inside the curriculum panel. Only `src/routes/index.tsx` changed (one import, the return of `ConfirmDialog`).
- Still not verified in a real browser: Select mode/checkboxes, the bulk bar, the dialog's placement and the freeze retest.
