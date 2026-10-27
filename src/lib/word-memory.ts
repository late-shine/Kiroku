// Phase 14b — per-word memory (Leitner boxes). Pure: no React, no localStorage, no DOM, so it is testable
// from a plain script (handoffs/phase-14b-memory-check.ts). Dates are LOCAL calendar days ("YYYY-MM-DD"),
// so "due tomorrow" means tomorrow morning, not 24 hours from now.
//
// Rules (PLAN.md, Phase 14b + 14b-fix "calm intake"):
//  - boxes 1-5, gaps 1, 3, 7, 14, 30 days.
//  - a word is IN REVIEW only if it has a record. A record is made when the user adds the word, answers it in
//    any quiz, or misses it. A word nobody has touched is just lesson content: it is NOT due. (14b treated
//    "no record" as "due now", which turned a restored 13-day course into a wall of 130 cards.)
//  - a wrong answer sends the word back to box 1 (MISS_RULE = "reset"; "down-one" is the alternative).
//  - a right answer moves a word up one box ONLY if it was due (or new). A right answer on a word that isn't
//    due yet still counts in right/lastAnswered but leaves box and due date alone, so quizzing "All days"
//    can't push words up the boxes faster than the schedule allows.
//  - the top box (5) counts as "mastered"; the user's star is a manual override on top of it.
//  - Reinforcement Phase 2: a record may carry a MISS STREAK (`streak`), the number of LOCAL days in a row whose
//    first real answer was a miss. Only the first real answer of a local day changes it (a miss adds 1, a right
//    answer resets it), so a same-day retry never does; "Add to review" never makes one; a missing `streak` means 0.
//    Phase 3 reads it (`src/lib/reinforcement.ts` builds the AI reinforcement list from it); the Leitner rules above are untouched.
import { z } from "zod";
import type { VocabWord, WordMemory } from "@/types/japanese";

export const BOX_GAPS = [1, 3, 7, 14, 30] as const;
export const TOP_BOX = BOX_GAPS.length;
export type MissRule = "reset" | "down-one";
export const MISS_RULE: MissRule = "reset";

export type VocabMemory = Record<string, WordMemory>;

// ---- local calendar days ----------------------------------------------------------------------

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The local calendar day of `d` as "YYYY-MM-DD". */
export function localDay(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${String(d.getFullYear()).padStart(4, "0")}-${month}-${day}`;
}

function parseDay(s: string): { y: number; m: number; d: number } | null {
  const match = DAY_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

export const isValidDay = (s: string): boolean => parseDay(s) !== null;

/** `day` plus `n` calendar days (month/year/leap-year/DST safe, because it goes through a local Date). */
export function addDays(day: string, n: number): string {
  const p = parseDay(day);
  if (!p) return day;
  return localDay(new Date(p.y, p.m - 1, p.d + n));
}

// ---- records ----------------------------------------------------------------------------------

const ID_RE = /^d\d+-\d+$/;

/** A record as stored. `streak` is optional (Reinforcement Phase 2): old records, old backups and old accounts have none. */
const storedRecordSchema = z.object({
  japanese: z.string(),
  box: z.number().int().min(1).max(TOP_BOX),
  due: z.string().refine(isValidDay, "due must be a real date like 2026-10-02"),
  right: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  lastAnswered: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "lastAnswered must be a date"),
  streak: z.number().int().nonnegative().optional(),
});

/**
 * The one definition of a valid record; the backup schema, the localStorage reader and the cloud decoder all use it.
 * Its output is always in CANONICAL form: `streak` is present only when it is 1 or more, and is never `undefined`
 * (the Firebase SDK throws on an undefined value, and `exactOptionalPropertyTypes` forbids it). A stored `streak: 0`
 * therefore reads back as "no streak", which is what keeps `snapshotsEqual` and the sync fingerprint stable.
 */
export const wordMemorySchema = storedRecordSchema.transform(
  ({ streak, ...rest }): WordMemory =>
    streak !== undefined && streak > 0 ? { ...rest, streak } : rest,
);
export const vocabMemorySchema = z.record(
  z.string().regex(ID_RE, "word ids look like d14-3"),
  wordMemorySchema,
);

/**
 * Lenient read for localStorage and the account: anything that isn't a valid record is dropped; never throws.
 * The one exception to "invalid means dropped" is a damaged `streak` on an otherwise valid record: that is read as
 * "no streak" instead, so a bad optional field can't cost a word its box and dates.
 */
export function parseStoredMemory(raw: unknown): VocabMemory {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: VocabMemory = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!ID_RE.test(id)) continue;
    const result = wordMemorySchema.safeParse(value);
    if (result.success) {
      out[id] = result.data;
    } else if (typeof value === "object" && value !== null && "streak" in value) {
      const withoutStreak: Record<string, unknown> = { ...value };
      delete withoutStreak["streak"];
      const retry = wordMemorySchema.safeParse(withoutStreak);
      if (retry.success) out[id] = retry.data;
    }
  }
  return out;
}

/** The word's record, or undefined if there is none or it was written for a different word under the same id. */
export function memoryFor(memory: VocabMemory, word: VocabWord): WordMemory | undefined {
  const rec = memory[word.id];
  return rec && rec.japanese === word.japanese ? rec : undefined;
}

/**
 * Due = in review AND its day has come. A word with no record is not in review, so it is never due
 * (calm intake). `memoryFor` already turns a record written for different text into `undefined`.
 */
export const isDue = (rec: WordMemory | undefined, today: string): boolean =>
  rec !== undefined && rec.due <= today;

/** True when the word has a (valid) record, i.e. the user added it, answered it or missed it. */
export const isInReview = (memory: VocabMemory, word: VocabWord): boolean =>
  memoryFor(memory, word) !== undefined;

/** How many of these words are in review (due now or not). */
export const reviewCount = (words: readonly VocabWord[], memory: VocabMemory): number =>
  uniqueIds(words).filter((w) => isInReview(memory, w)).length;

/** The words that are NOT in review yet, one entry per id. */
export const notInReview = (words: readonly VocabWord[], memory: VocabMemory): VocabWord[] =>
  uniqueIds(words).filter((w) => !isInReview(memory, w));

function uniqueIds(words: readonly VocabWord[]): VocabWord[] {
  const seen = new Set<string>();
  return words.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
}

/** Badge / button text for a count: "99+" once it gets big, so a number never crowds the tab. */
export const badgeText = (n: number): string => (n > 99 ? "99+" : String(n));

const gapFor = (box: number): number => BOX_GAPS[box - 1] ?? 30;

// ---- miss streak (Reinforcement Phase 2) ------------------------------------------------------

/** The record's miss streak: 0 when it has none (old data) or the stored value isn't a whole number of 1 or more. */
export function missStreakOf(rec: WordMemory | undefined): number {
  const s = rec?.streak;
  return typeof s === "number" && Number.isInteger(s) && s > 0 ? s : 0;
}

/**
 * True once the user has really answered the word in a quiz (right + wrong > 0). A word that was only "added to
 * review" has a record whose `lastAnswered` is the time it was added, but it has not been answered.
 */
export const hasRealAnswer = (rec: WordMemory | undefined): boolean =>
  rec !== undefined && rec.right + rec.wrong > 0;

/**
 * The LOCAL calendar day of the word's last REAL answer, or null when it has none (never answered, only added to
 * review) or `lastAnswered` can't be read. Converted on the device that asks, like every other local day here.
 */
export function lastAnswerDay(rec: WordMemory | undefined): string | null {
  if (rec === undefined || !hasRealAnswer(rec)) return null;
  const at = Date.parse(rec.lastAnswered);
  return Number.isNaN(at) ? null : localDay(new Date(at));
}

/**
 * The streak after one more answer on local day `today`. Only the FIRST real answer of a local day counts:
 * if the last real answer was on `today` (or, with a clock that went backwards, on a later day) this answer is a
 * same-day retry and the streak stays as it was. Otherwise a miss adds 1 and a right answer resets it to 0.
 * A word with no real answer yet (new, or only added to review) is treated as having a first answer now.
 */
function nextMissStreak(prev: WordMemory | undefined, correct: boolean, today: string): number {
  const before = missStreakOf(prev);
  const last = lastAnswerDay(prev);
  if (last !== null && last >= today) return before;
  return correct ? 0 : before + 1;
}

export function applyAnswer(
  word: VocabWord,
  prev: WordMemory | undefined,
  correct: boolean,
  now: Date = new Date(),
  missRule: MissRule = MISS_RULE,
): WordMemory {
  const today = localDay(now);
  let box = prev?.box ?? 1;
  let due = prev?.due ?? today;
  if (!correct) {
    box = missRule === "reset" ? 1 : Math.max(1, box - 1);
    due = addDays(today, gapFor(box));
  } else if (!prev || isDue(prev, today)) {
    // A brand-new word answered right climbs to box 2; "new" is decided here by `!prev`, not by `isDue`.
    box = Math.min(TOP_BOX, box + 1);
    due = addDays(today, gapFor(box));
  }
  const streak = nextMissStreak(prev, correct, today);
  const next: WordMemory = {
    japanese: word.japanese,
    box,
    due,
    right: (prev?.right ?? 0) + (correct ? 1 : 0),
    wrong: (prev?.wrong ?? 0) + (correct ? 0 : 1),
    lastAnswered: now.toISOString(),
  };
  // Canonical form: no `streak` key at all while it is 0 (see `wordMemorySchema`).
  return streak > 0 ? { ...next, streak } : next;
}

/** The memory after one answer (a new object; the input is never changed). */
export function recordAnswer(
  memory: VocabMemory,
  word: VocabWord,
  correct: boolean,
  now: Date = new Date(),
  missRule: MissRule = MISS_RULE,
): VocabMemory {
  return {
    ...memory,
    [word.id]: applyAnswer(word, memoryFor(memory, word), correct, now, missRule),
  };
}

/**
 * "Add to review": gives every word that has no record a fresh one (box 1, due today, 0 right, 0 wrong).
 * Words that already have a record are left exactly as they are, so adding can never reset progress.
 * `lastAnswered` is the time it was added (the record format needs a date; right + wrong = 0 shows it was never answered).
 * Returns the SAME object when there was nothing to add, so React can skip a re-render.
 */
export function addToReview(
  memory: VocabMemory,
  words: readonly VocabWord[],
  now: Date = new Date(),
): VocabMemory {
  const fresh = notInReview(words, memory);
  if (fresh.length === 0) return memory;
  const today = localDay(now);
  const next: VocabMemory = { ...memory };
  for (const w of fresh) {
    next[w.id] = {
      japanese: w.japanese,
      box: 1,
      due: today,
      right: 0,
      wrong: 0,
      lastAnswered: now.toISOString(),
    };
  }
  return next;
}

/** Keeps only the records whose id passes `keep` (used when days are deleted). */
export function pruneMemory(memory: VocabMemory, keep: (id: string) => boolean): VocabMemory {
  const out: VocabMemory = {};
  for (const [id, rec] of Object.entries(memory)) if (keep(id)) out[id] = rec;
  return out;
}

// ---- due + mastery ----------------------------------------------------------------------------

export const dueWords = (
  words: readonly VocabWord[],
  memory: VocabMemory,
  today: string,
): VocabWord[] => words.filter((w) => isDue(memoryFor(memory, w), today));

/**
 * The due words in a fixed order: oldest due date first (most overdue), words with the same due date in the
 * order they were given (lesson order), one entry per id. Unlike the quiz's `dueWordsOverdueFirst` there is no
 * shuffling, so the same data always gives the same list (the Lesson Studio prompt must not change text on
 * every re-render, and the prompt checks need a stable answer).
 */
export function dueWordsInOrder(
  words: readonly VocabWord[],
  memory: VocabMemory,
  today: string,
): VocabWord[] {
  const dueOf = (w: VocabWord) => memoryFor(memory, w)?.due ?? "";
  return uniqueIds(dueWords(words, memory, today))
    .map((w, i) => ({ w, i, due: dueOf(w) }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.i - b.i)
    .map((x) => x.w);
}

export type MasteryState = "starred" | "earned" | "none";

/** Mastered = starred by the user OR in the top box. Un-starring never fights the schedule. */
export function masteryState(
  word: VocabWord,
  starredIds: readonly string[],
  memory: VocabMemory,
): MasteryState {
  if (starredIds.includes(word.id)) return "starred";
  return memoryFor(memory, word)?.box === TOP_BOX ? "earned" : "none";
}

/** How many of these words (the words that exist now) are mastered. Stale ids of deleted words don't count. */
export function countMastered(
  words: readonly VocabWord[],
  starredIds: readonly string[],
  memory: VocabMemory,
): number {
  const starred = new Set(starredIds);
  return words.filter((w) => starred.has(w.id) || memoryFor(memory, w)?.box === TOP_BOX).length;
}
