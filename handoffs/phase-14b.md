# Handoff — Phase 14b: Word memory + "Due today"
> **Superseded in part by Phase 14b-fix (`handoffs/phase-14b-fix.md`):** a word with no record is no longer "new, so due
> now". It is not in review, so it is not due, until the user adds it, answers it or misses it. Everything below about
> boxes, gaps, backup v2, mastery and cleanup still holds. The "all new words are due" lines (rules, behaviour notes
> and click-through step 1) describe the old behaviour.

Date: 2026-10-03

## Summary
Every quiz answer now updates a per-word record (Leitner box + due date) in `progress.vocabMemory`. The quiz has a 4th
scope, **Due today** (new words + words whose review day has come), with the live count on its button and a small
badge on the Quiz tab. Reaching the top box counts as "mastered". Backup format is **v2**. Built in one pass (the plan
allowed a split; data/backup and UI were both small enough). No new dependency, no new colour.

## Files added
- `src/lib/word-memory.ts` — pure: box ladder, `applyAnswer` / `recordAnswer`, local-calendar-day maths (`localDay`,
  `addDays`), `isDue`, `dueWords`, `masteryState`, `countMastered`, `pruneMemory`, the zod record schema, and
  `parseStoredMemory` (lenient reader for localStorage).
- `handoffs/phase-14b-memory-check.ts` (45 checks), `handoffs/phase-14b-quiz-ui-check.tsx` (20 interaction checks in
  jsdom; needs a temporary `npm install --no-save jsdom @testing-library/react @testing-library/dom`, see its header).

## Files changed
- `src/types/japanese.ts` — `WordMemory`; `UserProgressState.vocabMemory: Record<string, WordMemory>`.
- `src/lib/backup.ts` — `BACKUP_VERSION` 2; `vocabMemory` in the progress schema + `fillProgress`; new migration step
  v1 -> v2 (sets `progress.vocabMemory = {}`); header comment updated.
- `src/components/quiz/round.ts` — `buildRound` gets an optional 4th arg `distractors` (default: the pool).
- `src/components/quiz/QuizView.tsx` — new `memory` prop; "Due today" scope; `pick()` also writes `vocabMemory`.
- `src/routes/index.tsx` (356 -> 360 lines) — `vocabMemory: {}` default; `loadProgress` reads it leniently;
  `deleteDays` prunes it; both "mastered" counters and both star buttons use the new mastery rule; Header gets
  `quizDue` (badge, client-only via `mounted`); `<QuizView memory=…>`.
- `handoffs/phase-13-backup-check.ts` (34 -> 45 checks) and `phase-14a-quiz-check.ts` (43 -> 47) extended.
  `PLAN.md` (14b row), `context.md` (3 spots).

## Data/schema change (backup v2)
`progress.vocabMemory[id] = { japanese, box 1-5, due "YYYY-MM-DD" (local day), right, wrong, lastAnswered ISO }`.
Restore is strict (a bad record, box, date or id key refuses the whole file with a progress.vocabMemory message);
localStorage load is lenient (bad entries dropped, never throws). v0/v1 files restore with an empty memory.

## Rules implemented (please confirm — the plan said "ask")
- Boxes 1-5, gaps 1 / 3 / 7 / 14 / 30 days; no record = box 1, due now. Wrong answer -> box 1, due tomorrow
  (`MISS_RULE = "reset"` in word-memory.ts; `"down-one"` is a one-line switch and is tested).
- **Refinement 1 (mine, not in the plan): a right answer only moves a word up if it was due (or new).** A right answer on a
  not-due word still counts (right, lastAnswered) but leaves box/due alone. Without this, quizzing "All days" or a
  same-day "Retry missed" would climb words up the boxes ahead of schedule. Wrong answers always demote.
- **Refinement 2 (mine): each record stores the word's Japanese text.** The AI prompt re-emits ids `d{day}-{n}`, so a
  re-imported day with different words would silently inherit the old words' progress. A record whose text no longer
  matches is ignored (the word counts as new) and overwritten on its next answer. No import-code change was needed.
- Mastered = starred OR top box (5). Progress / Lessons "mastered" count = unique existing words meeting that
  (stale ids of deleted words no longer inflate it). Star button still toggles only the manual star; a word that is
  mastered only by review shows an outline star in the primary colour with the tooltip "Mastered through review".
- `weakVocabIds` stays exactly as in 14a (miss adds, right removes) and is independent of the boxes.
- Starred words are still scheduled for review like any other.

## Behaviour notes for the verifier
- "Due today" decides which words are due **when a round starts**; answering moves words out of due without shrinking or
  restarting the running round (the round key uses the whole vocabulary, not the due list). Tested in the UI script.
- Distractors in a due round come from every word, so a 2-word round still has 4 options.
- Nothing due -> "Nothing is due today…" message; "New round" after finishing the last due words shows it too.
- Round length (10/20/All) applies to due rounds. Order is random, not most-overdue-first.
- Days roll over at local midnight; the Quiz-tab badge is computed on render (no timer), so it updates on the next render.
- `totalQuizzesTaken` unchanged (+1 per answered question).

## Not done / decisions left
- The Quiz **tip** in `tips.ts` still says "Use This day, All days or Day range…" — left untouched (constraint), now missing
  "Due today". One-line copy change if the user wants it.
- The prompt builder does not use due/box data (weak words flow in as before). Suggestion for later: leave it that way —
  the prompt is for *new* lessons.
- Pre-existing, not changed: `masteredVocabIds` / `weakVocabIds` are keyed by id only, so they have the same re-import
  problem that Refinement 2 fixes for `vocabMemory`.
- Orphaned records (words deleted by re-import) stay in storage until overwritten; harmless, never counted.
- Note: the 14a handoff quoted check counts for the Phase 13 / 11b scripts (38 / 19) that were wrong. Real counts: 11b 17;
  Phase 13 was 34 before this phase, 45 now.

## How it was tested (sandbox)
`tsc --noEmit` clean; `npm run build` OK; ESLint: no real-rule errors (new/changed files prettier-clean);
scripts all pass: 14b-memory 45, 14b-quiz-ui 20 (jsdom, real component with state), 13-backup 45, 14a-quiz 47, 11b-tips 17.
`package.json` untouched, no lockfile. **Not tried in a real browser.**

## Click-through (needs a browser)
1. Fresh/old data: Quiz tab shows a badge with the number of words (all new words are due); "Due today · N" matches.
2. Due today -> answer a few -> counter stays "Question k of 10"; Finish -> summary; badge and button count drop.
3. New round -> only what is still due; with nothing due -> friendly message.
4. Progress tab: "mastered" count; star a word -> counts; a word only earned shows the outline star + tooltip (needs a word
   to reach box 5 — to fake it, edit `kiroku` progress in localStorage: set a record `box: 5`).
5. Export -> JSON has `"version": 2` and `progress.vocabMemory`. Restore that file -> records come back. Restore an OLD
   v1 backup -> succeeds, memory empty. Hand-break a record (box 9) -> refused with a plain message.
6. Delete a day -> its records go (check localStorage). Reset all -> memory empty.
7. Re-import a day with different words under the same ids -> those words behave as new (not due-later).
8. Reload the page: badge appears after load, no hydration warning in the console.
