// Phase 19b — what the Progress tab says about review. Pure: no React, no localStorage, no DOM, so it is checked
// from a plain script (handoffs/phase-19b-memory-check.ts). It only READS the review records
// (`progress.vocabMemory`), the weak ids and the stars; nothing here is stored, synced or backed up.
//
// Counting rules (the same ones the Quiz uses, so the numbers agree with Quiz -> Due today):
//  - a word is IN REVIEW only if it has a record that was written for the same Japanese text (`memoryFor`); a
//    record for different text under the same id is ignored, exactly as the quiz ignores it.
//  - due = in review and its due date is today or earlier (`isDue`). Overdue words are "due today".
//  - the four due buckets do not overlap and add up to the words in review: today (including overdue), tomorrow,
//    2-7 days, later (8 or more). Day 7 is in "2-7 days", day 8 is "later".
//  - weak (a quiz miss, `weakVocabIds`) and starred are separate from the boxes, as everywhere else.
//  - words are counted once per id, like `reviewCount`; the Quiz badge does not merge two ids that hold the same
//    word (the known 14d quirk), and neither does this.
import type { VocabWord } from "@/types/japanese";
import {
  BOX_GAPS,
  TOP_BOX,
  addDays,
  isDue,
  masteryState,
  memoryFor,
  type VocabMemory,
} from "@/lib/word-memory";

/** The last day that still counts as "within a week" (day 7 is in, day 8 is "later"). */
export const WEEK_DAYS = 7;

export type DueBucket = "today" | "tomorrow" | "week" | "later";

/** Which bucket a due date ("YYYY-MM-DD") falls in, seen from `today`. */
export function dueBucket(due: string, today: string): DueBucket {
  if (due <= today) return "today";
  if (due === addDays(today, 1)) return "tomorrow";
  if (due <= addDays(today, WEEK_DAYS)) return "week";
  return "later";
}

export interface MemorySummary {
  /** The words that exist now, one per id. */
  total: number;
  inReview: number;
  notInReview: number;
  /** Words in each Leitner box; index 0 is box 1. Always `TOP_BOX` long, and adds up to `inReview`. */
  boxes: number[];
  /** Words in review by due date; adds up to `inReview`. */
  due: Record<DueBucket, number>;
}

function oncePerId(words: readonly VocabWord[]): VocabWord[] {
  const seen = new Set<string>();
  return words.filter((w) => (seen.has(w.id) ? false : (seen.add(w.id), true)));
}

export function memorySummary(
  words: readonly VocabWord[],
  memory: VocabMemory,
  today: string,
): MemorySummary {
  const unique = oncePerId(words);
  const boxes: number[] = Array.from({ length: TOP_BOX }, () => 0);
  const due: Record<DueBucket, number> = { today: 0, tomorrow: 0, week: 0, later: 0 };
  let inReview = 0;
  for (const word of unique) {
    const rec = memoryFor(memory, word);
    if (!rec) continue;
    inReview += 1;
    boxes[rec.box - 1] = (boxes[rec.box - 1] ?? 0) + 1;
    due[dueBucket(rec.due, today)] += 1;
  }
  return { total: unique.length, inReview, notInReview: unique.length - inReview, boxes, due };
}

// ---- one word -----------------------------------------------------------------------------------

export interface WordStatus {
  inReview: boolean;
  /** 1..5 when in review, otherwise null. */
  box: number | null;
  /** In review and its day has come (overdue counts). */
  due: boolean;
  /** Missed in a quiz and not answered right since (`weakVocabIds`); independent of the boxes. */
  weak: boolean;
  /** Starred by the user OR in the top box (the same rule as the Mastered number). */
  mastered: boolean;
}

export function wordStatus(
  word: VocabWord,
  memory: VocabMemory,
  weakIds: readonly string[],
  today: string,
  starredIds: readonly string[] = [],
): WordStatus {
  const rec = memoryFor(memory, word);
  return {
    inReview: rec !== undefined,
    box: rec?.box ?? null,
    due: isDue(rec, today),
    weak: weakIds.includes(word.id),
    mastered: masteryState(word, starredIds, memory) !== "none",
  };
}

// ---- the word list: filters and search -----------------------------------------------------------

export type WordFilter = "all" | "due" | "weak" | "mastered" | "not-in-review";

export const WORD_FILTERS: readonly WordFilter[] = [
  "all",
  "due",
  "weak",
  "mastered",
  "not-in-review",
];

export const FILTER_LABELS: Record<WordFilter, string> = {
  all: "All",
  due: "Due",
  weak: "Weak",
  mastered: "Mastered",
  "not-in-review": "Not in review",
};

export interface WordEntry {
  word: VocabWord;
  status: WordStatus;
}

/** Every word with its status, in the order given (lesson order). */
export function describeWords(
  words: readonly VocabWord[],
  memory: VocabMemory,
  weakIds: readonly string[],
  starredIds: readonly string[],
  today: string,
): WordEntry[] {
  return words.map((word) => ({
    word,
    status: wordStatus(word, memory, weakIds, today, starredIds),
  }));
}

export function matchesFilter(status: WordStatus, filter: WordFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "due":
      return status.due;
    case "weak":
      return status.weak;
    case "mastered":
      return status.mastered;
    case "not-in-review":
      return !status.inReview;
  }
}

/** Search over the Japanese, the reading and the meaning, ignoring case and spaces around the query. */
export function matchesQuery(word: VocabWord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return `${word.japanese} ${word.reading} ${word.meaning}`.toLowerCase().includes(q);
}

/** How many words each filter holds (search is not applied, so a chip's number does not change while typing). */
export function filterCounts(entries: readonly WordEntry[]): Record<WordFilter, number> {
  const counts: Record<WordFilter, number> = {
    all: 0,
    due: 0,
    weak: 0,
    mastered: 0,
    "not-in-review": 0,
  };
  for (const { status } of entries) {
    for (const f of WORD_FILTERS) if (matchesFilter(status, f)) counts[f] += 1;
  }
  return counts;
}

export function visibleWords(
  entries: readonly WordEntry[],
  filter: WordFilter,
  query: string,
): WordEntry[] {
  return entries.filter((e) => matchesFilter(e.status, filter) && matchesQuery(e.word, query));
}

// ---- wording (all the Progress review text lives here, not in the components) --------------------

export const MEMORY_EMPTY =
  "Nothing in review yet. Words join when you add them from a lesson's Vocab tab or answer them in a quiz.";

export const DUE_ROW_LABELS: Record<DueBucket, string> = {
  today: "Due today",
  tomorrow: "Tomorrow",
  week: "In 2–7 days",
  later: "Later",
};

export const DUE_BUCKETS: readonly DueBucket[] = ["today", "tomorrow", "week", "later"];

/** "Box 3 · asks again after 7 days" — what a box means, for a tooltip. */
export function boxTitle(box: number): string {
  const gap = BOX_GAPS[box - 1] ?? 30;
  const top = box === TOP_BOX ? " · counts as mastered" : "";
  return `Box ${box} · asks again after ${gap} ${gap === 1 ? "day" : "days"}${top}`;
}

/** "12 in review · 118 not added yet" */
export function reviewLine(s: MemorySummary): string {
  return `${s.inReview} in review · ${s.notInReview} not added yet`;
}

/** The full-sentence description of the Memory block, for `aria-label`. */
export function memoryAriaLabel(s: MemorySummary): string {
  if (s.inReview === 0) return MEMORY_EMPTY;
  const boxes = s.boxes.map((n, i) => `box ${i + 1}: ${n}`).join(", ");
  const due = DUE_BUCKETS.map((b) => `${DUE_ROW_LABELS[b].toLowerCase()}: ${s.due[b]}`).join(", ");
  return `${s.inReview} words in review. By box, ${boxes}. By due date, ${due}.`;
}

/** What the list says when the current filter + search show nothing. */
export function emptyListMessage(filter: WordFilter, query: string): string {
  if (query.trim() !== "") {
    return filter === "all"
      ? "Nothing matches your search."
      : "Nothing matches your search in this filter. Try All.";
  }
  switch (filter) {
    case "due":
      return "Nothing is due today.";
    case "weak":
      return "No weak words right now.";
    case "mastered":
      return "Nothing mastered yet.";
    case "not-in-review":
      return "Every word is in review.";
    case "all":
      return "No words yet.";
  }
}

/** "Showing 12 of 134" */
export function showingLine(shown: number, total: number): string {
  return `Showing ${shown} of ${total}`;
}
