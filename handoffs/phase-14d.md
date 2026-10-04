# Handoff — Phase 14d: Harder question types
Date: 2026-10-03

## Summary
A "Due today" round no longer asks every word the same way. Each word is asked the way its Leitner box has earned:
**boxes 1–2** pick the meaning (the question you already know), **box 3** *choose the word* (see the English meaning,
pick the Japanese word from four), **boxes 4–5** *type the reading* (see the Japanese word and its meaning as a hint, type
the reading in kana). A word whose reading is the same as its written form (ありがとう, ノート with the reading のーと) or
whose stored reading is not usable kana gets *choose the word* instead of typing. The practice scopes (This day / All days /
Day range) are unchanged: always the plain question *unless the user picks a Question style (see the Addendum at the end)*. Every answer, of every kind, goes through the same `recordAnswer` /
`weakVocabIds` / score path as before, so there is **no schema change and the backup stays v2**.

## Files added
- `src/components/quiz/typed-answer.ts`: pure rules for a typed reading. `normalizeReading` (NFKC, drop spaces and punctuation,
  katakana → hiragana, keep ー), `readingAnswers` (every accepted answer for a stored reading), `isReadingCorrect`,
  `canTypeReading`, and `isSubmitKey` (the IME-safe Enter rule).
- `src/components/quiz/TypedAnswer.tsx`: the answer box (input, Check, "I don't know", and the "You typed / Reading" lines
  after answering). State + markup only.
- `handoffs/phase-14d-quiz-check.ts`: 87 pure checks (no browser).
- `handoffs/phase-14d-quiz-ui-check.tsx`: jsdom checks that drive `QuizView` (needs the temporary install in its header).
- `handoffs/phase-14d.md`: this file.

## Files changed
- `src/components/quiz/round.ts`: `RoundQuestion` gets `kind: "recognise" | "choose" | "type"` (required). New: `QuestionKind`,
  `DONT_KNOW` (the "I don't know" answer, `""`), `buildChooseOptions`, `kindForBox`, `kindForWord`, `correctAnswer`,
  `answerIsCorrect`, `kindsById`. `isCorrect` now understands all three kinds. `buildDueRound` picks each word's kind from its
  record; `buildRound` (practice) always makes plain questions; `buildRetryRound` takes an optional 4th argument (the kinds from
  `kindsById`) and keeps each word's question type. The random-number order for plain questions is unchanged, so the 14a/14b
  seeded checks still give the same results.
- `src/components/quiz/QuizView.tsx`: renders the three kinds; one `pick(value)` for picked options and typed text alike;
  verdict messages per kind; `Session` gets a `serial` so a typing box is never carried from one round to the next; "Retry
  missed words" keeps each word's kind; one extra sentence in the Due today helper line. The plain question's markup and
  classes are untouched (no caption, same spacing), so it looks exactly as before.
- `handoffs/phase-14a-quiz-check.ts`: one line gets `kind: "recognise"` so the hand-built question still type-checks.
- `PLAN.md`, `context.md`: updated (roadmap row, file map, the README-mismatch note).

## Data/schema changes
None. No new record fields, `vocabMemory` unchanged, `BACKUP_VERSION` stays 2, no new storage key, no new dependency.

## Behavior changes (what the user will notice, only in "Due today")
- **Plain question (box 1–2):** identical to before.
- **Choose the word (box 3):** small caption "Which word means this?", the English meaning large in the middle, four Japanese words
  as buttons (all different text; no word that shares the asked meaning, so there is never a second right answer). After
  answering, the right word is green with a tick, a wrong pick is red with a cross, and the line under the verdict shows the
  word with its reading (火 · ひ).
- **Type the reading (box 4–5):** caption "Type the reading in kana", the Japanese word large, its meaning underneath as a hint,
  a text box and two buttons, **Check** and **I don't know**. After answering the box turns green or red and read-only, and
  shows "You typed …" (if it was wrong and not skipped) and "Reading …" with the stored reading. **Enter** checks; after
  answering, **Enter** or the Next button goes on.
- A missed word is **retried the way it was asked** (a missed typed reading comes back as a typed reading).
- The Due today helper line gained: "The better you know a word, the harder it is asked: pick the meaning, then pick the word,
  then type the reading."

### What counts as a right typed answer
- Compared after Unicode NFKC, with spaces and punctuation removed and katakana turned into hiragana: `ｶﾀｶﾅ`, `カタカナ`,
  `かたかな` all match. ー is kept (らーめん). **Romaji is never accepted.**
- A stored reading with several readings accepts any one: separators `/ ／ 、 , ; |` and `・`. Text in round brackets is ignored
  (`たべる (to eat)` → たべる). `・` is ambiguous (it separates readings, but also sits inside katakana names like
  ジョン・スミス), so for `・` each side is accepted alone **and** the whole with the dot removed. A side that is not kana
  (kanji, romaji) is dropped; if nothing usable is left the word is never asked as typing.
- **IME:** Enter does not submit while the Japanese keyboard is converting (`isComposing`), nor on Safari's keyCode 229 just
  after conversion, and it is *not* cancelled in those cases, so the conversion still confirms. A held-down Enter (`repeat`)
  never submits or skips. Input attributes: `lang="ja"`, `autoComplete="off"`, `autoCapitalize="off"`, `autoCorrect="off"`,
  `spellCheck={false}`, `enterKeyHint="done"`. The box is focused when a typed question appears.
- Only punctuation or spaces counts as "nothing typed": Check is disabled and Enter does nothing; "I don't know" is the way out.

## Decisions I took (the plan said "ask the user"; no answer yet, so I used the plan's defaults)
- (a) box → type mapping exactly as the plan: boxes 1–2 → A, box 3 → B, boxes 4–5 → C. It is one function (`kindForBox`).
- (b) **Due-only.** "All days" and the other practice scopes stay plain even for words in review. *(Superseded by the Addendum: a "Question
  style" control now lets the user ask any style in any scope; the default "By progress" keeps this behaviour.)*
- (c) The meaning is shown as a **hint** in type C.
- (d) A missed type-C word (wrong or "I don't know") is a normal miss: box 1, due tomorrow, added to `weakVocabIds`.
Extras I decided (flag if you disagree):
- **Retry keeps the question type.** The alternative (retry everything as plain) is easier on the player but makes the retry a
  weaker test.
- **A typed answer is stored only in the round** (component state), like picked answers; nothing new is saved.
- **No tip or help-card change**, because the plan's constraints for Phase 14 say "nothing in the prompt builder, tips or
  backup". The Due today helper line (inside the quiz) carries the explanation instead. A one-sentence addition to the Quiz
  tip ("harder questions for words you know well") would be a natural follow-up if you want it; the user approves tip wording.
- Caption wording ("Which word means this?", "Type the reading in kana"), the placeholder "ひらがなで入力" and the verdict
  lines are mine; they are one-line strings in `QuizView.tsx` / `TypedAnswer.tsx`.

## What the next phase should know
- 14e (quiz more than vocab) can reuse `RoundQuestion.kind`; the kinds here are all about a *vocab word*, so 14e will probably
  want its own `kind` values or a second question shape rather than stretching these three.
- `answerIsCorrect(question, value)` is the single place that decides right/wrong for every kind; the UI never compares text.
- ~~Open question: someone without a Japanese keyboard cannot answer type C.~~ Resolved by the Addendum: pick the *Choose the word* style.
- A word in the top box (mastered) is asked as typing every 30 days; that is the intended "recall, not recognition" test.
- Words whose stored reading is not kana (e.g. an AI wrote romaji) quietly fall back to *choose the word*; nothing warns about it.

## What I did NOT touch
Backup format and `backup.ts`, `word-memory.ts` (box ladder, due rules, mastery), the prompt builder and Lesson Studio, tips and
the help card, `index.tsx`, `VocabList.tsx`, the welcome panel, Gemini code, `initialLessons.ts`, README, `package.json`.

## How it was tested (sandbox)
**I did not run any `npm` / `npx` command** (build, tsc, eslint, tsx, install), as asked. What I did instead:
- Read every changed file against `tsconfig.json`'s strictness (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
  `noPropertyAccessFromIndexSignature`, `noImplicitReturns`) by eye. **Expect to see the first `tsc` result.**
- Formatted my new and changed files with a standalone `prettier` 3.8.1 using the project's `.prettierrc`; `prettier --check`
  reports them clean. (The originals were clean too, so this added no unrelated changes.)
- Ran the pure scripts under plain `node --experimental-strip-types` with a throwaway resolver shim kept outside the project (it maps
  `@/` and stubs `zod`, which is not installed here): `phase-14d-quiz-check.ts` **87/87**, and as a regression check the
  older `phase-14a-quiz-check.ts` **47/47** and `phase-14b-fix-check.ts` **36/36**. This is a sanity check, not a replacement for your
  `npx tsx` run.
- **Not run at all:** `phase-14d-quiz-ui-check.tsx` (needs jsdom + Testing Library), the other older scripts, `tsc`, `eslint`,
  `vite build`, and anything in a real browser or with a real Japanese keyboard.

## Your part (commands)
1. `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. Pure checks: `npx tsx --tsconfig tsconfig.json handoffs/phase-14d-quiz-check.ts` (expect 87 PASS), and the older ones
   (`phase-14a-quiz-check.ts` 47, `phase-14b-fix-check.ts` 36, `phase-14b-memory-check.ts` 45, `phase-13-backup-check.ts` 45).
3. UI checks: `npm install --no-save --no-package-lock jsdom @testing-library/react @testing-library/dom`, then
   `npx tsx --tsconfig tsconfig.json handoffs/phase-14d-quiz-ui-check.tsx` and `handoffs/phase-14b-quiz-ui-check.tsx`
   (31 checks; the plain question must still pass untouched). Don't commit anything npm adds (`bun.lock` is the lockfile).

## Click-through (needs a browser; real Japanese keyboard for 5)
**Getting words into the higher boxes quickly.** Normally a word needs several due days to reach box 4. In the browser console
(after adding a day's words to review with the Vocab tab button) you can fast-forward them:
```js
const k = "kiroku_progress_v2", p = JSON.parse(localStorage.getItem(k));
Object.keys(p.vocabMemory).forEach((id, i) => { const r = p.vocabMemory[id]; r.box = [1, 2, 3, 4, 5][i % 5]; r.due = "2000-01-01"; });
localStorage.setItem(k, JSON.stringify(p)); location.reload();
```
(Do it with the app tab closed to other copies; it only edits review records.) Then:
1. Quiz → **Due today**: you should see a mix. One of each kind: a plain question, a *choose the word* (caption "Which word means
   this?"), a *type the reading* (caption "Type the reading in kana", meaning shown under the word).
2. Choose the word: pick wrong → right word green + tick, your pick red + cross, the reading line appears; the four options are
   all different Japanese text.
3. Type: a wrong answer (try romaji, e.g. `sensei`) → box turns red, "You typed sensei" and "Reading せんせい" appear; the word
   drops to box 1 (Vocab tab tooltip shows the box).
4. Type: **I don't know** → "You skipped this one", the reading appears, counts as a miss.
5. **Japanese keyboard:** type `かわ` and press Enter *to confirm the conversion*: it must NOT check the answer. A second Enter
   checks it. Also try katakana (`カワ`) and half-width: both accepted. On a phone, the keyboard's Enter/Go behaves the same way.
6. After answering, press Enter: goes to the next question. Hold Enter: it must not skip several questions.
7. A kana-only word in box 4–5 (e.g. ありがとう): asked as *choose the word*, never typing.
8. Finish a round with a typed miss → **Retry missed words**: the missed typed word comes back as a typed question.
9. This day / All days / Day range: only plain questions, no caption, no typing box, whatever the boxes.
10. **Phone width:** the typing box, Check and I don't know fit; the on-screen keyboard doesn't hide the question and buttons
    (scroll if needed); the four Japanese options fit two per row (one per row on very narrow screens).
11. Export a backup and restore it: still `"version": 2`, nothing new in the file.

---

# Addendum — Question style control + no repeated words in a round
Date: 2026-10-04. **Requested and approved by the user** after trying 14d: in "This day" they saw only the old question
(by design, but invisible), and a word (本 / book) repeated. The verifier's two suggestions were taken, small.

## What changed
1. **A "Question style" row** in the quiz (next to "Words per round"): **By progress** (default) / **Meaning** / **Choose the word** /
   **Type the reading**. It works in every scope.
   - *By progress* = exactly what 14d built: a Due today round asks each word by its box; This day / All days / Day range stay plain. Normal
     use is unchanged unless another style is picked.
   - *Meaning* = the plain question for every word. *Choose the word* = every word is "choose the word". *Type the reading* = every word is
     typed, except words with nothing to type (kana-only, or an unusable stored reading), which are asked as "choose the word"; a muted line
     under the controls says so when this style is on.
   - **No Japanese keyboard?** Pick *Choose the word* and no typed question can appear, in any scope, including Due today. This replaces the
     "skip typing" switch I suggested in the open question above; no extra switch exists.
   - Changing the style starts a fresh round (same as changing the scope). The choice is not saved: it resets when you leave the Quiz tab, like
     the scope and the round length.
   - Answers in any style go through the same path as before (`answerIsCorrect` → score, `weakVocabIds`, `recordAnswer`), so the Leitner box
     moves exactly as it does for the plain question: a right answer on a due word goes up a box, a miss goes to box 1, and a right answer on a
     word that is not due yet leaves its schedule alone. The style changes how a word is asked, never how it is scored.
   - The Due today helper line only says "the better you know a word, the harder it is asked" while the style is *By progress*.
2. **No repeated words in a round.** A round now asks each *word* once, where a word is the same Japanese text **and** the same reading
   (compared the forgiving way, so ほん and ホン are one word). Different readings of the same text (日 ひ / 日 にち) are still two words. When a
   word exists under several ids, the kept copy is **the one already in review, else the one from the earlier day**. Applies to practice
   rounds and Due rounds; "Retry missed" needs nothing extra because its words come from a round that was already de-duplicated.

## Files changed
- `src/components/quiz/round.ts`: new `uniqueWords(words, memory)`, `QuestionStyle`, `QUESTION_STYLES`, `DEFAULT_QUESTION_STYLE`,
  `kindForStyle(style, word, record)`. `buildRound` gets two optional trailing arguments `(…, distractors, style, memory)`;
  `buildDueRound` gets an optional trailing `style`; `dueWordsOverdueFirst` de-duplicates with `uniqueWords`. All new arguments default to
  the old behaviour, so existing callers and scripts are untouched.
- `src/components/quiz/QuizView.tsx`: `style` state, the control, the round key includes the style, the helper lines.
- `handoffs/phase-14d-quiz-check.ts`: 87 → **120** checks (styles in practice and Due rounds, the kana-only fallback, every dedupe rule).
- `handoffs/phase-14d-quiz-ui-check.tsx`: three new scenarios (the style row, 'Choose the word' leaving nothing to type, 'Meaning' in a Due round,
  a right 'choose' answer moving a box, a word taught on two days asked once with the in-review copy getting the answer).
- `PLAN.md`, `context.md`, this handoff.
No new file, no schema change, backup stays v2, no new dependency.

## Decisions I took (flag if you disagree)
- "Type the reading" does **not** drop kana-only words from the round (that would shrink rounds and could empty a small day); it asks them as
  "choose the word" and says so. 
- I did **not** make "New round" avoid the words of the last round (the user decided to skip it: with a small pool repeats between rounds are normal).
- The style is not stored in `localStorage` (no new key). If you want it remembered, it is one `kiroku_*` key and a small hook; ask first.

## Known limits
- The "Due today · N" counts (the button in the quiz and the badge on the tab) still count both copies when *both* ids of a repeated word are
  in review, while the round asks it once. Answering one copy does not update the other copy's record. This only happens if a user added both
  days' copies to review; fixing it means changing `index.tsx`'s badge too, so I left it.
- The quiz's `Missed` list and the Vocab tab still show every copy (only the *round* is de-duplicated).

## How it was tested
Same limits as the main handoff: **no npm / npx run by me**. Under plain `node --experimental-strip-types` with the throwaway shim:
`phase-14d-quiz-check.ts` **120/120**, `phase-14a-quiz-check.ts` 47/47, `phase-14b-fix-check.ts` 36/36. `prettier --check` is clean on the changed
files. The new jsdom scenarios were **not run** (no jsdom here); I desk-checked each assertion against the markup. The user ran the earlier 14d
build's scripts and reported all passing; they will need to re-run them on these files.

## Your part (commands)
`npx tsc --noEmit`, `npm run lint`, `npm run build`; then `npx tsx --tsconfig tsconfig.json handoffs/phase-14d-quiz-check.ts` (expect 120 PASS)
and, with the temporary jsdom install from the script header, `handoffs/phase-14d-quiz-ui-check.tsx` and `handoffs/phase-14b-quiz-ui-check.tsx`.

## Click-through
1. Quiz tab: a "Question style" row with four buttons; "By progress" is lit. This day / All days still ask the plain question.
2. Pick **Choose the word** in This day: the meaning is shown, you pick the Japanese word; nothing can be typed. Switch scope to Due today: same.
3. Pick **Type the reading** in This day: typed questions; a kana-only word comes as "choose the word"; the muted line explains it.
4. Pick **Meaning** in Due today: every word is plain, whatever its box.
5. Switch style mid-round: a fresh round starts.
6. Play two or more rounds of All days / Day range on a course that teaches the same word on two days (本): within one round the word appears once.
   If one of the copies is in review (Vocab tab "+"), your answer updates that copy's box.
7. Phone width: the style row wraps onto its own line(s) and nothing scrolls sideways.
