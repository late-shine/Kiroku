// Lesson Studio safety (follow-up to Phase 19a). Pure: no React, no storage, no window.
//
// Day numbers are stable ids, and vocab ids are position based (`d14-3`). Two things follow:
//  1. The Studio may target a day that was deleted (a "missing" day) so an old backup or a hand-made lesson can
//     restore that number. The prompt can only describe lessons that still exist, so the Studio says so.
//  2. Replacing an existing day must not leave the old day's review, mastery or completion state behind, or
//     it would attach to different words at the same ids.
import { pruneMemory } from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export type StudioDayKind = "foundation" | "new" | "existing" | "missing";

/**
 * What the Studio's target day is. "missing" wins over everything: the day is not a lesson, but it is at or
 * below the highest day that is (a hole). Otherwise Day 1 is the foundation lesson, a day past the end is new,
 * and any other day that is in the list is an existing lesson.
 */
export function studioDayKind(days: readonly number[], day: number): StudioDayKind {
  const exists = days.includes(day);
  const highest = Math.max(0, ...days);
  if (!exists && day >= 1 && day <= highest) return "missing";
  if (day === 1) return "foundation";
  return exists ? "existing" : "new";
}

export const missingDayWarning = (day: number): string =>
  day === 1
    ? "Day 1 is missing. You can rebuild it, but the original lesson cannot be recovered unless you restore a backup."
    : `Day ${day} is missing. You can rebuild it, but the original lesson cannot be recovered unless you restore a backup. The prompt only includes lessons that still exist.`;

const HINTS: Record<StudioDayKind, string> = {
  foundation: "Foundations lesson — no assumed knowledge",
  new: "New lesson",
  existing: "Existing lesson — rebuilding its prompt",
  missing: "Missing day — rebuilding from the lessons that remain",
};

/** The short hint beside the day stepper, and (for a hole only) the longer warning under it. */
export function studioDayNotice(
  days: readonly number[],
  day: number,
): { kind: StudioDayKind; hint: string; warning: string | null } {
  const kind = studioDayKind(days, day);
  if (kind !== "missing") return { kind, hint: HINTS[kind], warning: null };
  return {
    kind,
    // Day 1 has no earlier lessons to build from, so it keeps the foundation wording even when it is missing.
    hint: day === 1 ? "Missing day — Foundations lesson, no assumed knowledge" : HINTS.missing,
    warning: missingDayWarning(day),
  };
}

// ---- importing ------------------------------------------------------------------------------------

/** True when importing a lesson with this day number would replace a lesson that exists now. */
export const isReplacement = (lessons: readonly DayLesson[], dayNumber: number): boolean =>
  lessons.some((l) => l.dayNumber === dayNumber);

export const replaceConfirmMessage = (dayNumber: number): string =>
  `Day ${dayNumber} already exists. Replacing it also clears that day's review and mastery records and marks the day as not done, so you can study it again. Quiz totals and the study log stay. Replace it?`;

/**
 * The confirmation gate. A day that is not a lesson (new, or a missing day) needs no existing lesson and no
 * question: `ask` is not called. Replacing a real lesson asks once; a "no" means nothing may change.
 */
export function mayImport(
  lessons: readonly DayLesson[],
  dayNumber: number,
  ask: (message: string) => boolean,
): boolean {
  if (!isReplacement(lessons, dayNumber)) return true;
  return ask(replaceConfirmMessage(dayNumber));
}

/** The lessons with `lesson` in place of any lesson that has the same day number, sorted by day. */
export function upsertLesson(lessons: readonly DayLesson[], lesson: DayLesson): DayLesson[] {
  return [...lessons.filter((l) => l.dayNumber !== lesson.dayNumber), lesson].sort(
    (a, b) => a.dayNumber - b.dayNumber,
  );
}

/**
 * Progress after a lesson for `day` is replaced: that day's `d{day}-*` word records, starred ids and weak ids
 * are dropped, and the day is no longer marked done (its content changed). Everything else is kept as it was:
 * other days, `totalQuizzesTaken`, `totalCorrectAnswers`, `studyLog` and the rest. The input is not changed.
 */
export function clearDayWordState(progress: UserProgressState, day: number): UserProgressState {
  const prefix = `d${day}-`; // the hyphen keeps d1- from matching d14-
  const keep = (id: string) => !id.startsWith(prefix);
  return {
    ...progress,
    completedDays: progress.completedDays.filter((d) => d !== day),
    masteredVocabIds: progress.masteredVocabIds.filter(keep),
    weakVocabIds: progress.weakVocabIds.filter(keep),
    vocabMemory: pruneMemory(progress.vocabMemory, keep),
  };
}
