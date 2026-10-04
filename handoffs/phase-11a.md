# Handoff — Phase 11a: Welcome screen (samples removed)
Date: 2026-09-30

## Summary
New visitors now start with an empty curriculum instead of the author's 13 sample days and seeded
stats, and see a first-run welcome panel in which Kiroku introduces itself, shows the three-step
loop, and offers "Build my first lesson" / "Restore a backup" / "Skip intro". Existing users are
untouched and never see the panel.

## Files changed
- `src/routes/index.tsx`: dropped the `INITIAL_LESSONS` import; `initialProgress` merged into the
  single `emptyProgress` constant; `loadProgress()`/`loadLessons()` fall back to empty; starting
  `day` is `1`; added `loadWelcomeSeen()`, a `mounted` gate, `welcomeSeen` state, `dismissWelcome()`,
  an effect that flags the welcome as seen whenever `lessons.length > 0`, and the
  `WelcomePanel` / `EmptyLessons` branch.
- `src/lib/storage.ts`: added `welcome: "kiroku_welcome_v1"` to `STORAGE_KEYS` (no legacy twin).
- `context.md`: new "New visitors start empty (Phase 11a)" section + the new key in the key list.

## Files added
- `src/components/welcome/WelcomePanel.tsx`: the panel. Tokens only, no new dependencies, uses the
  same glass-pane classes as `GlassPane` (which is local to `index.tsx`).
- `src/assets/images/welcome-lesson.webp`: the Day 1 screenshot shown in the panel (~42 KB).
  Replacing that one file, same name, changes the picture with no code change.

## Data/schema changes
One new `localStorage` key, `kiroku_welcome_v1` (presence = seen). No migration needed; nothing is
written to legacy keys. Saved lessons/progress are read exactly as before.

## Behavior changes
- No sample days anywhere. `src/data/initialLessons.ts` remains on disk but is imported nowhere.
- First run (no lessons, no flag) → welcome panel. Any button in it sets the flag.
- Deleting every day / resetting later → the plain `EmptyLessons` screen, not the welcome.
- Welcome and empty screens only render after mount, so SSR can't flash the panel at existing users.

## What the next phase should know
- Phase 13 (versioned backup) is next per the plan; the panel's "Restore a backup" just switches to
  the Progress tab, so it will inherit whatever that phase builds.
- Phase 11b's Tips button can call the same `dismissWelcome`/`welcomeSeen` state to re-open the panel
  (it would need a "force show" prop, not built).

## What I did NOT touch
Prompt builder, Gemini code, backup format, tip cards, Astra link, README (its sample-day framing was
not reviewed here).


---
## Verifier addendum — welcome rule simplified (no stored flag)
User-tested build showed "Skip intro" (and also "Build my first lesson" / "Restore a backup") hid the welcome
permanently via `kiroku_welcome_v1`, even if nothing was imported. Decision with the user: **empty means welcome.**
- `src/routes/index.tsx`: removed `loadWelcomeSeen`, `welcomeSeen`, `dismissWelcome` and the flag-setting effect.
  Added `welcomeSkipped` (plain `useState(false)`, never saved). Render: `mounted && (welcomeSkipped ? EmptyLessons : WelcomePanel)`.
  An effect clears `welcomeSkipped` whenever `lessons.length > 0`, so reset-all or deleting the last day brings the
  welcome back. The `mounted` gate is unchanged (still what prevents the flash for existing users).
- `onAI` / `onRestore` on the panel now just open the Studio / Progress tab; they no longer hide anything.
- `src/lib/storage.ts`: `STORAGE_KEYS.welcome` removed. Nothing was written under `kiroku_welcome_v1` by any release
  but the user's test builds; a leftover key in a browser is harmless and unread.
- `WelcomePanel.tsx`: header comment only. `context.md`: welcome section and key list updated.
- Consequence for later phases: nothing to migrate into accounts (Phase 9) for the welcome. Phase 11b's Tips button can
  re-open the welcome only when lessons are empty, or needs its own small state; it must not rely on a stored flag.
