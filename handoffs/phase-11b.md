# Handoff — Phase 11b (first-run tips) + Phase 12 (Astra-chan link)

Date: 2026-10-01

> **Later amendment (Phase 14c micro phase):** the Studio tip and the help card each gained a short "AIs sometimes ignore parts of a
> prompt; resend, and try thinking mode" note. See `handoffs/phase-14c.md`. The wording quoted elsewhere in this file is the
> original.

## Summary
Four small dismissible tip cards (Studio, Quiz, Progress, Atmosphere), a header "?" button that opens a short
"How Kiroku works" help card about the Lesson Studio flow, and one quiet "Also by me" link at the bottom of the
Atmosphere tab. Also fixed the day-after-Restore quirk the verifier flagged. Wording is exactly the approved text in
PLAN.md (stored in one file, `tips.ts`).

## Files changed
- `src/routes/index.tsx`: new imports (`CircleHelp`, `HelpCard`, `TipCard`, `useTips`); shell gets `helpOpen` state and
  `const tips = useTips()`; `Header` gains an `onHelp` prop and a "?" button (`aria-label="Help"`) before the bot button;
  Quiz / Progress / Atmosphere render a `TipCard` above their view when visible; `HelpCard` rendered next to `MusicPanel`;
  `LessonStudio` gets `showTip` / `onDismissTip`; `ProgressView` and `BackupControls` get an `onRestored(firstDay)` prop
  (shell passes `setDay`); `AtmosphereView` gets the Astra line under the voice card.
- `src/components/ai/LessonStudio.tsx`: two new required props (`showTip`, `onDismissTip`) and one `TipCard` line at the
  top of the Configure step. Nothing else touched.
- `src/lib/storage.ts`: `tips: "kiroku_tips_v1"` added to `STORAGE_KEYS` (no legacy twin).
- `context.md` (new key, file-map line), `PLAN.md` (status rows, known-issue marked fixed).

## Files added
- `src/components/tips/tips.ts` (ids, approved copy, pure parse / serialize / dismiss helpers),
  `useTips.ts` (the only localStorage access), `TipCard.tsx`, `HelpCard.tsx`.
- `handoffs/phase-11b-tips-check.ts`: 19 no-browser cases for the pure helpers.
  Run: `npx tsx --tsconfig tsconfig.json handoffs/phase-11b-tips-check.ts`.

## Data/schema changes
One new key, `kiroku_tips_v1` = `{"dismissed": ["studio", ...]}`. Corrupt / missing / odd data reads as "nothing dismissed".
No migration. Not part of the backup file (a backup restore doesn't bring tips back or hide them).

## Behavior changes
- Header: a "?" icon button (CircleHelp) sits left of the AI and music buttons on every tab, with or without lessons.
  It opens the help card (portaled to `<body>`, closes on backdrop click, Close, or the X). Its buttons: "Open AI Lesson
  Studio" (closes the card, opens the Studio), "Show tips again" (clears dismissed; the card stays open), "Close".
- Tip cards: Quiz, Progress, Atmosphere (above the view, matching its width) and inside the Studio's Configure step.
  "Got it" dismisses that one for good. Never on the Lessons tab, welcome or empty-curriculum screens.
- No flash: `useTips` returns nothing visible until after mount, so a returning user who dismissed everything never sees a card.
  A brand-new visitor's cards only appear when they open those screens, so nothing shifts on first paint.
- Restore: after a successful Restore the shell's `day` becomes the first restored lesson's day (an empty backup leaves it alone).
- Astra link: `Also by me — Learn with Astra-chan, another Japanese-learning app.` under the voice card; link opens
  `https://astra-kanji-tutor.vercel.app` in a new tab (`rel="noopener noreferrer"`). Static: no storage, no dismiss.

## What the next phase should know
- Phase 9 (accounts): `kiroku_tips_v1` should move into account data so it means "first time in an account".
- Change tip wording only in `tips.ts` (cards) or `HelpCard.tsx` (the help card, which has its own copy because it is longer and structured).
- Phase 12 placement/wording is the proposed default (Atmosphere, bottom). It is one `<p>` in `AtmosphereView` to move or reword.
- Phase 13's `onRestored` hook is the only change to Phase 13's code; backup format and `backup.ts` are untouched.

## Known limitations / for the verifier
- Not tried in a real browser. Click-through: fresh browser (clear `kiroku_tips_v1`) shows cards on Quiz, Progress, Atmosphere
  and in the Studio's Configure step; "Got it" persists across a refresh; "?" → "Show tips again" brings them back; "?" works on
  the welcome screen; "Open AI Lesson Studio" from the help card opens the Studio with the tip visible (if not dismissed);
  Restore a backup that starts at Day 5 and check the header reads D5; the Astra link opens in a new tab; check the help card
  and tips on a phone width (the card scrolls inside itself; the header now has one more button).
- The header got a third icon button; on very narrow phones the right-hand group is tighter. Worth a glance on the phone preview.
- "Show tips again" doesn't close the help card on purpose (so the user sees nothing change and may press it twice); easy to change.
- Existing users (who have used the app before 11b) will see the four cards once, same as new visitors.

## How it was tested (builder sandbox)
`tsc --noEmit` clean; `eslint` real rules 0 errors (same 6 pre-existing warnings; the `prettier/prettier` noise in
`index.tsx` is the project's pre-existing compact style); `npm run build` succeeds; tips helper script (19 cases) and Phase 13's
backup script (38 cases) both pass. Anything needing a browser is untested here.

## What I did NOT touch
Prompt builder, Gemini code, the welcome panel / `EmptyLessons`, `backup.ts`, `lesson-schema.ts`, music, voice, README,
`initialLessons.ts`, accounts, analytics.
