// Writing quests, Phase Q6 — ranks and badges. Pure: no React, no localStorage, no DOM, no network and no clock reads
// (`today` is always passed in), so everything here is testable from a plain script
// (handoffs/phase-Q6-rewards-check.ts).
//
// Ranks, not XP (plan decision D4). A rank is a count of CARVED kanji (written right on two different local days),
// read THROUGH the lessons by `carvedCount`, so it is bounded by the curriculum: a later miss never lowers it, and it
// can only fall when the lesson that taught a kanji is deleted. The names and thresholds are one constant table below,
// so changing them is a one-line edit.
//
// Badges are computed from data the app already keeps, then stored once earned in `progress.badges`
// (badge id -> the local day it was first earned). The grant is silent (no toast) and idempotent: `grantBadges`
// returns the SAME object when nothing is new, so an effect that calls it cannot loop (the pattern of `addToReview`
// in `word-memory.ts`). A stored badge is never changed or removed here.
//
// Nothing in this file touches the Leitner schedule, the quiz counters, the study log or the writing records. It only
// reads them.
import { carvedCount, isCarved, poolKanji } from "@/lib/writing";
import { addDays, memoryFor, TOP_BOX } from "@/lib/word-memory";
import type { StudyLog } from "@/lib/study-log";
import type { DayLesson, UserProgressState, WritingRecord } from "@/types/japanese";

// ---------------------------------------------------------------------------------------------
// Ranks
// ---------------------------------------------------------------------------------------------

export interface Rank {
  /** 1 for the first rank. A learner below the first threshold has no rank (`rankOf` returns null). */
  level: number;
  /** The short glyph shown in the rank line. */
  glyph: string;
  name: string;
  /** Carved kanji needed to reach this rank. */
  carved: number;
}

/** The ladder (draft names and thresholds from the plan; Kiroku is a notebook that grows into an archive). */
export const RANKS: readonly Rank[] = [
  { level: 1, glyph: "一行", name: "First line", carved: 3 },
  { level: 2, glyph: "一頁", name: "One page", carved: 8 },
  { level: 3, glyph: "綴", name: "Bound", carved: 15 },
  { level: 4, glyph: "一冊", name: "A notebook", carved: 30 },
  { level: 5, glyph: "書棚", name: "Shelf", carved: 60 },
  { level: 6, glyph: "書庫", name: "Archive", carved: 100 },
];

/** The one sentence that explains what moves the rank. */
export const RANK_RULE =
  "Rank goes up as more kanji are written from memory on two different days.";

/** The highest rank reached with `carved` carved kanji, or null below the first threshold. */
export function rankOf(carved: number): Rank | null {
  let best: Rank | null = null;
  for (const rank of RANKS) if (carved >= rank.carved) best = rank;
  return best;
}

/** The next rank up, or null at the top rank. */
export function nextRank(carved: number): Rank | null {
  return RANKS.find((rank) => carved < rank.carved) ?? null;
}

/** How many more carved kanji the next rank needs (null at the top rank). Never negative. */
export function kanjiToNextRank(carved: number): number | null {
  const next = nextRank(carved);
  return next === null ? null : Math.max(0, next.carved - carved);
}

/**
 * The rank line, one sentence: `Rank 一行 First line · 5 more kanji to 一頁 One page`. Below the first rank:
 * `No rank yet · 3 more kanji to 一行 First line`. At the top: `Rank 書庫 Archive`.
 */
export function rankText(carved: number): string {
  const rank = rankOf(carved);
  const next = nextRank(carved);
  const here = rank === null ? "No rank yet" : `Rank ${rank.glyph} ${rank.name}`;
  if (next === null) return here;
  const left = Math.max(0, next.carved - carved);
  return `${here} · ${left} more kanji to ${next.glyph} ${next.name}`;
}

// ---------------------------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------------------------

export interface BadgeDef {
  /** Stored in `progress.badges`. Lowercase letters, digits and hyphens, at most 40 (the backup schema's rule). */
  id: string;
  name: string;
  /** What earns it, in a short sentence (shown for badges not earned yet). */
  how: string;
}

/** The 11 badges, in display order. */
export const BADGES: readonly BadgeDef[] = [
  { id: "first-answer", name: "First answer", how: "Answer a quiz question." },
  { id: "streak-3", name: "Three in a row", how: "Study three days in a row." },
  { id: "streak-7", name: "A full week", how: "Study seven days in a row." },
  { id: "streak-30", name: "A full month", how: "Study thirty days in a row." },
  {
    id: "first-mastered",
    name: "First one mastered",
    how: "Take a word to the top review box.",
  },
  { id: "mastered-20", name: "Twenty mastered", how: "Take twenty words to the top review box." },
  { id: "lessons-10", name: "Ten days of Japanese", how: "Save ten lessons." },
  {
    id: "first-carve",
    name: "First kanji carved",
    how: "Write a kanji right from memory on two different days.",
  },
  { id: "carved-10", name: "Ten carved", how: "Carve ten kanji." },
  { id: "hard-one", name: "A hard one", how: "Carve a kanji with twelve or more strokes." },
  {
    id: "checked-page",
    name: "Checked by photo",
    how: "Have a photo check match a kanji, then mark it right.",
  },
];

/** The threshold constants, named so the check script and the shelf text agree with the rules. */
export const STREAK_BADGES: readonly { id: string; days: number }[] = [
  { id: "streak-3", days: 3 },
  { id: "streak-7", days: 7 },
  { id: "streak-30", days: 30 },
];
export const MASTERED_FIRST = 1;
export const MASTERED_MANY = 20;
export const LESSONS_BADGE = 10;
export const CARVED_MANY = 10;
export const HARD_STROKES = 12;

/**
 * True only for a badge earned `today` or `yesterday` (the shelf marks these "New"). A day after `today` (a clock that
 * was set ahead, or a device that moved back) is not new, and neither is anything older than yesterday.
 */
export function isNewBadge(day: string, today: string): boolean {
  return day >= addDays(today, -1) && day <= today;
}

// ---- runs of study days -----------------------------------------------------------------------

/** The days in `log` with at least one answer, oldest first. Quest pages never write the study log, so this is quiz-only. */
function activeDays(log: StudyLog): string[] {
  return Object.keys(log)
    .filter((day) => (log[day]?.answered ?? 0) > 0)
    .sort();
}

/**
 * The length of the longest run of consecutive local days with at least one answer (0 for an empty log). Unlike
 * `streak()` it does not care about today: a run from last month counts.
 */
export function longestRun(log: StudyLog): number {
  const days = activeDays(log);
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    if (run > best) best = run;
    previous = day;
  }
  return best;
}

/**
 * The day on which the FIRST run of `length` consecutive active days was completed (the last day of that run), or null
 * when no such run exists. Used to date the study-log badges honestly instead of with the day the app noticed them.
 */
export function runCompletedOn(log: StudyLog, length: number): string | null {
  if (length < 1) return null;
  let run = 0;
  let previous: string | null = null;
  for (const day of activeDays(log)) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    if (run >= length) return day;
    previous = day;
  }
  return null;
}

// ---- what the data says -----------------------------------------------------------------------

/** What the badge rules read. `UserProgressState` satisfies it; nothing here writes any of these fields. */
export type BadgeProgress = Pick<
  UserProgressState,
  "studyLog" | "vocabMemory" | "writing" | "badges"
>;

/**
 * How many words that exist in the lessons are mastered by EARNING it (the top review box). The manual star does not
 * count, and a record written for different text (`memoryFor`) does not count either.
 */
export function earnedMasteredCount(
  lessons: readonly DayLesson[],
  memory: UserProgressState["vocabMemory"],
): number {
  const seen = new Set<string>();
  for (const lesson of lessons) {
    for (const word of lesson.vocab) {
      if (seen.has(word.id)) continue;
      if (memoryFor(memory, word)?.box === TOP_BOX) seen.add(word.id);
    }
  }
  return seen.size;
}

/** True when a carved kanji (through the lessons) has at least `HARD_STROKES` strokes in its lesson data. */
function hasCarvedHardKanji(
  lessons: readonly DayLesson[],
  writing: Readonly<Record<string, WritingRecord>>,
): boolean {
  return poolKanji(lessons).some(
    (entry) => isCarved(writing[entry.key]) && entry.kanji.strokes >= HARD_STROKES,
  );
}

/**
 * Every badge the data satisfies right now, as id -> the local day to record for it. The study-log badges
 * (`first-answer`, the streaks) are dated by the day the data proves (so a catch-up on an existing account does not say
 * "New" for something earned weeks ago, and two devices agree on the date); the rest have no date in the data and get
 * `today`. A pure read: nothing is stored here.
 */
export function evaluateBadges(
  lessons: readonly DayLesson[],
  progress: BadgeProgress,
  today: string,
): Record<string, string> {
  const earned: Record<string, string> = {};

  const firstActive = activeDays(progress.studyLog)[0];
  if (firstActive !== undefined) earned["first-answer"] = firstActive;

  for (const { id, days } of STREAK_BADGES) {
    const on = runCompletedOn(progress.studyLog, days);
    if (on !== null) earned[id] = on;
  }

  const mastered = earnedMasteredCount(lessons, progress.vocabMemory);
  if (mastered >= MASTERED_FIRST) earned["first-mastered"] = today;
  if (mastered >= MASTERED_MANY) earned["mastered-20"] = today;

  if (new Set(lessons.map((l) => l.dayNumber)).size >= LESSONS_BADGE) earned["lessons-10"] = today;

  const carved = carvedCount(lessons, progress.writing);
  if (carved >= 1) earned["first-carve"] = today;
  if (carved >= CARVED_MANY) earned["carved-10"] = today;
  if (hasCarvedHardKanji(lessons, progress.writing)) earned["hard-one"] = today;

  if (Object.values(progress.writing).some((rec) => rec.v === true)) earned["checked-page"] = today;

  return earned;
}

/**
 * `progress` with every newly earned badge added (never changed, never removed: a stored badge keeps its first day).
 * Returns the SAME object when nothing is new, so React and the caller can skip the update. Nothing but `badges` can
 * change, and nothing is written to the vocab memory, the study log, the quiz counters or the writing records.
 */
export function grantBadges<T extends BadgeProgress>(
  progress: T,
  lessons: readonly DayLesson[],
  today: string,
): T {
  const earned = evaluateBadges(lessons, progress, today);
  let next: Record<string, string> | null = null;
  for (const def of BADGES) {
    const day = earned[def.id];
    if (day === undefined || progress.badges[def.id] !== undefined) continue;
    next ??= { ...progress.badges };
    next[def.id] = day;
  }
  return next === null ? progress : { ...progress, badges: next };
}
