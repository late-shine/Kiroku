// Device-only preferences for calm daily review pacing: daily review goal, due-order focus,
// and how many due words have already been reviewed today. Never synced or backed up.
import { STORAGE_KEYS } from "@/lib/storage";
import { isValidDay } from "@/lib/word-memory";

export type DailyGoal = 10 | 20 | 30 | "all";
export const DAILY_GOALS: readonly { id: DailyGoal; label: string }[] = [
  { id: 10, label: "10" },
  { id: 20, label: "20" },
  { id: 30, label: "30" },
  { id: "all", label: "All" },
];
export const DEFAULT_CAPPED_DAILY_GOAL = 20;
export const DEFAULT_DAILY_GOAL: DailyGoal = DEFAULT_CAPPED_DAILY_GOAL;

export type DueFocus = "balanced" | "fresh" | "oldest";
export const DUE_FOCUSES: readonly { id: DueFocus; label: string }[] = [
  { id: "balanced", label: "Balanced" },
  { id: "fresh", label: "Fresh first" },
  { id: "oldest", label: "Oldest first" },
];
export const DEFAULT_DUE_FOCUS: DueFocus = "balanced";

export interface QuizPrefs {
  dailyGoal: DailyGoal;
  dueFocus: DueFocus;
  doneDay: string;
  doneCount: number;
  bonusGoal: number;
}

export const DEFAULT_QUIZ_PREFS: QuizPrefs = {
  dailyGoal: DEFAULT_DAILY_GOAL,
  dueFocus: DEFAULT_DUE_FOCUS,
  doneDay: "",
  doneCount: 0,
  bonusGoal: 0,
};

export const QUIZ_PREFS_EVENT = "kiroku:quiz-prefs";

function isDailyGoal(value: unknown): value is DailyGoal {
  return value === 10 || value === 20 || value === 30 || value === "all";
}

function isDueFocus(value: unknown): value is DueFocus {
  return value === "balanced" || value === "fresh" || value === "oldest";
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

export function parseQuizPrefs(raw: unknown): QuizPrefs {
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return DEFAULT_QUIZ_PREFS;
    }
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_QUIZ_PREFS;
  }
  const rec = parsed as Record<string, unknown>;
  const doneDay =
    typeof rec["doneDay"] === "string" && isValidDay(rec["doneDay"]) ? rec["doneDay"] : "";
  return {
    dailyGoal: isDailyGoal(rec["dailyGoal"]) ? rec["dailyGoal"] : DEFAULT_DAILY_GOAL,
    dueFocus: isDueFocus(rec["dueFocus"]) ? rec["dueFocus"] : DEFAULT_DUE_FOCUS,
    doneDay,
    doneCount: doneDay ? nonNegativeInt(rec["doneCount"]) : 0,
    bonusGoal: doneDay ? nonNegativeInt(rec["bonusGoal"]) : 0,
  };
}

export function loadQuizPrefs(): QuizPrefs {
  if (typeof window === "undefined") return DEFAULT_QUIZ_PREFS;
  try {
    return parseQuizPrefs(localStorage.getItem(STORAGE_KEYS.quizPrefs));
  } catch {
    return DEFAULT_QUIZ_PREFS;
  }
}

export function saveQuizPrefs(prefs: QuizPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.quizPrefs, JSON.stringify(prefs));
  } catch {
    /* storage blocked or full */
  }
  window.dispatchEvent(new Event(QUIZ_PREFS_EVENT));
}

export function resetQuizPrefs(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.quizPrefs);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(QUIZ_PREFS_EVENT));
}

export function subscribeQuizPrefs(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEYS.quizPrefs) onChange();
  };
  window.addEventListener(QUIZ_PREFS_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(QUIZ_PREFS_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** How many due words were reviewed today. Resets automatically when `today` changes. */
export function dailyDueDone(prefs: QuizPrefs, today: string): number {
  return prefs.doneDay === today ? prefs.doneCount : 0;
}

/** Target count for today (dailyGoal + any extra rounds requested today), or null when `dailyGoal` is "all". */
export function dailyDueTarget(prefs: QuizPrefs, today: string): number | null {
  if (prefs.dailyGoal === "all") return null;
  const bonus = prefs.doneDay === today ? prefs.bonusGoal : 0;
  return prefs.dailyGoal + bonus;
}

/**
 * How many due words remain in today's calm goal. Never exceeds `dueNow` and never shows a huge wall
 * when `dailyGoal` is capped (e.g. 20). When `dailyGoal` is "all", returns `dueNow`.
 */
export function dailyDueRemaining(dueNow: number, prefs: QuizPrefs, today: string): number {
  const cleanDue = Math.max(0, dueNow);
  const target = dailyDueTarget(prefs, today);
  if (target === null) return cleanDue;
  const done = dailyDueDone(prefs, today);
  return Math.min(cleanDue, Math.max(0, target - done));
}

/** True when the user has a capped daily goal, still has due words in backlog, and finished today's target. */
export function isDailyGoalComplete(dueNow: number, prefs: QuizPrefs, today: string): boolean {
  const target = dailyDueTarget(prefs, today);
  if (target === null) return false;
  return dueNow > 0 && dailyDueDone(prefs, today) >= target;
}

/** Caps a Due round's length to today's remaining goal when dailyGoal is capped. */
export function effectiveDueRoundLength(
  roundLength: 10 | 20 | "all",
  dueRemaining: number,
  goalCapped: boolean,
): number | "all" {
  if (!goalCapped) return roundLength;
  if (dueRemaining <= 0) return 0;
  if (roundLength === "all") return dueRemaining;
  return Math.min(roundLength, dueRemaining);
}

export const BACKLOG_SPREAD_THRESHOLD = 40;

/** How many words to keep due today when spreading an overdue backlog. */
export function backlogKeepCount(
  dueNow: number,
  dueRemaining: number,
  goalCapped: boolean,
): number {
  if (goalCapped) return Math.min(dueNow, Math.max(0, dueRemaining));
  return Math.min(dueNow, DEFAULT_CAPPED_DAILY_GOAL);
}

/** Increments today's due-review counter by `count` (no-op for count <= 0). */
export function recordDueAnswered(prefs: QuizPrefs, today: string, count = 1): QuizPrefs {
  if (count <= 0) return prefs;
  const sameDay = prefs.doneDay === today;
  return {
    ...prefs,
    doneDay: today,
    doneCount: (sameDay ? prefs.doneCount : 0) + count,
    bonusGoal: sameDay ? prefs.bonusGoal : 0,
  };
}

/** Adds `extra` more reviews to today's target ("Review 10 more"). */
export function grantBonusReview(prefs: QuizPrefs, today: string, extra = 10): QuizPrefs {
  if (extra <= 0 || prefs.dailyGoal === "all") return prefs;
  const sameDay = prefs.doneDay === today;
  const done = sameDay ? prefs.doneCount : 0;
  const currentTarget = prefs.dailyGoal + (sameDay ? prefs.bonusGoal : 0);
  // If done already exceeds currentTarget, align bonus so the user gets `extra` new questions from now.
  const nextTarget = Math.max(currentTarget, done) + extra;
  return {
    ...prefs,
    doneDay: today,
    doneCount: done,
    bonusGoal: Math.max(0, nextTarget - prefs.dailyGoal),
  };
}
