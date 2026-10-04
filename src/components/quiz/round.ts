// Phase 14a — pure helpers for a quiz round. No React, no browser, no storage: everything here
// takes its randomness as a parameter so it can be tested from a plain script
// (handoffs/phase-14a-quiz-check.ts; the question kinds added in 14d: handoffs/phase-14d-quiz-check.ts).
import type { VocabWord, WordMemory } from "@/types/japanese";
import { dueWords, memoryFor, type VocabMemory } from "@/lib/word-memory";
import { canTypeReading, isReadingCorrect, normalizeReading } from "./typed-answer";

export type RoundLength = 10 | 20 | "all";
export const ROUND_LENGTHS: { id: RoundLength; label: string }[] = [
  { id: 10, label: "10" },
  { id: 20, label: "20" },
  { id: "all", label: "All" },
];
export const DEFAULT_ROUND_LENGTH: RoundLength = 10;

/**
 * How a word is asked (Phase 14d). A = recognise: see the Japanese, pick the meaning. B = choose: see the
 * meaning, pick the Japanese word. C = type: see the Japanese and its meaning, type the reading in kana.
 */
export type QuestionKind = "recognise" | "choose" | "type";

/**
 * One question: the word, how it is asked, and its (already shuffled, already unique) answer options. For
 * "recognise" the options are meanings, for "choose" they are Japanese words, for "type" there are none.
 */
export interface RoundQuestion {
  word: VocabWord;
  kind: QuestionKind;
  options: string[];
}

/**
 * answers[wordId] = what the user answered: the meaning or the Japanese word they picked, or the reading they
 * typed. A word with no entry has not been answered yet. `DONT_KNOW` ("") is the "I don't know" button; it can
 * never be a typed answer (an empty box cannot be submitted), so it is always a miss.
 */
export type RoundAnswers = Record<string, string>;
export const DONT_KNOW = "";

export type Rng = () => number;

/** Fisher–Yates; returns a new array and never touches the input. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/** The same word id appearing twice (it shouldn't) is asked once. */
export function uniqueById(words: readonly VocabWord[]): VocabWord[] {
  const seen = new Set<string>();
  return words.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
}

/**
 * One entry per distinct word. The same word taught on two days comes back under two ids (the sample course has
 * 本 on Day 1 and Day 3), and asking it twice in one round looks like a repeat. Two entries are "the same word" when
 * their Japanese text AND reading match (the reading is compared the forgiving way, so ほん and ホン agree).
 * Of a pair, the copy that is already in review is kept (its box and due date are the ones that matter), else the
 * one from the earlier day, else the first given. Order follows the first appearance of each word.
 */
export function uniqueWords(words: readonly VocabWord[], memory: VocabMemory = {}): VocabWord[] {
  const keyOf = (w: VocabWord) => `${w.japanese.trim()}\u0000${normalizeReading(w.reading)}`;
  const better = (a: VocabWord, b: VocabWord): boolean => {
    const aReview = memoryFor(memory, a) !== undefined;
    const bReview = memoryFor(memory, b) !== undefined;
    return aReview !== bReview ? aReview : a.day < b.day;
  };
  const kept = new Map<string, VocabWord>();
  for (const w of uniqueById(words)) {
    const key = keyOf(w);
    const current = kept.get(key);
    if (current === undefined || better(w, current)) kept.set(key, w);
  }
  return [...kept.values()];
}

/**
 * The correct meaning plus up to three wrong ones, shuffled. Wider scopes can hold words that share a
 * meaning, so wrong options are de-duplicated by text and never equal the correct text — every option
 * on screen is unique, which also means exactly one option is correct.
 */
export function buildOptions(
  word: VocabWord,
  pool: readonly VocabWord[],
  rng: Rng = Math.random,
): string[] {
  const wrong = [
    ...new Set(
      pool.filter((w) => w.id !== word.id && w.meaning !== word.meaning).map((w) => w.meaning),
    ),
  ];
  return shuffle([word.meaning, ...shuffle(wrong, rng).slice(0, 3)], rng);
}

/**
 * The Japanese word plus up to three wrong ones, shuffled ("choose the word" questions). The mirror of
 * `buildOptions`, with one extra rule: a wrong option must not be ANOTHER right answer, so words that share
 * the asked meaning are left out, and so are words written exactly like the asked word (the sample course
 * teaches 水 on two days under two ids). Every option on screen is a different Japanese text.
 */
export function buildChooseOptions(
  word: VocabWord,
  pool: readonly VocabWord[],
  rng: Rng = Math.random,
): string[] {
  const wrong = [
    ...new Set(
      pool
        .filter(
          (w) => w.id !== word.id && w.meaning !== word.meaning && w.japanese !== word.japanese,
        )
        .map((w) => w.japanese),
    ),
  ];
  return shuffle([word.japanese, ...shuffle(wrong, rng).slice(0, 3)], rng);
}

/** Which Leitner box earns which kind: boxes 1-2 recognise, box 3 choose, boxes 4-5 type. */
export function kindForBox(box: number): QuestionKind {
  if (box >= 4) return "type";
  if (box === 3) return "choose";
  return "recognise";
}

/**
 * How a word should be asked in a "Due today" round, from its record. A word with no record keeps the
 * plain question. A word whose reading cannot be typed (kana-only such as ありがとう, or an unusable
 * reading) never gets "type"; it gets "choose" instead.
 */
export function kindForWord(word: VocabWord, record: WordMemory | undefined): QuestionKind {
  if (!record) return "recognise";
  const kind = kindForBox(record.box);
  return kind === "type" && !canTypeReading(word) ? "choose" : kind;
}

/**
 * The "Question style" control (Phase 14d addendum). "progress" is the default: a Due today round asks each word the
 * way its box earns (`kindForWord`) and every other scope asks the plain question, exactly as before. The other three
 * ask every word the same way in every scope: "meaning" = pick the meaning, "choose" = pick the Japanese word,
 * "type" = type the reading.
 */
export type QuestionStyle = "progress" | "meaning" | "choose" | "type";
export const QUESTION_STYLES: { id: QuestionStyle; label: string }[] = [
  { id: "progress", label: "By progress" },
  { id: "meaning", label: "Meaning" },
  { id: "choose", label: "Choose the word" },
  { id: "type", label: "Type the reading" },
];
export const DEFAULT_QUESTION_STYLE: QuestionStyle = "progress";

/**
 * How one word is asked under a style. `record` is the word's review record and only matters for "progress"
 * (no record, which is every word outside a Due round, means the plain question). "type" falls back to "choose"
 * for a word whose reading cannot be typed (kana-only, or an unusable reading), because there is nothing to type.
 */
export function kindForStyle(
  style: QuestionStyle,
  word: VocabWord,
  record: WordMemory | undefined,
): QuestionKind {
  if (style === "meaning") return "recognise";
  if (style === "choose") return "choose";
  if (style === "type") return canTypeReading(word) ? "type" : "choose";
  return kindForWord(word, record);
}

function toQuestions(
  words: readonly VocabWord[],
  pool: readonly VocabWord[],
  rng: Rng,
  kindOf: (word: VocabWord) => QuestionKind = () => "recognise",
): RoundQuestion[] {
  return words.map((word) => {
    const kind = kindOf(word);
    const options =
      kind === "recognise"
        ? buildOptions(word, pool, rng)
        : kind === "choose"
          ? buildChooseOptions(word, pool, rng)
          : [];
    return { word, kind, options };
  });
}

/**
 * A new round: shuffle the pool once, take `length` words (or the whole pool if it is smaller, or
 * `"all"`), ask each once. An empty pool gives an empty round. Wrong options come from `distractors`
 * (default: the pool itself) — "Due today" passes every word so a 2-word round still has 4 options.
 * A word taught twice (same Japanese and reading under two ids) is asked once (`uniqueWords`, which keeps the
 * copy in `memory` if there is one). `style` defaults to "progress", which for a practice round means the plain
 * question for every word.
 */
export function buildRound(
  pool: readonly VocabWord[],
  length: RoundLength,
  rng: Rng = Math.random,
  distractors: readonly VocabWord[] = pool,
  style: QuestionStyle = DEFAULT_QUESTION_STYLE,
  memory: VocabMemory = {},
): RoundQuestion[] {
  const picked = shuffle(uniqueWords(pool, memory), rng);
  const words = length === "all" ? picked : picked.slice(0, length);
  return toQuestions(words, uniqueById(distractors), rng, (w) => kindForStyle(style, w, undefined));
}

/** The right answer as it is shown to the user: the meaning, the Japanese word, or the stored reading. */
export function correctAnswer(question: RoundQuestion): string {
  if (question.kind === "choose") return question.word.japanese;
  if (question.kind === "type") return question.word.reading;
  return question.word.meaning;
}

/**
 * Is `answer` right for this question? Picked options must equal the right option exactly; a typed reading is
 * compared the forgiving way (see typed-answer.ts). `DONT_KNOW` is never right.
 */
export function answerIsCorrect(question: RoundQuestion, answer: string): boolean {
  if (question.kind === "type") return isReadingCorrect(question.word.reading, answer);
  return answer === correctAnswer(question);
}

export function isCorrect(question: RoundQuestion, answers: RoundAnswers): boolean {
  const answer = answers[question.word.id];
  return answer !== undefined && answerIsCorrect(question, answer);
}

export interface RoundScore {
  correct: number;
  /** questions actually answered (less than the round size if it was ended early) */
  answered: number;
  /** questions in the round */
  total: number;
}

export function scoreRound(questions: readonly RoundQuestion[], answers: RoundAnswers): RoundScore {
  let correct = 0;
  let answered = 0;
  for (const q of questions) {
    if (answers[q.word.id] === undefined) continue;
    answered++;
    if (isCorrect(q, answers)) correct++;
  }
  return { correct, answered, total: questions.length };
}

/** Words that were answered wrongly, in round order. Unanswered words are NOT misses. */
export function missedWords(
  questions: readonly RoundQuestion[],
  answers: RoundAnswers,
): VocabWord[] {
  return questions
    .filter((q) => answers[q.word.id] !== undefined && !isCorrect(q, answers))
    .map((q) => q.word);
}

/** How each question in a round was asked, by word id (what "Retry missed" carries over). */
export function kindsById(questions: readonly RoundQuestion[]): Record<string, QuestionKind> {
  const kinds: Record<string, QuestionKind> = {};
  for (const q of questions) kinds[q.word.id] = q.kind;
  return kinds;
}

/**
 * The words that are due, most overdue first (oldest due date first). Words with the same due date come in
 * random order, because the shuffle happens first and the sort is stable.
 */
export function dueWordsOverdueFirst(
  words: readonly VocabWord[],
  memory: VocabMemory,
  today: string,
  rng: Rng = Math.random,
): VocabWord[] {
  const dueOf = (w: VocabWord) => memoryFor(memory, w)?.due ?? "";
  return shuffle(uniqueWords(dueWords(words, memory, today), memory), rng).sort((a, b) =>
    dueOf(a).localeCompare(dueOf(b)),
  );
}

/**
 * A "Due today" round: the first `length` due words, most overdue first (NOT shuffled, so the longest-waiting
 * words are asked first and a 10-word round never skips an overdue word for a fresher one). Distractors come
 * from `distractors` (every word), so even a 2-word round has four options. With the default style ("progress")
 * each word is asked the way its Leitner box earns (`kindForWord`, Phase 14d); another `style` asks every word the same way.
 */
export function buildDueRound(
  words: readonly VocabWord[],
  memory: VocabMemory,
  today: string,
  length: RoundLength,
  distractors: readonly VocabWord[] = words,
  rng: Rng = Math.random,
  style: QuestionStyle = DEFAULT_QUESTION_STYLE,
): RoundQuestion[] {
  const ordered = dueWordsOverdueFirst(words, memory, today, rng);
  const picked = length === "all" ? ordered : ordered.slice(0, length);
  return toQuestions(picked, uniqueById(distractors), rng, (w) =>
    kindForStyle(style, w, memoryFor(memory, w)),
  );
}

/**
 * A round of only the missed words (all of them, regardless of the round length). Distractors still
 * come from the full `pool`, so a retry isn't a 3-word multiple choice made of the same 3 words.
 * `kinds` (see `kindsById`) keeps each word's question type from the round it was missed in; a word with no
 * entry gets the plain question.
 */
export function buildRetryRound(
  missed: readonly VocabWord[],
  pool: readonly VocabWord[],
  rng: Rng = Math.random,
  kinds: Readonly<Record<string, QuestionKind>> = {},
): RoundQuestion[] {
  return toQuestions(
    shuffle(uniqueById(missed), rng),
    uniqueById(pool),
    rng,
    (w) => kinds[w.id] ?? "recognise",
  );
}

/**
 * `weakVocabIds` after one answer: a miss adds the id, a right answer removes it. Returns the same
 * array object when nothing changes so React can skip a re-render.
 */
export function updateWeakIds(weak: readonly string[], wordId: string, correct: boolean): string[] {
  const has = weak.includes(wordId);
  if (correct) return has ? weak.filter((id) => id !== wordId) : (weak as string[]);
  return has ? (weak as string[]) : [...weak, wordId];
}
