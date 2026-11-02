// Writing quests, Phase Q9 — the pure numbers behind the "Your writing" section of the Write page: the 7-day bars, the
// totals line (right marks, checked by photo, marked by you) and `profileStats`, a small summary of the whole app that
// nothing publishes in this plan (it is the shape a later friends project would share). No React, no localStorage, no
// DOM, no network, no clock reads: `today` is always passed in, so everything is checkable from a plain script
// (handoffs/phase-Q9-stats-check.ts).
//
// Data comes from `progress.writingLog` (Q1/Q2): one entry per local day, `{ n, ok, p? }` = marks saved, marks right,
// right marks that carry a photo tick. The log keeps the last 120 days. Nothing here changes any data.
import { carvedCount, WRITING_LOG_KEEP } from "@/lib/writing";
import { BADGES, rankOf } from "@/lib/rewards";
import { lastNDays, streak, weekdayName, weekTotals } from "@/lib/study-log";
import { addDays, countMastered, isValidDay } from "@/lib/word-memory";
import type { DayLesson, UserProgressState, WritingDay } from "@/types/japanese";

/** Days in the bar chart (today last). */
export const WRITING_WEEK_DAYS = 7;
/** The bar scale never drops below this, so a normal 3-kanji page fills the chart height. */
export const WRITING_BAR_MIN_SCALE = 3;

// ---------------------------------------------------------------------------------------------
// One day, cleaned
// ---------------------------------------------------------------------------------------------

const whole = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;

/** The counts of one log entry, made safe: whole numbers, never negative, `ok <= n` and `p <= ok` (the clamp). */
function cleanCounts(entry: Readonly<WritingDay> | undefined): {
  n: number;
  ok: number;
  p: number;
} {
  const n = whole(entry?.n);
  const ok = Math.min(whole(entry?.ok), n);
  const p = Math.min(whole(entry?.p), ok);
  return { n, ok, p };
}

export interface WritingDayStat {
  /** Local day, "YYYY-MM-DD". */
  day: string;
  /** Marks saved that day. */
  n: number;
  /** Marks that were "Wrote it right". */
  ok: number;
  /** Right marks that carry a photo tick. */
  p: number;
}

/** The `days` days ending at `today`, oldest first; a day with no entry is all zeroes. Never changes `log`. */
export function weeklyWriting(
  log: Readonly<Record<string, WritingDay>>,
  today: string,
  days: number = WRITING_WEEK_DAYS,
): WritingDayStat[] {
  if (!isValidDay(today) || days < 1) return [];
  const out: WritingDayStat[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    out.push({ day, ...cleanCounts(log[day]) });
  }
  return out;
}

/** The bar scale: the busiest day, never less than `WRITING_BAR_MIN_SCALE`. */
export const writingScale = (days: readonly WritingDayStat[]): number =>
  Math.max(WRITING_BAR_MIN_SCALE, ...days.map((d) => d.n));

// ---------------------------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------------------------

export interface WritingTotals {
  /** Marks saved. */
  n: number;
  /** Right marks. */
  ok: number;
  /** Right marks that carry a photo tick (never more than `ok`). */
  p: number;
  /** Right marks marked by hand: `ok - p`. */
  byYou: number;
  /** Days with at least one saved mark. */
  days: number;
}

/**
 * The totals over the log. With `today`, only the last 120 days count (today and the 119 before it; the log itself is
 * only pruned when a page is saved, so an old entry can still be sitting there). Without `today`, every entry counts.
 * Each entry is cleaned first (`p` above `ok` is clamped), so a damaged day can never make `byYou` negative.
 */
export function writingTotals(
  log: Readonly<Record<string, WritingDay>>,
  today?: string,
): WritingTotals {
  const oldest =
    today !== undefined && isValidDay(today) ? addDays(today, -(WRITING_LOG_KEEP - 1)) : null;
  let n = 0;
  let ok = 0;
  let p = 0;
  let days = 0;
  for (const [day, entry] of Object.entries(log)) {
    if (!isValidDay(day)) continue;
    if (oldest !== null && today !== undefined && (day < oldest || day > today)) continue;
    const c = cleanCounts(entry);
    if (c.n === 0) continue;
    n += c.n;
    ok += c.ok;
    p += c.p;
    days++;
  }
  return { n, ok, p, byYou: ok - p, days };
}

/** True once at least one page has been saved (a mark in the window). The section is hidden before that. */
export const hasWritingHistory = (
  log: Readonly<Record<string, WritingDay>>,
  today?: string,
): boolean => writingTotals(log, today).n > 0;

/** The three parts of the totals line, so the screen can put a colour key in front of the last two. */
export function totalsParts(t: WritingTotals): {
  right: string;
  photo: string;
  byYou: string;
  window: string;
} {
  return {
    right: `Right marks: ${t.ok}`,
    photo: `Checked by photo: ${t.p}`,
    byYou: `Marked by you: ${t.byYou}`,
    window: `(last ${WRITING_LOG_KEEP} days)`,
  };
}

/** The totals line, exactly: `Right marks: 12 · Checked by photo: 4 · Marked by you: 8 (last 120 days)`. */
export function totalsLine(t: WritingTotals): string {
  const parts = totalsParts(t);
  return `${parts.right} · ${parts.photo} · ${parts.byYou} ${parts.window}`;
}

// ---------------------------------------------------------------------------------------------
// Words for the bars (visible text and screen-reader text)
// ---------------------------------------------------------------------------------------------

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The small number under a bar: `2/3` (right of saved), or a plain `0` for an empty day. */
export const dayCount = (d: WritingDayStat): string => (d.n === 0 ? "0" : `${d.ok}/${d.n}`);

/** One day in words: `Tuesday: 3 saved, 2 right.` / `Tuesday: none.` */
export function dayWords(d: WritingDayStat): string {
  const name = weekdayName(d.day, true);
  return d.n === 0 ? `${name}: none.` : `${name}: ${d.n} saved, ${d.ok} right.`;
}

/** The label above the bars, right side: `7 of 9 right` or `Nothing saved this week`. */
export function weekLabel(days: readonly WritingDayStat[]): string {
  const n = days.reduce((sum, d) => sum + d.n, 0);
  const ok = days.reduce((sum, d) => sum + d.ok, 0);
  return n === 0 ? "Nothing saved this week" : `${ok} of ${n} right`;
}

/** The whole week in one sentence, for the bars' `aria-label` (the 7 days are spelled out). */
export function weekAria(days: readonly WritingDayStat[]): string {
  const n = days.reduce((sum, d) => sum + d.n, 0);
  const ok = days.reduce((sum, d) => sum + d.ok, 0);
  const head =
    n === 0
      ? `Writing marks, last ${days.length} days: nothing saved this week.`
      : `Writing marks, last ${days.length} days: ${plural(n, "mark")} saved, ${ok} right.`;
  return `${head} ${days.map(dayWords).join(" ")}`;
}

// ---------------------------------------------------------------------------------------------
// profileStats: the whole-app summary (nothing publishes it in this plan)
// ---------------------------------------------------------------------------------------------

/**
 * Numbers only, plus the rank glyph: no name, no photo, no lesson text, no kanji. It is the shape the notes file
 * (section A) sketches for a future friends summary: rank id and glyph, carved kanji, study streak, answers this week,
 * words mastered, lessons, kanji, vocab and grammar counts, badge count, the 7-day answers and the 7-day writing marks.
 */
export interface ProfileStats {
  /** 0 = no rank yet, otherwise the rank level (1 to 6). */
  rankId: number;
  /** The rank glyph (`一行`), or "" while there is no rank yet. */
  rankGlyph: string;
  /** Kanji carved, counted through the lessons. */
  carved: number;
  /** Consecutive study days (the quiz streak, not a writing streak). */
  streak: number;
  /** Quiz answers in the last 7 days. */
  answersThisWeek: number;
  /** Words mastered (starred or in the top box), counted through the lessons. */
  mastered: number;
  /** Distinct lesson days. */
  lessons: number;
  /** Kanji taught, summed over the lessons (`lesson.kanji.length`, the same count Profile shows). */
  kanji: number;
  /** Distinct vocabulary words (by id). */
  vocab: number;
  /** Grammar points, summed over the lessons. */
  grammar: number;
  /** Known badges earned (ids in `BADGES`). */
  badges: number;
  /** Quiz answers per day, the last 7 days, oldest first. Always 7 numbers. */
  answers7: number[];
  /** Writing marks saved per day, the last 7 days, oldest first. Always 7 numbers. */
  writing7: number[];
}

const KNOWN_BADGE_IDS: ReadonlySet<string> = new Set(BADGES.map((b) => b.id));

/** The summary above. Pure; reads `progress` and `lessons`, changes neither. Safe on empty input. */
export function profileStats(
  progress: Pick<
    UserProgressState,
    "studyLog" | "vocabMemory" | "masteredVocabIds" | "writing" | "writingLog" | "badges"
  >,
  lessons: readonly DayLesson[],
  today: string,
): ProfileStats {
  const carved = carvedCount(lessons, progress.writing);
  const rank = rankOf(carved);

  const vocab = new Map<string, DayLesson["vocab"][number]>();
  let kanji = 0;
  let grammar = 0;
  for (const lesson of lessons) {
    kanji += lesson.kanji.length;
    grammar += lesson.grammar.length;
    for (const word of lesson.vocab) if (!vocab.has(word.id)) vocab.set(word.id, word);
  }

  const days7 = isValidDay(today) ? lastNDays(progress.studyLog, WRITING_WEEK_DAYS, today) : [];
  const week = weekTotals(days7);

  return {
    rankId: rank?.level ?? 0,
    rankGlyph: rank?.glyph ?? "",
    carved,
    streak: isValidDay(today) ? streak(progress.studyLog, today) : 0,
    answersThisWeek: week.answered,
    mastered: countMastered([...vocab.values()], progress.masteredVocabIds, progress.vocabMemory),
    lessons: new Set(lessons.map((l) => l.dayNumber)).size,
    kanji,
    vocab: vocab.size,
    grammar,
    badges: Object.keys(progress.badges).filter((id) => KNOWN_BADGE_IDS.has(id)).length,
    answers7: padWeek(days7.map((d) => d.answered)),
    writing7: padWeek(weeklyWriting(progress.writingLog, today).map((d) => d.n)),
  };
}

/** Always 7 numbers (zeroes when `today` was not a real day). */
const padWeek = (values: readonly number[]): number[] =>
  Array.from({ length: WRITING_WEEK_DAYS }, (_, i) => values[i] ?? 0);
