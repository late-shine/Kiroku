/**
 * Phase 9b — manual cloud sync: the pure part. No React, no localStorage, no Firebase, no DOM, so every rule
 * here can be checked from a plain script (handoffs/phase-9b-sync-check.ts).
 *
 * WHAT SYNCS: the lessons, and the learning progress inside `UserProgressState` (completed days, starred ids,
 * weak ids, the per-word review records, the two quiz counters). WHAT DOES NOT: the Gemini key, music, voice,
 * tips, the temporary quiz state, and the three screen preferences (`backgroundIndex`, `bgZoomSpeed`,
 * `showFurigana`; small prefs are Phase 9c). `currentDay` and `lastQuizScore` are not synced either: nothing in
 * the app reads or writes them any more.
 *
 * WHAT THE CLOUD HOLDS (Realtime Database, everything under `users/<uid>/`; the layout is in PLAN.md, Phase 9):
 *   lessons/d13            one STRING per day: the lesson JSON. A string, not a nested object, because the
 *                          database turns arrays into objects and silently drops empty arrays, so a lesson with
 *                          `kunyomi: []` would come back broken. A string round-trips byte for byte.
 *   progress/completedDays { d1: true, d2: true }      (maps, never arrays: arrays and empty nodes don't survive)
 *   progress/masteredVocabIds, weakVocabIds  { "d14-3": true }
 *   progress/totalQuizzesTaken, totalCorrectAnswers  numbers
 *   memory/<vocabId>       one record per word: japanese, box, due, right, wrong, lastAnswered
 *   meta                   { schema: 1, updatedAt }
 * An empty account reads back as `null`; a missing node always means "empty", never "deleted".
 *
 * The id/size limits below are mirrored by the `.validate` rules in firebase/database.rules.json. If a limit
 * changes here, change the rules too (the check script evaluates the real rules file against real trees).
 */
import { restoredLessonSchema } from "@/lib/backup";
import { parseStoredMemory, type VocabMemory } from "@/lib/word-memory";
import type { DayLesson, UserProgressState, WordMemory } from "@/types/japanese";

export const SYNC_SCHEMA = 1;

/** Keys the rules accept: `d13` for a day, `d13-4` for a word. */
export const DAY_KEY_RE = /^d[0-9]{1,5}$/;
export const WORD_ID_RE = /^d[0-9]{1,5}-[0-9]{1,5}$/;
/** The rules cap a record's word text; a longer one is simply not synced. */
export const MAX_WORD_TEXT = 300;

export interface SyncProgress {
  completedDays: number[];
  masteredVocabIds: string[];
  weakVocabIds: string[];
  vocabMemory: VocabMemory;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
}

/** Everything that syncs, in the shape the app already uses (arrays and a record, not the cloud's maps). */
export interface SyncSnapshot {
  lessons: DayLesson[];
  progress: SyncProgress;
}

export type SyncMode = "merge" | "use-cloud" | "use-device";

const byNumber = (a: number, b: number) => a - b;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// ---------------------------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------------------------

export function snapshotOf(
  lessons: readonly DayLesson[],
  progress: UserProgressState,
): SyncSnapshot {
  return {
    lessons: [...lessons].sort((a, b) => a.dayNumber - b.dayNumber),
    progress: {
      completedDays: [...progress.completedDays],
      masteredVocabIds: [...progress.masteredVocabIds],
      weakVocabIds: [...progress.weakVocabIds],
      vocabMemory: { ...progress.vocabMemory },
      totalQuizzesTaken: progress.totalQuizzesTaken,
      totalCorrectAnswers: progress.totalCorrectAnswers,
    },
  };
}

/** True when there is nothing worth syncing at all (a fresh or fully reset device, or an empty account). */
export function isEmptySnapshot(s: SyncSnapshot): boolean {
  const p = s.progress;
  return (
    s.lessons.length === 0 &&
    p.completedDays.length === 0 &&
    p.masteredVocabIds.length === 0 &&
    p.weakVocabIds.length === 0 &&
    Object.keys(p.vocabMemory).length === 0 &&
    p.totalQuizzesTaken === 0 &&
    p.totalCorrectAnswers === 0
  );
}

/** What the sync dialog shows next to "This device" / "Your account". */
export function describeSnapshot(s: SyncSnapshot): { days: number; reviewWords: number } {
  return { days: s.lessons.length, reviewWords: Object.keys(s.progress.vocabMemory).length };
}

/**
 * Puts a snapshot into the app's progress, keeping the fields that stay on this device
 * (screen preferences, `currentDay`, `lastQuizScore`). Returns a new object.
 */
export function applyProgress(s: SyncSnapshot, current: UserProgressState): UserProgressState {
  return {
    ...current,
    completedDays: [...s.progress.completedDays],
    masteredVocabIds: [...s.progress.masteredVocabIds],
    weakVocabIds: [...s.progress.weakVocabIds],
    vocabMemory: { ...s.progress.vocabMemory },
    totalQuizzesTaken: s.progress.totalQuizzesTaken,
    totalCorrectAnswers: s.progress.totalCorrectAnswers,
  };
}

// ---------------------------------------------------------------------------------------------
// Comparing
// ---------------------------------------------------------------------------------------------

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item !== undefined) out[key] = sortKeys(item);
    }
    return out;
  }
  return value;
}

const canonical = (value: unknown): string => JSON.stringify(sortKeys(value));

/**
 * A lesson in the form the cloud gives back: run through the same shape check as a restored backup (which
 * drops unknown fields and fills `completed`). Comparing normalised lessons stops an old lesson with a stray
 * field from looking "different" on every sync. A lesson that fails the check is compared as it is.
 */
function normalizeLesson(lesson: DayLesson): DayLesson {
  const result = restoredLessonSchema.safeParse(lesson);
  return result.success ? ({ completed: false, ...result.data } as DayLesson) : lesson;
}

const sameLesson = (a: DayLesson, b: DayLesson) =>
  canonical(normalizeLesson(a)) === canonical(normalizeLesson(b));

function canonicalSnapshot(s: SyncSnapshot): string {
  return canonical({
    lessons: s.lessons.map(normalizeLesson).sort((a, b) => a.dayNumber - b.dayNumber),
    completedDays: [...s.progress.completedDays].sort(byNumber),
    mastered: [...s.progress.masteredVocabIds].sort(),
    weak: [...s.progress.weakVocabIds].sort(),
    memory: s.progress.vocabMemory,
    quizzes: s.progress.totalQuizzesTaken,
    correct: s.progress.totalCorrectAnswers,
  });
}

/** Same lessons and same progress (order and unknown fields ignored). Used to skip pointless writes. */
export const snapshotsEqual = (a: SyncSnapshot, b: SyncSnapshot): boolean =>
  canonicalSnapshot(a) === canonicalSnapshot(b);

// ---------------------------------------------------------------------------------------------
// Cloud encoding
// ---------------------------------------------------------------------------------------------

export type CloudTree = Record<string, unknown>;

const flags = (keys: readonly (string | number)[]): Record<string, true> => {
  const out: Record<string, true> = {};
  for (const key of keys) out[String(key)] = true;
  return out;
};

/**
 * The tree written to `users/<uid>`. Empty groups are left out (the database would drop them anyway) and
 * nothing in it is `undefined` (the SDK throws on that). Ids and records the rules would refuse are left out
 * here instead, because one refused value rejects the WHOLE write.
 */
export function encodeSnapshot(s: SyncSnapshot, now: Date = new Date()): CloudTree {
  const lessons: Record<string, string> = {};
  for (const lesson of s.lessons) {
    const key = `d${lesson.dayNumber}`;
    if (DAY_KEY_RE.test(key)) lessons[key] = JSON.stringify(lesson);
  }
  const p = s.progress;
  const completed = p.completedDays.filter((d) => DAY_KEY_RE.test(`d${d}`)).map((d) => `d${d}`);
  const progress: Record<string, unknown> = {
    totalQuizzesTaken: p.totalQuizzesTaken,
    totalCorrectAnswers: p.totalCorrectAnswers,
  };
  if (completed.length > 0) progress["completedDays"] = flags(completed);
  const mastered = p.masteredVocabIds.filter((id) => WORD_ID_RE.test(id));
  if (mastered.length > 0) progress["masteredVocabIds"] = flags(mastered);
  const weak = p.weakVocabIds.filter((id) => WORD_ID_RE.test(id));
  if (weak.length > 0) progress["weakVocabIds"] = flags(weak);

  const memory: Record<string, WordMemory> = {};
  for (const [id, rec] of Object.entries(p.vocabMemory)) {
    if (WORD_ID_RE.test(id) && rec.japanese.length <= MAX_WORD_TEXT) memory[id] = { ...rec };
  }

  const tree: CloudTree = { progress, meta: { schema: SYNC_SCHEMA, updatedAt: now.toISOString() } };
  if (Object.keys(lessons).length > 0) tree["lessons"] = lessons;
  if (Object.keys(memory).length > 0) tree["memory"] = memory;
  return tree;
}

export type DecodeResult = { ok: true; snapshot: SyncSnapshot } | { ok: false; message: string };

const nonNegativeInt = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

function keysWithTrue(node: unknown, accept: (key: string) => boolean): string[] {
  if (!isRecord(node)) return [];
  return Object.entries(node)
    .filter(([key, value]) => value === true && accept(key))
    .map(([key]) => key);
}

/**
 * Reads whatever `users/<uid>` held. `null` / missing nodes mean "empty". It fails closed: if the account holds
 * a day it can't read, or data from a newer Kiroku, it refuses the whole thing rather than let a later write
 * replace data it didn't understand.
 */
export function decodeCloud(raw: unknown): DecodeResult {
  const empty: SyncSnapshot = {
    lessons: [],
    progress: {
      completedDays: [],
      masteredVocabIds: [],
      weakVocabIds: [],
      vocabMemory: {},
      totalQuizzesTaken: 0,
      totalCorrectAnswers: 0,
    },
  };
  if (raw === null || raw === undefined) return { ok: true, snapshot: empty };
  if (!isRecord(raw)) {
    return {
      ok: false,
      message:
        "The data in your account isn't in a shape Kiroku understands, so nothing was changed.",
    };
  }

  const meta = raw["meta"];
  if (isRecord(meta) && typeof meta["schema"] === "number" && meta["schema"] > SYNC_SCHEMA) {
    return {
      ok: false,
      message:
        "Your account holds data saved by a newer Kiroku. Update Kiroku (reload the page) and try again.",
    };
  }

  const lessons: DayLesson[] = [];
  let unreadable = 0;
  const rawLessons = raw["lessons"];
  if (isRecord(rawLessons)) {
    for (const [key, value] of Object.entries(rawLessons)) {
      let lesson: DayLesson | null = null;
      if (DAY_KEY_RE.test(key) && typeof value === "string") {
        try {
          const result = restoredLessonSchema.safeParse(JSON.parse(value));
          if (result.success && `d${result.data.dayNumber}` === key) {
            lesson = { completed: false, ...result.data } as DayLesson;
          }
        } catch {
          /* not JSON: counted as unreadable below */
        }
      }
      if (lesson) lessons.push(lesson);
      else unreadable++;
    }
  }
  if (unreadable > 0) {
    return {
      ok: false,
      message: `${unreadable} ${unreadable === 1 ? "day" : "days"} in your account couldn't be read, so Kiroku left everything as it is. "Delete my cloud data" clears the account copy if you want to start it again.`,
    };
  }
  lessons.sort((a, b) => a.dayNumber - b.dayNumber);

  const rawProgress = isRecord(raw["progress"]) ? raw["progress"] : {};
  const completedDays = keysWithTrue(rawProgress["completedDays"], (k) => DAY_KEY_RE.test(k))
    .map((k) => Number(k.slice(1)))
    .sort(byNumber);
  return {
    ok: true,
    snapshot: {
      lessons,
      progress: {
        completedDays,
        masteredVocabIds: keysWithTrue(rawProgress["masteredVocabIds"], (k) =>
          WORD_ID_RE.test(k),
        ).sort(),
        weakVocabIds: keysWithTrue(rawProgress["weakVocabIds"], (k) => WORD_ID_RE.test(k)).sort(),
        vocabMemory: parseStoredMemory(raw["memory"]),
        totalQuizzesTaken: nonNegativeInt(rawProgress["totalQuizzesTaken"]),
        totalCorrectAnswers: nonNegativeInt(rawProgress["totalCorrectAnswers"]),
      },
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Merging
// ---------------------------------------------------------------------------------------------

/**
 * Which of two records for the same word survives (PLAN.md, Phase 9: "newest `lastAnswered` wins"), with two
 * refinements that only ever protect progress:
 *  1. a record written for a different word under the same id (the lesson was re-issued) loses to one that matches
 *     the word the merged lesson actually has;
 *  2. a record that was never answered (right + wrong = 0, only "added to review") loses to one that was, however
 *     new it is, because "Add to review" must not erase another device's answers.
 * A real tie goes to this device.
 */
function pickRecord(
  device: WordMemory,
  cloud: WordMemory,
  lessonWord: string | undefined,
): "device" | "cloud" {
  if (lessonWord !== undefined) {
    const deviceFits = device.japanese === lessonWord;
    const cloudFits = cloud.japanese === lessonWord;
    if (deviceFits !== cloudFits) return deviceFits ? "device" : "cloud";
  }
  const deviceAnswered = device.right + device.wrong > 0;
  const cloudAnswered = cloud.right + cloud.wrong > 0;
  if (deviceAnswered !== cloudAnswered) return deviceAnswered ? "device" : "cloud";
  return Date.parse(cloud.lastAnswered) > Date.parse(device.lastAnswered) ? "cloud" : "device";
}

export interface SyncSummary {
  /** Days the result has that this device didn't. */
  daysFromCloud: number;
  /** Days the result has that the account didn't. */
  daysToCloud: number;
  /** Days on both sides with different content (Merge keeps this device's version). */
  conflictDays: number[];
  /** Days this device loses (Use my account's data). */
  removedFromDevice: number;
  /** Days the account loses (Use this device's data). */
  removedFromCloud: number;
}

/**
 * Merge (PLAN.md, Phase 9 rule 1): union of days, and a day on both sides with different content keeps THIS
 * DEVICE's version (lessons have no timestamps); word records merge per word (see `pickRecord`); the two
 * counters take the larger value; completed days and starred ids are the union; a weak id follows whichever side
 * won that word's record (so a right answer that cleared it isn't undone), or the union when only one side has
 * the record. Pure: neither input is changed.
 */
export function mergeSnapshots(device: SyncSnapshot, cloud: SyncSnapshot): SyncSnapshot {
  const lessonByDay = new Map<number, DayLesson>();
  for (const lesson of cloud.lessons) lessonByDay.set(lesson.dayNumber, lesson);
  for (const lesson of device.lessons) lessonByDay.set(lesson.dayNumber, lesson); // this device wins
  const lessons = [...lessonByDay.values()].sort((a, b) => a.dayNumber - b.dayNumber);

  const wordText = new Map<string, string>();
  for (const lesson of lessons) for (const w of lesson.vocab) wordText.set(w.id, w.japanese);

  const d = device.progress;
  const c = cloud.progress;
  const vocabMemory: VocabMemory = {};
  const winner = new Map<string, "device" | "cloud">();
  for (const id of new Set([...Object.keys(c.vocabMemory), ...Object.keys(d.vocabMemory)])) {
    const dr = d.vocabMemory[id];
    const cr = c.vocabMemory[id];
    if (dr && cr) {
      const pick = pickRecord(dr, cr, wordText.get(id));
      winner.set(id, pick);
      vocabMemory[id] = { ...(pick === "device" ? dr : cr) };
    } else if (dr) vocabMemory[id] = { ...dr };
    else if (cr) vocabMemory[id] = { ...cr };
  }

  const deviceWeak = new Set(d.weakVocabIds);
  const cloudWeak = new Set(c.weakVocabIds);
  const weakVocabIds = [...new Set([...d.weakVocabIds, ...c.weakVocabIds])].filter((id) => {
    const won = winner.get(id);
    if (won === "device") return deviceWeak.has(id);
    if (won === "cloud") return cloudWeak.has(id);
    return true;
  });

  return {
    lessons,
    progress: {
      completedDays: [...new Set([...d.completedDays, ...c.completedDays])].sort(byNumber),
      masteredVocabIds: [...new Set([...d.masteredVocabIds, ...c.masteredVocabIds])].sort(),
      weakVocabIds: weakVocabIds.sort(),
      vocabMemory,
      totalQuizzesTaken: Math.max(d.totalQuizzesTaken, c.totalQuizzesTaken),
      totalCorrectAnswers: Math.max(d.totalCorrectAnswers, c.totalCorrectAnswers),
    },
  };
}

export type SyncPlan =
  | {
      ok: true;
      mode: SyncMode;
      /** What both sides should hold afterwards. */
      result: SyncSnapshot;
      writeCloud: boolean;
      replaceDevice: boolean;
      summary: SyncSummary;
    }
  | { ok: false; message: string };

/**
 * Decides what a sync does, without doing it. The one hard rule (PLAN.md, Phase 9 rule 2): EMPTINESS IS NEVER A
 * DELETION. "Use this device's data" with no lessons on this device while the account has some is refused, and
 * Merge with an empty device simply hands the account's data to the device.
 */
export function planSync(mode: SyncMode, device: SyncSnapshot, cloud: SyncSnapshot): SyncPlan {
  let result: SyncSnapshot;
  if (mode === "merge") {
    result = mergeSnapshots(device, cloud);
  } else if (mode === "use-cloud") {
    if (isEmptySnapshot(cloud)) {
      return {
        ok: false,
        message: "Your account has no data yet, so there is nothing to bring to this device.",
      };
    }
    result = cloud;
  } else {
    if (device.lessons.length === 0 && !isEmptySnapshot(cloud)) {
      return {
        ok: false,
        message:
          "This device has no lessons, and replacing your account with it would erase the account's copy. Nothing was changed. Use Sync now to bring your account's data here, or \"Delete my cloud data\" if erasing it is what you want.",
      };
    }
    result = device;
  }

  const deviceDays = new Map(device.lessons.map((l) => [l.dayNumber, l] as const));
  const cloudDays = new Map(cloud.lessons.map((l) => [l.dayNumber, l] as const));
  const resultDays = new Set(result.lessons.map((l) => l.dayNumber));
  const conflictDays: number[] = [];
  if (mode === "merge") {
    for (const [day, lesson] of deviceDays) {
      const other = cloudDays.get(day);
      if (other && !sameLesson(lesson, other)) conflictDays.push(day);
    }
  }
  conflictDays.sort(byNumber);

  return {
    ok: true,
    mode,
    result,
    writeCloud: !snapshotsEqual(result, cloud),
    replaceDevice: !snapshotsEqual(result, device),
    summary: {
      daysFromCloud: [...resultDays].filter((day) => !deviceDays.has(day)).length,
      daysToCloud: [...resultDays].filter((day) => !cloudDays.has(day)).length,
      conflictDays,
      removedFromDevice: [...deviceDays.keys()].filter((day) => !resultDays.has(day)).length,
      removedFromCloud: [...cloudDays.keys()].filter((day) => !resultDays.has(day)).length,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Wording helpers (pure, so they are checked too)
// ---------------------------------------------------------------------------------------------

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One sentence for the Account panel after a sync. */
export function describeSyncResult(plan: Extract<SyncPlan, { ok: true }>): string {
  const { summary: s, mode } = plan;
  if (!plan.writeCloud && !plan.replaceDevice) return "Already in sync. Nothing needed to change.";
  const parts: string[] = [];
  if (mode === "use-cloud") {
    parts.push(
      `This device now matches your account (${plural(plan.result.lessons.length, "day")}).`,
    );
  } else if (mode === "use-device") {
    parts.push(
      `Your account now matches this device (${plural(plan.result.lessons.length, "day")}).`,
    );
  } else {
    if (s.daysFromCloud > 0)
      parts.push(`Added ${plural(s.daysFromCloud, "day")} from your account.`);
    if (s.daysToCloud > 0) parts.push(`Uploaded ${plural(s.daysToCloud, "day")}.`);
    if (parts.length === 0) parts.push("Progress merged.");
    if (s.conflictDays.length > 0) {
      parts.push(
        `${plural(s.conflictDays.length, "day")} differed (${s.conflictDays.map((d) => `Day ${d}`).join(", ")}); this device's version was kept.`,
      );
    }
  }
  return `Synced. ${parts.join(" ")}`;
}

/** "just now", "5 min ago", "3 h ago", or the date. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const minutes = Math.floor((now.getTime() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(then).toLocaleDateString();
}
