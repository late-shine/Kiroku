# Handoff — Phase 14c: Review words in the AI prompt
Date: 2026-10-03

## Summary
The Learn prompts (Learn + Save, Learn only) now end their "what you already know" block with one more paragraph: the words
that are **due for review**, taken from earlier days, most overdue first, at most 10. It asks the AI to use them again in
new example sentences and phrases, and says they are not new vocabulary. The Lesson Studio tells the user how many words go
in. Nothing is stored differently, so the backup stays v2.

**Wording status: APPROVED by the user (2026-10-03).** It lives in one place (see Files changed), so changing it is a one-string edit; nothing else depends on its exact text except the checks listed at the end.

## The prompt paragraph (approved)
> Words due for review — the learner's own review schedule says these are ready to be seen again. Use them again in new
> example sentences and phrases today (not sentences from earlier lessons), wherever they genuinely fit. They are NOT new
> vocabulary: keep today's vocabulary list entirely new words, and do not re-teach them or turn today into a review lesson:
> 水 (Water), …

The "NOT new vocabulary" sentence is there because the prompt asks for exactly N new vocab entries in a fixed JSON shape;
without it an AI could put review words into that list and break the day's count. It sits right after the existing "still
finds difficult" paragraph and before `=== TODAY'S LESSON REQUEST ===`, so Phase 3b's "everything before the request stays"
rule is respected.

## Files changed
- `src/lib/word-memory.ts`: new `dueWordsInOrder(words, memory, today)`: due words, oldest due date first, same date keeps
  lesson order, one per id. No shuffle (the quiz's `dueWordsOverdueFirst` shuffles ties; a prompt must not change text on every
  re-render).
- `src/lib/prompt-builder.ts`: new `REVIEW_PROMPT_CAP = 10`; new exported `reviewWordsForPrompt(day, lessons, progress, today)`;
  `PromptOptions` gets an optional `today` (YYYY-MM-DD; defaults to the real local day, tests pass a fixed one);
  `priorKnowledgeBlock` takes `today` and appends `reviewSummary` (the wording above) after the existing weak-words
  paragraph. Nothing else in the prompt text changed.
- `src/components/ai/LessonStudio.tsx`: imports `reviewWordsForPrompt`; a `reviewInPrompt` count (0 in Save only); a small
  muted line under the three mode hints when it is above 0: "N word(s) due for review will be added to this prompt, so your
  AI uses it/them again in new sentences." (This is the plan's "note in the prompt-mode help text". The three static
  `MODE_HINTS` are unchanged.)
- `PLAN.md`, `context.md`: updated (roadmap row, a note on the 14c exception to "no prompt changes", and the file notes).

## Files added
- `handoffs/phase-14c-prompt-check.ts`: 27 checks on the prompt text (see below).
- `handoffs/phase-14c.md`: this file.

## Which words go in
Words from lessons with `dayNumber` below the day being taught (the same "prior" set the known-vocabulary list uses), that
are **in review and due** (so untouched words never appear, which keeps a freshly restored course calm), then:
- words already named in the "still finds difficult" paragraph are left out (a missed word is both weak and due tomorrow, so
  without this it would be listed twice);
- a word whose Japanese text is already in the list is skipped (the sample course teaches 水 on two days under two ids);
- sorted most overdue first, cut at 10.
Day 1 and a course with no earlier days get nothing. Save only never gets it (it does not teach).

## Data/schema changes
None.

## Decisions I took
- The cap is 10, as the plan suggested. It is a named constant, not a setting.
- **No on/off switch** for the paragraph. If a user ever wants a lesson without it, the quick workaround is to answer or
  leave those words; a toggle would be a small follow-up if wanted.
- List format is `Japanese (meaning)`, matching the existing "difficult words" list (the readings are already in the
  known-vocabulary list just above).
- I did not touch the three `MODE_HINTS` texts or the help card; the new note is dynamic and only shows when it applies.

## What the next phase should know
- 14d (harder question types) does not touch this. If 14d adds "recall" records or boxes, `reviewWordsForPrompt` still only
  needs `isDue`, so it keeps working.
- Open: user approval of the paragraph wording and of the Studio note wording.

## What I did NOT touch
Backup format, the quiz, the Vocab tab, the box ladder, `MODE_HINTS`, the tips and help card, `initialLessons.ts`, README,
and `package.json`.

## How it was tested (sandbox)
Per the user's request I did **not** run `tsc --noEmit`, `vite build` or `eslint`; the user runs those. Type safety was
checked by reading only, so expect to see the first `tsc` result. The check scripts all pass under `tsx`:
14c-prompt-check 27 (new), 14b-fix-check 36, 14b-memory-check 45, 14a-quiz-check 47, 13-backup-check 45, 11b-tips-check 17,
14b-quiz-ui-check (jsdom) all pass. **Not tried in a real browser, and not tried against a real AI.**
What 14c-prompt-check covers: no records -> no section; Day 1 -> none; a due word is listed with its meaning, the older one
first; the section is before the lesson request; Learn only has it, Save only does not; later-due and re-imported (different
Japanese) records are skipped; earlier days only; the cap of 10 and the order; no repeated Japanese word; ties keep lesson
order; weak words are not repeated; the same data gives the same prompt twice.

## Micro phase 14c-1 — "AIs can ignore the prompt" tip (added after the user's ChatGPT test)
Done inside this phase at the user's request, after they tried the new prompt with ChatGPT. Scope: wording only.

**What happened in the test (from the user):** the first reply ignored most of the prompt and returned only the JSON code
block, with no lesson. Sending the same prompt again gave a full lesson, and that reply used a due review word (帰宅時間) in
an example, tied it to another review word (必要) in a separate example, and said it was doing so "without making it today's
focus". So the 14c paragraph works when the AI follows the prompt. The "JSON only" first reply is the old Phase 3b
behaviour (many AIs read "return ONE JSON code block" as "output only JSON"); 14c did not cause it and does not change it.

**The user's request:** Kiroku should say, in its tips, that AIs sometimes ignore parts of a prompt, and should point the
user to the AI's thinking mode.

**What changed (copy only, the prompt text is untouched):**
- `src/components/tips/tips.ts`: the Studio tip ("Three steps") has two new sentences before its last one: "AIs sometimes
  skip parts of a prompt: if you get only the data block and no lesson, send the same prompt again. Turning on thinking
  (reasoning) mode, if your AI has one, often helps."
- `src/components/tips/HelpCard.tsx`: a new short paragraph between the three steps and "No account and no key needed":
  "AIs sometimes ignore parts of a prompt, for example by replying with only the data block and no lesson. If that happens,
  send the same prompt again. Turning on thinking (reasoning) mode, if your AI has one, often helps."
- `PLAN.md`: the quoted "approved wording" for the Studio tip and the help card now matches the code (with a pointer here).
- `handoffs/phase-11b.md`: a one-line note that this wording was amended later.

**Decisions I took (flag if you disagree):**
- The wording is mine (the user asked me to fix it and had delegated tip wording before). It says "thinking (reasoning)
  mode" because AIs name it differently ("Thinking", "Extended thinking", "Reasoning", "Think longer"), and "often helps",
  not "fixes", because it is advice, not a guarantee.
- Both places carry it: the Studio tip is where a first-timer is, and the help card is the place an existing user (who
  already dismissed the tip) can still find it. The tip keeps its id (`studio`), so anyone who already dismissed it will
  not see the new sentences on the card; they can press "Show tips again" in the help card, and the help card always has them.
- No new tip card and no new storage. The 11b tips check only asserts that every tip has a title and a body, so it is
  unchanged and still passes (17 checks).
- I did **not** make Kiroku detect a JSON-only reply (it can already import it; the user just wouldn't have the lesson
  text). A small hint on the Import step for "your reply has a data block but no lesson" is a possible follow-up, not built.

**Files in this micro phase:** `src/components/tips/tips.ts`, `src/components/tips/HelpCard.tsx`, `PLAN.md`,
`handoffs/phase-11b.md`, this handoff. Prettier-clean. `tsc --noEmit` and `npm run build` were not run by me; the user ran
them on the 14c build before this micro phase (both passed) and will re-run on the final files.

## Click-through (needs a browser, and ideally a real AI)
1. With no words in review, open the Lesson Studio for a day after your last: no review note under the mode hints, and the
   copied prompt has no "Words due for review" paragraph.
2. Add a day's words to review (Vocab tab), reopen the Studio for a later day: the note says how many (up to 10) and the
   copied prompt has the paragraph just before `=== TODAY'S LESSON REQUEST`.
3. Switch to Save only: the note disappears and the prompt has no paragraph. Back to Learn only: it returns.
4. Answer one of those words wrong in a quiz (it becomes "difficult"): it is now in the older "still finds difficult"
   paragraph and no longer in the review paragraph.
5. Paste the prompt into a real AI: check that it re-uses those words in examples, does NOT put them in the new vocab list,
   and still ends with a valid JSON block that imports.
   *(Done by the user with ChatGPT on the 14c build: after one retry it reused the review words in examples; see the micro
   phase above for what happened. Whether the reply's JSON imported was not reported.)*
6. Open the Studio tip and the "?" help card: both mention that AIs sometimes ignore parts of a prompt and suggest thinking mode.
