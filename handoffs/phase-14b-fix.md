# Handoff — Phase 14b-fix: Calm intake
Date: 2026-10-03

## Summary
A word is now **in review only if it has a record**. It gets one when the user adds it, answers it in any quiz, or misses
it. A word nobody has touched is just lesson content and is not due, so restoring a 13-day course shows "Due today · 0"
instead of 130. Words are added from the Lessons Vocab tab ("+" on a word, or one "Add this day's words to review (N)"
button). The badge and the Due today count only words in review (text capped at "99+"), and due rounds ask the most
overdue words first. No data change: records and the backup stay exactly as in 14b (**backup stays v2**).

## Files changed
- `src/lib/word-memory.ts`: `isDue` is now `rec !== undefined && rec.due <= today`. `applyAnswer` decides "new word"
  with `!prev` (so a new word answered right still goes to box 2; unchanged behaviour). New pure helpers: `isInReview`,
  `reviewCount`, `notInReview`, `addToReview`, `badgeText`. Header comment updated.
- `src/components/quiz/round.ts`: new `dueWordsOverdueFirst` (oldest due date first; ties random: shuffle, then a stable
  sort) and `buildDueRound` (takes the first N, does not shuffle them again; distractors from every word, so a 2-word round
  still has 4 options). `buildRound` is unchanged.
- `src/components/quiz/QuizView.tsx`: a new round now goes through one `startRound()` (due scope -> `buildDueRound`, other
  scopes -> `buildRound` as before; replaces `roundWords()`); the "Due today · N" button text is capped at 99+; the due-scope
  helper line and the empty message were rewritten (see Behaviour).
- `src/routes/index.tsx`: the one-line `Vocab` function removed and replaced by `<VocabList …/>`; badge text uses
  `badgeText` (the `title`/`aria-label` still carry the exact number); imports adjusted.
- `src/components/tips/tips.ts`: quiz tip gains one sentence about Due today (see the exact text under Behaviour).
- `handoffs/phase-14b-memory-check.ts`: three cases changed to the new rule (no record -> not due; replaced word -> not
  due; `dueWords` result). Still 45 checks. `handoffs/phase-14b-quiz-ui-check.tsx`: due scenarios now start with the words
  added to review; 11 new checks (untouched words, Vocab tab controls). 20 -> 31 checks.
- `handoffs/phase-14b.md`: a "superseded in part" note at the top. `PLAN.md`, `context.md`: updated.

## Files added
- `src/components/lesson/VocabList.tsx`: the Vocab tab (same list, same star), plus the add controls. Moved out of
  `index.tsx` so the shell does not grow.
- `handoffs/phase-14b-fix-check.ts`: 36 pure checks (130 untouched words -> 0 due; `addToReview` never resets an existing
  record and returns the same object when there is nothing to add; stale records are replaced; answering still creates a
  record; 99+ cap; overdue ordering and random ties; the due round keeps that order and has 4 options).

## Data/schema changes
None. `vocabMemory` has the same shape. One detail: a record made by "Add to review" has `box 1`, `due` = today,
`right 0`, `wrong 0`, and `lastAnswered` = the time it was added (the format needs a date). `right + wrong = 0` is how to
tell "added, never answered". Existing records are never touched by adding.

## Behavior changes
- Quiz badge and "Due today · N": only words in review whose day has come. 0 hides the badge, as before.
- Due today with nothing in review: "Nothing due. Add words from a lesson (Vocab tab), or practise any day with the other
  options above." With words in review but none due yet: "Nothing is due today — every word in review is scheduled for later.
  Come back tomorrow, or practise any day with the other options above." (The plan gave one message; I split it because
  the second case is not "add more".)
- Due scope helper line: "Only words you've added to review, most overdue first. Add words on the Vocab tab, or answer
  them in any quiz. Right answers push a word further out; a wrong answer brings it back tomorrow."
- Quiz tip: "Use This day, All days or Day range at the top. Due today asks only the words you've added to review.
  Questions come only from lessons you've saved in Kiroku." (It is one added sentence; tips already dismissed stay dismissed.)
- Vocab tab: a "+" on each word not in review (aria-label "Add <word> to review"); a check mark (title "In review · box N,
  due YYYY-MM-DD") on words that are. Above the list: "Add this day's words to review (N)", or, when N is 0, the quiet
  line "All of this day's words are in review." The star is unchanged and separate.
- Restore of a backup with no records: 0 due. Answering words in This day / All days / Range still creates records and
  puts them in review (decision (b)).

## Decisions I took (the plan said "ask the user"; you had not answered, so I used the verifier's leans)
- (a) Marking a day **Done** does NOT add its words. To change: add `vocabMemory: addToReview(p.vocabMemory, lesson.vocab)`
  inside `complete` in `index.tsx` (the Done toggle; it also un-completes, so add only when completing).
- (b) Answering a word that isn't in review **does** put it in review (as built in 14b). To change: in `QuizView.pick`,
  only call `recordAnswer` when the word is already in review (a miss would still need to add it).

## What the next phase should know
- 14c: `dueWordsOverdueFirst(words, memory, today)` in `round.ts` already returns the due words, most overdue first. Take the
  first 10 for the prompt. The "in review" set is `memoryFor(memory, word) !== undefined`.
- Removing a word from review is **not built** (adding is one-way; deleting its day or resetting clears records). If a
  mis-tap matters to the user, that is a small follow-up.
- Old limitation, unchanged: `masteredVocabIds` / `weakVocabIds` are keyed by id only (see the 14b handoff).

## What I did NOT touch
Backup format and `backup.ts`, the prompt builder and Gemini code, the box ladder and gaps, the mastery rule, `weakVocabIds`
rules, the welcome panel, `initialLessons.ts`, README.

## How it was tested (sandbox)
`tsc --noEmit` clean; `vite build` OK; ESLint 595 findings vs 596 before (all `prettier/prettier` on the old dense style in
`index.tsx`, plus the six `components/ui` `react-refresh` ones; new and changed files are prettier-clean). Scripts all pass:
14b-fix-check 36, 14b-memory-check 45, 14b-quiz-ui-check 31 (jsdom; needs the temporary install in its header), 13-backup-check 45,
14a-quiz-check 47, 11b-tips-check 17. `package.json` untouched, no lockfile. **Not tried in a real browser.**

## Click-through (needs a browser)
1. Restore a 13-day backup (or use existing data with no records): no badge on the Quiz tab; Due today · 0; clicking it shows
   "Nothing due. Add words from a lesson…".
2. Lessons -> Vocab: tap "Add this day's words to review (N)". The button becomes "All of this day's words are in review.",
   every word shows a check, and the Quiz badge shows N.
3. Tap "+" on a single word in another day: only that word is added, the day button count drops by one.
4. Due today -> a round of up to 10, most overdue first (add words on different days to see the order; with a fresh add they
   are all due today, so order is random). Answer some; the badge and count drop.
5. With more than 99 due, the badge reads "99+" and its tooltip still gives the exact number.
6. Star a word: it does not add the word to review. Mark a day Done: it does not add words.
7. Export -> `"version": 2`; Restore it; records come back. Delete a day -> its records go.
