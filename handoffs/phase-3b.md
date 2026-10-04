# Handoff — Phase 3b: Prompt rewrite (teach-then-save + Learn/Save mode toggle)
Date: 2026-09-27

## Summary
Rewrote the AI Lesson Studio's prompt so the target AI teaches Day X in natural prose first
and only appends the JSON data block afterward, instead of reading as an "output only JSON"
instruction. Added a 3-way `PromptMode` ("learn-save" | "learn-only" | "save-only") with a
toggle in the Configure step, defaulting to `learn-save`. No parser changes — `extractJsonBlock()`
already searches the whole reply for a fenced block, confirmed by reading `lesson-schema.ts`
(read-only, per the phase's file list).

## Files changed
- `src/lib/prompt-builder.ts`: added `PromptMode` type, `MODE_LABELS`/`MODE_HINTS`, `mode` field
  on `PromptOptions`. Replaced the old "Please teach Day X with exactly these sections... Return
  the lesson as exactly ONE JSON code block" wording with a shared `teachingInstructionsBlock()`
  (prose framing, same six-item content as before) and a `teachThenSaveBridge()` used only by
  `learn-save`. `buildLessonPrompt()` now branches on `mode`.
- `src/components/ai/LessonStudio.tsx`: added `mode` state (persisted in the existing
  `komorebi_ai_studio_v1` localStorage key via `StoredOptions`, with a safe fallback to
  `"learn-save"` for anyone with an older stored value that predates this field — no migration
  needed since it's an additive field, not a rename). Added the "Save mode" toggle + the three
  lines of guidance copy from PLAN.md, placed above the rest of the Configure step. When mode is
  `save-only`, the tone/style/JLPT-level/romaji/custom-focus controls are hidden (they don't
  affect that prompt) and only "Target day" + "Vocab count" remain, since `buildSaveOnlyPrompt`
  only needs those two.

## Files added
- `src/lib/prompt-builder.ts` — new exported function `buildSaveOnlyPrompt(day, vocabCount)`:
  the short "I already learned Day X... convert it into Kiroku's format" prompt, reusing the
  existing (unexported, unchanged) `schemaAndExampleBlock()`.
- `handoffs/phase-3b.md` — this file.

## Data/schema changes
None to `DayLesson`/the zod schema. `StoredOptions` (in `LessonStudio.tsx`, not a
`localStorage`-versioned schema bump) gained one new field, `mode: PromptMode`. Old stored
JSON without a `mode` key falls back to `"learn-save"` via the same `"x" in LABELS` guard
pattern already used for `tone`/`style`/etc. — no key rename, so no migration path needed.

## Behavior changes
- Default flow (`learn-save`) now asks the AI to teach in prose first, add one short
  transition sentence, then output the JSON block — instead of leading with "return JSON."
- Two new modes are selectable from Configure: `learn-only` (teaching prose, no JSON block —
  for follow-up questions before committing to Kiroku) and `save-only` (skips re-teaching,
  just asks the AI to convert an already-learned lesson into Kiroku's format).
- The Configure step's field layout now depends on the selected mode (see above).

## What the next phase should know
- Phase 3c (Gemini API smart import) can reuse `buildSaveOnlyPrompt(day, vocabCount)` directly
  as the payload for its "Save with Gemini" entry point — it was written standalone specifically
  so it wouldn't need new schema code, per PLAN.md.
- `MODE_LABELS` / `MODE_HINTS` live in `prompt-builder.ts` (not `LessonStudio.tsx`) to match the
  existing `TONE_LABELS`/`STYLE_LABELS` pattern — any future mode-aware UI should read from there.
- Not yet tested in a real browser (see the sandbox limitation below) — the user should click
  through Configure → Copy prompt for all three modes and confirm the preview text matches
  PLAN.md's spec before this is treated as confirmed-working.

## What I did NOT touch
- `src/lib/lesson-schema.ts` — read-only per the phase spec; confirmed `extractJsonBlock()`
  already tolerates prose around the JSON block, so no parser change was needed.
- Phase 3c (Gemini API / repair-on-failure / Save-only automation) — still just the design in
  PLAN.md, not implemented.
- The rebrand (Phase 4) — all `komorebi_*` keys and existing UI strings left as-is.

## A note on verification in this session
This sandbox has no `node_modules` (it was excluded from the uploaded zip to keep it small)
and no network access, so `tsc --noEmit`, `eslint`, and `npm run build` could not be run here —
only careful manual review against the existing strict `tsconfig.json` flags (especially
`noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `exactOptionalPropertyTypes`).
The verifier session (or the user, locally) should run all three before treating this as done.
