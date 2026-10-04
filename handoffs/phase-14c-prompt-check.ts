/**
 * Phase 14c — no-browser checks for the "review words in the AI prompt" section.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14c-prompt-check.ts
 * Exits non-zero if any case fails. Uses the sample course in src/data/initialLessons.ts as realistic test data
 * (the same trick as phase-13-backup-check.ts). Covers: no review words -> no section; the cap and the
 * most-overdue-first order; stable order on ties; only earlier days; only words in review and due; words already
 * listed as "difficult" are not repeated; Save only never carries them; the section sits before the lesson request.
 */
import { INITIAL_LESSONS } from "../src/data/initialLessons";
import {
  REVIEW_PROMPT_CAP,
  buildLessonPrompt,
  reviewWordsForPrompt,
  type PromptMode,
  type PromptOptions,
} from "../src/lib/prompt-builder";
import { addToReview, dueWordsInOrder } from "../src/lib/word-memory";
import type { UserProgressState, WordMemory } from "../src/types/japanese";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const TODAY = "2026-10-03";
const SECTION = "Words due for review";
const lessons = INITIAL_LESSONS;
const vocabOf = (day: number) => lessons.find((l) => l.dayNumber === day)!.vocab;
const rec = (japanese: string, due: string, box = 1): WordMemory => ({
  japanese,
  box,
  due,
  right: 1,
  wrong: 1,
  lastAnswered: "2026-10-01T10:00:00.000Z",
});
const progressWith = (
  vocabMemory: UserProgressState["vocabMemory"],
  weakVocabIds: string[] = [],
): UserProgressState => ({
  completedDays: [],
  currentDay: 1,
  masteredVocabIds: [],
  weakVocabIds,
  vocabMemory,
  totalQuizzesTaken: 0,
  totalCorrectAnswers: 0,
  backgroundIndex: 0,
  bgZoomSpeed: "still",
  showFurigana: true,
});
const opts = (
  day: number,
  progress: UserProgressState,
  mode: PromptMode = "learn-save",
): PromptOptions => ({
  day,
  tone: "gentle",
  style: "balanced",
  level: "N5",
  vocabCount: 10,
  romaji: false,
  customFocus: "",
  lessons,
  progress,
  mode,
  existingLessonText: "",
  today: TODAY,
});
const prompt = (day: number, p: UserProgressState, mode: PromptMode = "learn-save") =>
  buildLessonPrompt(opts(day, p, mode));

check(
  "test data: the sample course has days 1..13 with vocab",
  lessons.length >= 13 && vocabOf(1).length > 0,
);

// ---- nothing in review -> no section (a restored course starts calm) ----
{
  const p = prompt(14, progressWith({}));
  check("no records -> no review section", !p.includes(SECTION));
  check("no records -> the known-vocabulary block is still there", p.includes("Known vocabulary:"));
  check("Day 1 never has the section", !prompt(1, progressWith({})).includes(SECTION));
  check(
    "untouched words are not 'due': reviewWordsForPrompt is empty",
    reviewWordsForPrompt(14, lessons, progressWith({}), TODAY).length === 0,
  );
}

// ---- a few due words: listed with their meaning, in the learn modes only ----
{
  const [a, b] = [vocabOf(2)[0]!, vocabOf(3)[0]!];
  const memory = { [a.id]: rec(a.japanese, "2026-10-03"), [b.id]: rec(b.japanese, "2026-10-01") };
  const p = prompt(14, progressWith(memory));
  check("a due word puts the section in", p.includes(SECTION));
  check(
    "both words appear with their meaning",
    p.includes(`${a.japanese} (${a.meaning})`) && p.includes(`${b.japanese} (${b.meaning})`),
  );
  check(
    "the more overdue word is listed first",
    p.indexOf(`${b.japanese} (${b.meaning})`) < p.indexOf(`${a.japanese} (${a.meaning})`),
  );
  check("the section says they are not new vocabulary", p.includes("They are NOT new vocabulary"));
  const i = p.indexOf(SECTION);
  check(
    "the section comes before the lesson request",
    i > 0 && i < p.indexOf("=== TODAY'S LESSON REQUEST: DAY 14 ==="),
  );
  check(
    "learn-only carries it too",
    prompt(14, progressWith(memory), "learn-only").includes(SECTION),
  );
  check(
    "save-only never carries it",
    !prompt(14, progressWith(memory), "save-only").includes(SECTION),
  );
  check(
    "a word due LATER is not included",
    !prompt(14, progressWith({ [a.id]: rec(a.japanese, "2026-10-04") })).includes(SECTION),
  );
  check(
    "a record for different Japanese (re-imported day) is not included",
    !prompt(14, progressWith({ [a.id]: rec("別の語", "2026-10-01") })).includes(SECTION),
  );
  check(
    "the same data gives the same prompt twice",
    prompt(14, progressWith(memory)) === prompt(14, progressWith(memory)),
  );
}

// ---- only earlier days ----
{
  const early = vocabOf(2)[0]!;
  const late = vocabOf(9)[0]!;
  const memory = { [early.id]: rec(early.japanese, TODAY), [late.id]: rec(late.japanese, TODAY) };
  const words = reviewWordsForPrompt(5, lessons, progressWith(memory), TODAY).map((w) => w.id);
  check(
    "teaching Day 5: a Day 2 word is in, a Day 9 word is not",
    same(words, [early.id]),
    JSON.stringify(words),
  );
  check(
    "a word from the day being taught is not in",
    reviewWordsForPrompt(2, lessons, progressWith(memory), TODAY).length === 0,
  );
}

// ---- the cap and the order ----
{
  const words = [...vocabOf(1), ...vocabOf(2), ...vocabOf(3)]; // 30 words
  let memory = addToReview({}, words, new Date(2026, 9, 3, 12));
  // give each a distinct, increasing due date: words[0] is the most overdue
  memory = Object.fromEntries(
    words.map((w, i) => [w.id, rec(w.japanese, `2026-09-${String(1 + i).padStart(2, "0")}`)]),
  );
  const picked = reviewWordsForPrompt(14, lessons, progressWith(memory), TODAY);
  // (the sample course teaches a few words twice under different ids, so "the 10 most overdue" means 10 DIFFERENT words)
  const distinct = words.filter((w, i) => words.findIndex((x) => x.japanese === w.japanese) === i);
  check(
    `the cap is ${REVIEW_PROMPT_CAP}`,
    picked.length === REVIEW_PROMPT_CAP && REVIEW_PROMPT_CAP === 10,
  );
  check(
    "they are the 10 most overdue words, in that order",
    same(
      picked.map((w) => w.id),
      distinct.slice(0, 10).map((w) => w.id),
    ),
  );
  check(
    "no Japanese word is listed twice",
    new Set(picked.map((w) => w.japanese)).size === picked.length,
  );
  const p = prompt(14, progressWith(memory));
  const listed = p.split(SECTION)[1]!.split("=== TODAY'S")[0]!;
  check(
    "the 11th most overdue word is left out of the prompt text",
    !listed.includes(`${distinct[10]!.japanese} (${distinct[10]!.meaning})`),
  );
  check("the 10th is in", listed.includes(`${distinct[9]!.japanese} (${distinct[9]!.meaning})`));
}

// ---- ties keep lesson order; the same word is never listed twice ----
{
  const words = [...vocabOf(4).slice(0, 3), ...vocabOf(2).slice(0, 2)];
  const memory = Object.fromEntries(words.map((w) => [w.id, rec(w.japanese, "2026-10-01")]));
  const got = reviewWordsForPrompt(14, lessons, progressWith(memory), TODAY).map((w) => w.id);
  const expected = [...vocabOf(2).slice(0, 2), ...vocabOf(4).slice(0, 3)].map((w) => w.id);
  check(
    "same due date -> earlier lesson first, then lesson order",
    same(got, expected),
    JSON.stringify(got),
  );
  check(
    "dueWordsInOrder gives one entry per id",
    dueWordsInOrder([words[0]!, words[0]!], memory, TODAY).length === 1,
  );
}

// ---- words already in the 'difficult' list are not repeated ----
{
  const weak = vocabOf(3)[0]!;
  const other = vocabOf(3)[1]!;
  const memory = { [weak.id]: rec(weak.japanese, TODAY), [other.id]: rec(other.japanese, TODAY) };
  const p = prompt(14, progressWith(memory, [weak.id]));
  const reviewPart = p.split(SECTION)[1] ?? "";
  check(
    "a weak word is named once (in the difficult list), not again in the review list",
    p.split(`${weak.japanese} (${weak.meaning})`).length === 2 &&
      !reviewPart.includes(`${weak.japanese} (${weak.meaning})`),
  );
  check(
    "the other due word is in the review list",
    reviewPart.includes(`${other.japanese} (${other.meaning})`),
  );
  check(
    "if every due word is already 'difficult', there is no review section",
    !prompt(14, progressWith({ [weak.id]: rec(weak.japanese, TODAY) }, [weak.id])).includes(
      SECTION,
    ),
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
