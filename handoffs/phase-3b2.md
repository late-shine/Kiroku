# Handoff — Phase 3b2: Save-only cross-AI safety fix
Date: 2026-09-27

## Summary
Fixed a real gap in `save-only` mode: its prompt relied on "our conversation above" for
lesson context, which silently fails if the user pastes it into a *different or fresh* AI
chat than the one that actually taught them — including via Kiroku's own "Open Gemini/
ChatGPT/Claude" links, which always start an empty conversation. The AI could fill that gap
by fabricating a plausible-sounding lesson instead of saying so. Fixed with two changes: an
optional textarea to embed the actual lesson text directly into the copied prompt (removes
the failure mode structurally), and an explicit anti-fabrication instruction for the case
where the user doesn't fill it in and is relying on same-conversation history instead.

## Files changed
- `src/lib/prompt-builder.ts`: `PromptOptions` gained `existingLessonText: string` (required,
  same "empty string means not set" pattern as `customFocus` — not `?:`, to stay clean under
  `exactOptionalPropertyTypes`). `buildSaveOnlyPrompt` gained a third parameter,
  `existingLessonText = ""` (a JS default parameter, not an optional object field — so
  Phase 3b's documented 2-arg call, `buildSaveOnlyPrompt(day, vocabCount)`, still works
  unchanged for whoever builds Phase 3c). Rewrote its body into two branches: lesson text
  provided → embed it verbatim in a `"""`-delimited block with "convert ONLY this, don't
  add anything"; not provided → same-conversation wording plus an explicit "if you don't
  actually have this, stop and ask — don't invent a plausible Day X" instruction.
  `buildLessonPrompt` now destructures and forwards `existingLessonText`.
- `src/components/ai/LessonStudio.tsx`: added `existingLessonText` state (plain `useState("")`
  — intentionally **not** added to `StoredOptions`/persisted to `localStorage`, since it's
  per-generation pasted content, not a standing preference, same treatment as the Import
  step's own `pasted` state). Added a textarea in the `save-only` branch of the Configure
  step, above the existing vocab-count grid, with an inline caption explaining when to leave
  it blank vs. fill it in — doing the job of a separate dismissible note without adding one.

## Files added
- `handoffs/phase-3b2.md` — this file.

## Data/schema changes
None. No `DayLesson`/zod schema change, no `localStorage` key/version change.

## Behavior changes
- `save-only` mode's Configure step now shows a lesson-text textarea before vocab count.
- The copied `save-only` prompt differs depending on whether that textarea has content —
  users won't notice this as a "change" so much as the feature now actually being safe to
  use across different AI chats, which it wasn't before.

## What the next phase should know
- Phase 3c's planned reuse of `buildSaveOnlyPrompt(day, vocabCount)` is unaffected — the new
  param has a default and doesn't break that 2-arg call shape.
- If Phase 3c builds the "repair on failure" or "Save with Gemini" automation, it should
  almost certainly also take the pasted/existing lesson text as an input to the same
  function, for the identical reason this fix exists — an automated call has even less
  implicit "conversation context" to fall back on than a human pasting into a chat does.

## What I did NOT touch
- Nothing in `learn-save`/`learn-only` — this gap is specific to `save-only`, since those two
  modes hand the AI full prior-knowledge context directly in the prompt rather than asking
  it to recall something from outside it.
- The dismissible-note-box idea (option 3 from the original three-option discussion) —
  deliberately not built; the textarea's own caption does that job instead, per the user's
  choice to go with options 1+2 only.
