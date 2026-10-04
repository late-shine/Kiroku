# Phase 3d — Delete a day / reset progress

Built by Claude, following PLAN.md's Phase 3d design. Files touched: `src/routes/index.tsx` only
(as scoped), plus `PLAN.md`, `context.md`, and this file.

## A bundled fix this phase needed (not in the original scope)

Before any of the below, `lessons` was never persisted to `localStorage` at all — only `progress`
was. That meant:
- Every AI-imported day already vanished on a page refresh, unrelated to this phase.
- "Delete Day N? This can't be undone" would have been false in the opposite direction: a refresh
  *did* undo it, silently bringing back the 13-day sample set.
- Zero lessons was an untested path (see below) that this phase makes reachable for the first time.

Fixed by adding `localStorage["komorebi_lessons_v1"]`, loaded on init the same way `progress`
already was (`loadLessons()`, mirroring `loadProgress()`), and written back on every change via a
second `useEffect`. This is a new persisted key — **add it to the Phase 4 migration list.**

## What was built

**Delete a single day** — a trash icon appears per row in the "今日 · curriculum" sidebar list on
hover (or on keyboard focus), gated behind `window.confirm("Delete Day N? This can't be undone.")`.
On confirm:
- Removes that `dayNumber` from `lessons`.
- Strips `d{day}-*` ids out of both `progress.masteredVocabIds` and `progress.weakVocabIds`, using
  a prefix check (`id.startsWith("d${day}-")`). Verified this doesn't false-match across day
  boundaries — deleting day 1 does not touch `d10-*` or `d12-*` ids, since the digit run differs
  before the literal `-`.
- Removes the day from `progress.completedDays`.
- If the deleted day was the one currently open, jumps to the nearest remaining day: prefer the
  next higher `dayNumber`, else the next lower, else (if none remain) Day 1.

The curriculum row used to be a single `<button>`; it's now a `<div>` with two sibling buttons
(select + delete), since a button can't legally nest inside another button. The delete icon is
visually hidden until hover/focus so the row's look doesn't change day-to-day.

**Reset everything** — a "Reset all progress" control sits in `ProgressView`, directly under the
existing Export/Restore row (export-first ordering, per the plan's nudge). It's collapsed by
default; opening it shows a warning and a text field requiring the word "reset" (case-insensitive)
before "Confirm" enables. On confirm, `lessons` → `[]` and `progress` → a new `emptyProgress`
constant — genuinely empty (no completed days, no mastered/weak vocab, zero quiz stats) — not the
existing `initialProgress`, which is actually seeded demo data (5 fake mastered words, 4 fake
quizzes) meant only for a first run with the sample course. Reusing it for "reset" would have left
fake stats behind. This does **not** offer the sample course back — that's the separate,
not-yet-numbered "first-run welcome" idea the plan explicitly says to keep out of this phase.

**Zero-lessons state (the untested path the plan flagged)** — confirmed the plan's suspicion: the
old code was `const lesson = lessons.find(...) ?? lessons[0]; if (!lesson) return null;`, which
blanked the *entire app* (header included) the moment `lessons` was empty, with no way back in
short of manually clearing `localStorage`. Now `lesson` is allowed to be `null`, and the "lesson"
tab renders a new `EmptyLessons` screen instead — a message plus two buttons, "Build a lesson"
(opens AI Lesson Studio) and "Restore backup" (switches to the Progress tab). The Header, Quiz tab,
Progress tab, and Atmosphere tab all still work normally with zero lessons; `completion` is guarded
against the division-by-zero that would otherwise show "NaN%".

## Checks run
- `tsc --noEmit` (strict): clean.
- `eslint` (prettier rule off, matching how 3c/3c2 were checked — this file's formatting wasn't run
  through prettier either): clean.
- `npm run build`: succeeds.
- A standalone reimplementation of `deleteDay`'s selection/stripping logic (the real function is a
  closure, not exported) — 7 cases, all pass: deleting a non-current day leaves the current day
  alone; deleting the current day jumps to the nearest higher, or nearest lower if it was the
  highest; deleting the only remaining day falls back to Day 1 with lessons/vocab ids empty; the
  `d1-*` vs `d10-*`/`d12-*` prefix-collision case; unrelated days' `completedDays` entries survive.

## Not verified
- Nothing in a real browser — the hover-reveal trash icon, the reset control's two-step UI, and the
  new empty-curriculum screen all need an actual click-through. (See `context.md`'s note on the
  sandbox's likely lack of browser E2E access.)
- The Restore-backup path (`importData` in `ProgressView`) still writes whatever JSON it's given
  straight into state with no schema check — pre-existing, not part of this phase, but worth
  knowing since it's now the documented way back from zero lessons.

## Left alone (still open, not blocking)
- The "first-run welcome" / offer-the-sample-course-back idea — no phase number yet, deliberately
  not bundled in here.
- The `lessons.length * 10` "words" metric bug in `ProgressView` (pre-existing, logged earlier).
- The Gemini status/trail sharing between the Copy and Import steps in `LessonStudio` (cosmetic).
