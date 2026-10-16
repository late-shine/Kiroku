// Day numbers are stable ids (sync keys, deletion tombstones, vocab ids like d14-3).
// They are not positions. After a middle day is deleted the list has a gap, and
// navigation has to walk the days that still exist — never day ± 1, and never
// the first lesson standing in for a number that is gone.

/** Ascending copy. Does not drop duplicates; lessons are not supposed to share a day. */
export function sortedDayNumbers(days: readonly number[]): number[] {
  return [...days].sort((a, b) => a - b);
}

/** 1-based place of `day` in the sorted remaining list, or null if that day is gone. */
export function lessonPosition(days: readonly number[], day: number): number | null {
  const index = sortedDayNumbers(days).indexOf(day);
  return index < 0 ? null : index + 1;
}

/**
 * The neighbouring existing day. Null at either end, and null when `day` itself
 * is not in the list (a missing day is not a place you can step from).
 */
export function stepDay(days: readonly number[], day: number, delta: -1 | 1): number | null {
  const sorted = sortedDayNumbers(days);
  const index = sorted.indexOf(day);
  if (index < 0) return null;
  const next = sorted[index + delta];
  return next === undefined ? null : next;
}

/**
 * A day that exists. The same number when it is still in the list; otherwise the
 * next higher existing day, then the closest lower one. Null when nothing remains.
 * This is deliberately not "fall back to the first lesson": a hole at 14 must not
 * show Day 1's content.
 */
export function resolveDay(days: readonly number[], day: number): number | null {
  const sorted = sortedDayNumbers(days);
  if (sorted.length === 0) return null;
  if (sorted.includes(day)) return day;
  const higher = sorted.find((n) => n > day);
  if (higher !== undefined) return higher;
  return sorted[sorted.length - 1] ?? null;
}

/**
 * Which day to show after deleting `deleted`. If the day on screen survived, it
 * stays. If it was removed, the rule in `resolveDay` picks the next survivor.
 */
export function dayAfterDelete(
  days: readonly number[],
  current: number,
  deleted: readonly number[],
): number | null {
  const gone = new Set(deleted);
  return resolveDay(
    days.filter((n) => !gone.has(n)),
    current,
  );
}

/** Day id, then where that day sits. e.g. "Day 15 · lesson 14 of 17". */
export function dayPositionLabel(day: number, position: number, total: number): string {
  return `Day ${day} · lesson ${position} of ${total}`;
}

const DELETE_ONE_BODY =
  "This removes the lesson and its review records. Those words will not come back unless you import the day again and study them once more. Quiz totals and the study log stay.";
const DELETE_MANY_BODY =
  "This removes these lessons and their review records. Those words will not come back unless you import the days again and study them once more. Quiz totals and the study log stay.";

/** Copy for the curriculum delete dialog. Review rows for those days are discarded on purpose. */
export function deleteDaysConfirm(dayNumbers: readonly number[]): { title: string; body: string } {
  const only = dayNumbers.length === 1 ? dayNumbers[0] : undefined;
  if (only !== undefined) {
    return { title: `Delete Day ${only}?`, body: DELETE_ONE_BODY };
  }
  return { title: `Delete ${dayNumbers.length} days?`, body: DELETE_MANY_BODY };
}
