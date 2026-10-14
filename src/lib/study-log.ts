// Phase 18a — the study log: how many quiz questions were answered (and how many were right) on each LOCAL
// calendar day. It is the data under the 7-day graph (Phase 18b). Pure: no React, no localStorage, no DOM, so it
// is testable from a plain script (handoffs/phase-18-study-log-check.ts).
//
// Why a log of its own: the app only keeps running totals, and a history can't be rebuilt from
// `vocabMemory.lastAnswered` (it keeps each word's LATEST answer, so past days would shrink as words are
// answered again). Days are the device's local calendar days, the same ones `word-memory.ts` uses for due dates.
import { z } from "zod";
import { addDays, isValidDay } from "@/lib/word-memory";
import type { StudyDay } from "@/types/japanese";

/** How many days the log keeps. Older days are dropped on write (and when a sync merges). */
export const STUDY_LOG_KEEP = 120;

export type StudyLog = Record<string, StudyDay>;

/** One day of the graph: `lastNDays` returns these, oldest first, with zeros for days with no record. */
export interface DayActivity extends StudyDay {
  day: string;
}

/** The one definition of a valid day entry; the backup schema uses it, and the localStorage reader uses it per entry. */
export const studyDaySchema = z
  .object({
    answered: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
  })
  .refine((d) => d.correct <= d.answered, "correct can't be more than answered");

/** Keys are real local days like 2026-10-13. */
export const studyLogSchema = z.record(
  z.string().refine(isValidDay, "study log days look like 2026-10-13"),
  studyDaySchema,
);

/** Lenient read for localStorage: anything that isn't a valid day entry is dropped; never throws. */
export function parseStoredStudyLog(raw: unknown): StudyLog {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const out: StudyLog = {};
  for (const [day, value] of Object.entries(raw)) {
    if (!isValidDay(day)) continue;
    const result = studyDaySchema.safeParse(value);
    if (result.success) out[day] = { answered: result.data.answered, correct: result.data.correct };
  }
  return out;
}

/** The log after one answer on `day` (a new object; the input is never changed). */
export function recordStudy(log: StudyLog, day: string, correct: boolean): StudyLog {
  const prev = log[day] ?? { answered: 0, correct: 0 };
  return {
    ...log,
    [day]: { answered: prev.answered + 1, correct: prev.correct + (correct ? 1 : 0) },
  };
}

/**
 * Drops days older than the last `keep` days ending at `today` (so `today` and the `keep - 1` days before it stay).
 * Days after `today` are kept (a device clock that was ahead must not erase anything). Returns the SAME object when
 * nothing was dropped, so React and the sync comparison can skip work.
 */
export function pruneLog(log: StudyLog, today: string, keep: number = STUDY_LOG_KEEP): StudyLog {
  const oldest = addDays(today, -(keep - 1));
  const days = Object.keys(log);
  if (days.every((day) => day >= oldest)) return log;
  const out: StudyLog = {};
  for (const day of days) {
    const entry = log[day];
    if (entry && day >= oldest) out[day] = entry;
  }
  return out;
}

/** The `n` days ending at `today`, oldest first; a day with no record is `{ answered: 0, correct: 0 }`. */
export function lastNDays(log: StudyLog, n: number, today: string): DayActivity[] {
  const out: DayActivity[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = addDays(today, -i);
    const entry = log[day];
    out.push({ day, answered: entry?.answered ?? 0, correct: entry?.correct ?? 0 });
  }
  return out;
}

/**
 * Consecutive days with at least one answer, counting back from today. Today does not have to be non-empty yet:
 * if nothing was answered today the count starts from yesterday, so a streak is not "lost" at 00:01.
 */
export function streak(log: StudyLog, today: string): number {
  const active = (day: string) => (log[day]?.answered ?? 0) > 0;
  let day = active(today) ? today : addDays(today, -1);
  let count = 0;
  while (active(day)) {
    count++;
    day = addDays(day, -1);
  }
  return count;
}

/** True when the log has at least one answer on any day. */
export const hasStudyHistory = (log: StudyLog): boolean =>
  Object.values(log).some((d) => d.answered > 0);

/**
 * The short word beside the graph, from the days shown (usually 7). `hasHistory` says whether the WHOLE log has any
 * answer, so "No answers yet" (never studied) and "Quiet week" (studied before, nothing in these days) differ.
 * It defaults to "something in these days", which is right when only the shown days are known.
 */
export function rhythmLabel(
  days: readonly StudyDay[],
  hasHistory: boolean = days.some((d) => d.answered > 0),
): string {
  const active = days.filter((d) => d.answered > 0).length;
  if (active === 0) return hasHistory ? "Quiet week" : "No answers yet";
  if (active <= 2) return "Warming up";
  if (active <= 4) return "Finding a rhythm";
  return "Steady";
}

/**
 * Merges two logs for sync: per day, the larger `answered` and the larger `correct` (the trade-off the two running
 * counters already make: two devices answering on the same day do not add up). `correct <= answered` survives,
 * because each side already had it and the max of each is taken.
 */
export function mergeLogs(a: StudyLog, b: StudyLog): StudyLog {
  const out: StudyLog = {};
  for (const day of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[day];
    const y = b[day];
    out[day] = {
      answered: Math.max(x?.answered ?? 0, y?.answered ?? 0),
      correct: Math.max(x?.correct ?? 0, y?.correct ?? 0),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Phase 18b — what the 7-day chart shows. Pure text and numbers, so the wording is checkable without a browser
// (handoffs/phase-18-study-log-check.ts); `src/components/progress/RhythmChart.tsx` only draws them.
// ---------------------------------------------------------------------------------------------

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** 0 = Sunday … 6 = Saturday for a local day "YYYY-MM-DD", or null when `day` is not a real day. */
export function weekdayOf(day: string): number | null {
  if (!isValidDay(day)) return null;
  return new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
  ).getDay();
}

/** "Tue" / "Tuesday" for a local day ("" when it is not a real day). */
export function weekdayName(day: string, long = false): string {
  const n = weekdayOf(day);
  const name = n === null ? undefined : WEEKDAY_NAMES[n];
  return name === undefined ? "" : long ? name : name.slice(0, 3);
}

/** The bar scale: the tallest day, but never less than 10, so a day with 1-2 answers stays visible without filling the chart. */
export const chartScale = (days: readonly StudyDay[]): number =>
  Math.max(10, ...days.map((d) => d.answered));

export interface WeekTotals {
  answered: number;
  correct: number;
  /** Days with at least one answer. */
  activeDays: number;
  /** Whole-number share of right answers, or null when nothing was answered. */
  percentRight: number | null;
}

export function weekTotals(days: readonly StudyDay[]): WeekTotals {
  const answered = days.reduce((n, d) => n + d.answered, 0);
  const correct = days.reduce((n, d) => n + d.correct, 0);
  return {
    answered,
    correct,
    activeDays: days.filter((d) => d.answered > 0).length,
    percentRight: answered > 0 ? Math.round((correct / answered) * 100) : null,
  };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The line under the chart: "12 answers · 5 of 7 days · 83% right". */
export function weekCaption(days: readonly StudyDay[]): string {
  const t = weekTotals(days);
  if (t.answered === 0) return `No answers in the last ${days.length} days`;
  return `${plural(t.answered, "answer")} · ${t.activeDays} of ${days.length} days · ${t.percentRight}% right`;
}

/** One day, as shown when a bar is tapped or hovered: "Tue · 12 answered · 10 right". */
export function dayCaption(d: DayActivity): string {
  const name = weekdayName(d.day);
  return d.answered === 0
    ? `${name} · nothing answered`
    : `${name} · ${d.answered} answered · ${d.correct} right`;
}

/** The whole week in one sentence, for the chart's `aria-label`. */
export function weekAriaLabel(days: readonly DayActivity[], hasHistory: boolean): string {
  const t = weekTotals(days);
  if (!hasHistory) return `Quiz activity, last ${days.length} days: no answers yet.`;
  const head =
    t.answered === 0
      ? `Quiz activity, last ${days.length} days: no answers this week.`
      : `Quiz activity, last ${days.length} days: ${plural(t.answered, "answer")}, ${t.percentRight}% right, on ${t.activeDays} of ${days.length} days.`;
  const each = days
    .map((d) =>
      d.answered === 0
        ? `${weekdayName(d.day, true)}: none.`
        : `${weekdayName(d.day, true)}: ${d.answered} answered, ${d.correct} right.`,
    )
    .join(" ");
  return `${head} ${each}`;
}
