# Handoff — Phase 14a: Quiz rounds
Date: 2026-10-02

## Summary
The quiz now has rounds: a round has an end, a score, a missed-words list and a "Retry missed words" round.
`QuizView` moved out of `src/routes/index.tsx` into `src/components/quiz/QuizView.tsx`; the round logic is pure
and lives in `src/components/quiz/round.ts`. Misses now feed the existing `weakVocabIds`. No schema change, no
backup version bump, no new dependency, no new colour (uses `success`, `destructive`, `primary`, `bg-glass`).

## Files changed
- `src/routes/index.tsx`: old inline `QuizView` + `QuizScope`/`QUIZ_SCOPES` removed (409 -> 356 lines); one import
  added; `useMemo` dropped from the react import (no longer used there); `<QuizView>` gets a new `onBack` prop
  (`() => setTab("lesson")`). Nothing else touched.
- `PLAN.md` (14a row), `context.md` (README-mismatch bullet, file map).

## Files added
- `src/components/quiz/round.ts`: pure helpers — `buildRound`, `buildOptions`, `scoreRound`, `missedWords`,
  `buildRetryRound`, `updateWeakIds`, `shuffle`, `uniqueById`, `ROUND_LENGTHS`, `DEFAULT_ROUND_LENGTH`. Randomness is
  a parameter, so they are testable.
- `src/components/quiz/QuizView.tsx`: state + markup. Has its own small `Pane` (same classes as `GlassPane`, which
  isn't exported; `WelcomePanel` does the same).
- `handoffs/phase-14a-quiz-check.ts`: 43 no-browser cases. Run: `npx tsx --tsconfig tsconfig.json handoffs/phase-14a-quiz-check.ts`.
  Covers empty pool, pool smaller than the round, round lengths, repeated ids, 50 seeds of shared-meaning pools
  (options always unique, exactly one correct), scoring, unanswered != missed, retry, retry-of-retry, weak-id updates.

## Data/schema changes
None. `weakVocabIds` (existing) is now written; `totalQuizzesTaken` / `totalCorrectAnswers` unchanged in meaning.

## Decisions (the plan said "ask"; the user asked for a build without answering, so the plan's defaults were used)
(a) "Quiz taken" = **Option B**: `totalQuizzesTaken` still counts *answered questions* (+1 per answer, as before).
    Revisit in 14b. (b) Default round length **10** (choices 10 / 20 / All; pool smaller -> the pool).
(c) **Misses feed `weakVocabIds`**: a miss adds the id, a right answer removes it (also in Retry rounds). This changes
    what future AI prompts say about weak words — *needs the user's OK*; to switch it off, drop the `weakVocabIds:` line
    in `pick()` in `QuizView.tsx`. (d) A missed word does **not** come back inside the same round, only via "Retry missed".

## Behavior changes
- Counter reads "Day 3 · Question 4 of 10"; the last question's button is **Finish**.
- Answer locks after the first pick (buttons disabled). Right option always gets the green border + tick; a wrong pick
  gets a `destructive` border + X (before: the wrong pick used `primary`, the right one was never shown).
- Summary: `7 / 10`, missed list (Japanese, reading, meaning), **Retry missed words (N)** (only if something was
  missed), **New round**, **Back to lessons**. All right -> "全問正解".
- **End round** (small link under the question) -> summary of what was answered so far ("Ended early — 4 of 10").
  Ending before answering anything shows "You didn't answer any questions" (no retry button; nothing was missed).
  Unanswered words are never counted as misses and never touch `weakVocabIds`.
- "Words per round" toggle added next to the scope toggle. Changing scope, range, round length, or the set of words
  starts a fresh round. The round is keyed by the *word ids*, so an unrelated lessons update doesn't restart it.
- Quizzing is the only thing that writes `weakVocabIds`; Delete day / Reset already clear it.

## What the next phase (14b) should know
- Round answers live only in component state (`Session`); nothing about a round is stored. 14b should hook the
  per-answer update in `pick()` (it already runs once per answered question).
- `weakVocabIds` is now live data, so 14b's "weak = box 1 after a miss" must state how it relates (PLAN 14b point 6).
- Switching to another tab and back remounts `QuizView`, so an unfinished round is lost (answers already counted in
  progress stay counted). Acceptable for 14a; say so if 14b wants resume.

## How it was tested (builder sandbox)
`tsc --noEmit` clean; `npm run build` succeeds; ESLint: 0 real-rule errors (new files prettier-clean; `index.tsx`'s
pre-existing prettier noise unchanged in kind); 14a script (43), Phase 13 script (38) and 11b script (19) all pass.
Server-render smoke test of `QuizView` (12 words -> "Question 1 of 10"; 4 words -> "of 4"; no lessons / day without
vocab -> the existing empty messages and no End button). **Not tried in a real browser** (no browser in sandbox).

## Click-through for the verifier / user (needs a browser)
1. Quiz with 12+ words: "Question 1 of 10"; answer one wrong -> right option green + tick, picked one red + X; clicking
   another option does nothing. 2. Last question says **Finish** -> summary with score + missed list.
3. **Retry missed words** -> only those words, "Retry" in the counter; get one right, then check Progress/prompt
   still fine. 4. **New round** reshuffles. 5. **End round** after 3 answers -> "3 answered" summary.
6. Switch This day / All days / Range / Words per round mid-round -> fresh round. 7. Day with no vocab and the
   no-lessons state show the old messages. 8. Quick check on a phone width (the controls row wraps).
9. After a miss, build a new Learn prompt in the Studio and confirm the missed word is listed as weak.
10. Back to lessons returns to the Lessons tab.

## What I did NOT touch
Prompt builder, tips/help copy (Quiz tip wording is still accurate), backup/`backup.ts`, music, voice, welcome, Gemini,
README (still says nothing about rounds; flag only), `initialLessons.ts`, `ProgressView` numbers.
