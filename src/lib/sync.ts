/**
 * Phases 9b + 9c — cloud sync: the pure part. No React, no localStorage, no Firebase, no DOM, so every rule here
 * can be checked from a plain script (handoffs/phase-9b-sync-check.ts and phase-9c-sync-check.ts).
 *
 * WHAT SYNCS: the lessons; the learning progress inside `UserProgressState` (completed days, starred ids, weak ids,
 * the per-word review records, the two quiz counters); and, since 9c, a few small preferences (`prefs`: background,
 * zoom speed, furigana, dismissed tip ids) and the record of which days were deleted (`deleted`, "tombstones").
 * WHAT DOES NOT: the Gemini key, music, the voice choice (a voice that exists on one device usually doesn't exist on
 * another: see src/lib/voice.ts), the temporary quiz state. `currentDay` and `lastQuizScore` are not synced either:
 * nothing in the app reads or writes them any more.
 *
 * WHAT THE CLOUD HOLDS (Realtime Database, everything under `users/<uid>/`; the layout is in PLAN.md, Phase 9):
 *   lessons/d13            one STRING per day: the lesson JSON. A string, not a nested object, because the
 *                          database turns arrays into objects and silently drops empty arrays, so a lesson with
 *                          `kunyomi: []` would come back broken. A string round-trips byte for byte.
 *   progress/completedDays { d1: true, d2: true }      (maps, never arrays: arrays and empty nodes don't survive)
 *   progress/masteredVocabIds, weakVocabIds  { "d14-3": true }
 *   progress/totalQuizzesTaken, totalCorrectAnswers  numbers
 *   memory/<vocabId>       one record per word: japanese, box, due, right, wrong, lastAnswered
 *   prefs                  backgroundIndex, bgZoomSpeed, showFurigana, tips { "quiz": true }   (9c)
 *   deleted/d5             "2026-10-05T10:00:00.000Z": a day was deleted at that time (9c, see below)
 *   meta                   { schema: 1, updatedAt }
 * An empty account reads back as `null`; a missing node always means "empty", never "deleted". A deletion is only
 * ever expressed by a `deleted/dN` tombstone.
 *
 * DELETES (9c). A plain union can't tell "deleted here" from "never had it", so a deleted day would come back from
 * the account, or from another device. Two small records fix that, with no clock comparisons between devices:
 *  - this device keeps a list of days it deleted since its last good sync (`pendingDeletes`, in localStorage). The next
 *    sync removes those days from the account's copy and writes a tombstone for each;
 *  - this device also remembers which tombstones it has already seen (`seenTombstones`, key → time). A tombstone it
 *    has NOT seen, for a day it still has, means the day was deleted elsewhere: it is removed here. A tombstone it HAS
 *    seen, for a day it has again, means the person brought the day back here (a new import or a restore): the day
 *    is kept and the tombstone is cleared. A device that has never synced with this account counts every tombstone as
 *    seen, so a first sync never deletes anything from the device.
 * A restore adds, never deletes: it queues nothing, so days the backup doesn't have simply come back from the account.
 *
 * The id/size limits below are mirrored by the `.validate` rules in firebase/database.rules.json. If a limit
 * changes here, change the rules too (the check script evaluates the real rules file against real trees).
 */
import { restoredLessonSchema } from "@/lib/backup";
import { parseStoredMemory, type VocabMemory } from "@/lib/word-memory";
import type { DayLesson, UserProgressState, WordMemory } from "@/types/japanese";

export const SYNC_SCHEMA = 1;

/** Keys the rules accept: `d13` for a day, `d13-4` for a word, `quiz` for a tip. */
export const DAY_KEY_RE = /^d[0-9]{1,5}$/;
export const WORD_ID_RE = /^d[0-9]{1,5}-[0-9]{1,5}$/;
export const TIP_KEY_RE = /^[a-z0-9-]{1,40}$/;
/** The rules cap a record's word text; a longer one is simply not synced. */
export const MAX_WORD_TEXT = 300;
const MAX_TIME_TEXT = 40;
const MAX_BACKGROUND_INDEX = 100;
const ZOOM_SPEEDS = ["slow", "medium", "still"] as const;

export interface SyncProgress {
  completedDays: number[];
  masteredVocabIds: string[];
  weakVocabIds: string[];
  vocabMemory: VocabMemory;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
}

/** Small preferences (9c). Every field is optional: absent = "this side has no opinion". */
export interface SyncPrefs {
  backgroundIndex?: number;
  bgZoomSpeed?: (typeof ZOOM_SPEEDS)[number];
  showFurigana?: boolean;
  /** Dismissed first-run tip ids, sorted. */
  tips?: string[];
}

/** Everything that syncs, in the shape the app already uses (arrays and a record, not the cloud's maps). */
export interface SyncSnapshot {
  lessons: DayLesson[];
  progress: SyncProgress;
  prefs: SyncPrefs;
  /** Deleted days, `d5` → ISO time. Only the account side ever carries any; a device snapshot has none. */
  tombstones: Record<string, string>;
}

export type SyncMode = "merge" | "use-cloud" | "use-device";

const byNumber = (a: number, b: number) => a - b;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const dayOfKey = (key: string): number => Number(key.slice(1));
const dayOfWordId = (id: string): number => Number(id.slice(1, id.indexOf("-")));
const sortedUnique = (xs: readonly string[]): string[] => [...new Set(xs)].sort();

// ---------------------------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------------------------

/**
 * `tips`: this device's dismissed tip ids (pass them when you have them; leave out in tests that don't care).
 * The three screen prefs come from `progress`, where the app already keeps them.
 */
export function snapshotOf(
  lessons: readonly DayLesson[],
  progress: UserProgressState,
  tips?: readonly string[],
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
    prefs: {
      backgroundIndex: progress.backgroundIndex,
      bgZoomSpeed: progress.bgZoomSpeed,
      showFurigana: progress.showFurigana,
      ...(tips ? { tips: sortedUnique(tips) } : {}),
    },
    tombstones: {},
  };
}

/**
 * True when there is nothing worth syncing at all (a fresh or fully reset device, or an empty account). Prefs and
 * tombstones don't count: they are never a reason to offer an upload or to refuse a replace.
 */
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
 * Puts a snapshot into the app's progress. The learning fields always come from the snapshot; the three screen prefs
 * come from it too when the snapshot has them (9c), otherwise the device keeps its own. `currentDay` and
 * `lastQuizScore` always stay as they were. Returns a new object.
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
    backgroundIndex: s.prefs.backgroundIndex ?? current.backgroundIndex,
    bgZoomSpeed: s.prefs.bgZoomSpeed ?? current.bgZoomSpeed,
    showFurigana: s.prefs.showFurigana ?? current.showFurigana,
  };
}

/** Removes whole days: their lessons, completed marks and every star / weak / record id that belongs to them. */
export function stripDays(s: SyncSnapshot, days: Iterable<number>): SyncSnapshot {
  const gone = new Set(days);
  if (gone.size === 0) return s;
  const keepId = (id: string) => !gone.has(dayOfWordId(id));
  const memory: VocabMemory = {};
  for (const [id, rec] of Object.entries(s.progress.vocabMemory)) if (keepId(id)) memory[id] = rec;
  return {
    ...s,
    lessons: s.lessons.filter((l) => !gone.has(l.dayNumber)),
    progress: {
      ...s.progress,
      completedDays: s.progress.completedDays.filter((d) => !gone.has(d)),
      masteredVocabIds: s.progress.masteredVocabIds.filter(keepId),
      weakVocabIds: s.progress.weakVocabIds.filter(keepId),
      vocabMemory: memory,
    },
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
    // an empty tip list and no tip list are the same thing (the account never stores an empty node)
    prefs: {
      ...s.prefs,
      tips: s.prefs.tips && s.prefs.tips.length > 0 ? sortedUnique(s.prefs.tips) : undefined,
    },
    tombstones: s.tombstones,
  });
}

/** Same lessons, progress, prefs and tombstones (order and unknown fields ignored). Used to skip pointless writes. */
export const snapshotsEqual = (a: SyncSnapshot, b: SyncSnapshot): boolean =>
  canonicalSnapshot(a) === canonicalSnapshot(b);

/**
 * A short fingerprint of everything on this device that syncs (tombstones excluded: a device has none). Automatic
 * sync compares the current fingerprint with the one saved after the last sync to decide whether anything changed.
 */
export const deviceKey = (s: SyncSnapshot): string => canonicalSnapshot({ ...s, tombstones: {} });

// ---------------------------------------------------------------------------------------------
// Cloud encoding
// ---------------------------------------------------------------------------------------------

export type CloudTree = Record<string, unknown>;

const flags = (keys: readonly (string | number)[]): Record<string, true> => {
  const out: Record<string, true> = {};
  for (const key of keys) out[String(key)] = true;
  return out;
};

const validTime = (text: unknown): text is string =>
  typeof text === "string" && text.length <= MAX_TIME_TEXT && !Number.isNaN(Date.parse(text));

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

  const prefs: Record<string, unknown> = {};
  const pr = s.prefs;
  if (
    pr.backgroundIndex !== undefined &&
    Number.isInteger(pr.backgroundIndex) &&
    pr.backgroundIndex >= 0 &&
    pr.backgroundIndex <= MAX_BACKGROUND_INDEX
  ) {
    prefs["backgroundIndex"] = pr.backgroundIndex;
  }
  if (pr.bgZoomSpeed !== undefined && ZOOM_SPEEDS.includes(pr.bgZoomSpeed))
    prefs["bgZoomSpeed"] = pr.bgZoomSpeed;
  if (typeof pr.showFurigana === "boolean") prefs["showFurigana"] = pr.showFurigana;
  const tips = (pr.tips ?? []).filter((id) => TIP_KEY_RE.test(id));
  if (tips.length > 0) prefs["tips"] = flags(tips);

  const deleted: Record<string, string> = {};
  for (const [key, at] of Object.entries(s.tombstones)) {
    if (DAY_KEY_RE.test(key) && validTime(at)) deleted[key] = at;
  }

  const tree: CloudTree = { progress, meta: { schema: SYNC_SCHEMA, updatedAt: now.toISOString() } };
  if (Object.keys(lessons).length > 0) tree["lessons"] = lessons;
  if (Object.keys(memory).length > 0) tree["memory"] = memory;
  if (Object.keys(prefs).length > 0) tree["prefs"] = prefs;
  if (Object.keys(deleted).length > 0) tree["deleted"] = deleted;
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

function decodePrefs(node: unknown): SyncPrefs {
  if (!isRecord(node)) return {};
  const prefs: SyncPrefs = {};
  const index = node["backgroundIndex"];
  if (
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= MAX_BACKGROUND_INDEX
  ) {
    prefs.backgroundIndex = index;
  }
  const speed = node["bgZoomSpeed"];
  if (typeof speed === "string" && (ZOOM_SPEEDS as readonly string[]).includes(speed)) {
    prefs.bgZoomSpeed = speed as (typeof ZOOM_SPEEDS)[number];
  }
  if (typeof node["showFurigana"] === "boolean") prefs.showFurigana = node["showFurigana"];
  if ("tips" in node) prefs.tips = keysWithTrue(node["tips"], (k) => TIP_KEY_RE.test(k)).sort();
  return prefs;
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
    prefs: {},
    tombstones: {},
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

  const tombstones: Record<string, string> = {};
  if (isRecord(raw["deleted"])) {
    for (const [key, at] of Object.entries(raw["deleted"])) {
      if (DAY_KEY_RE.test(key) && validTime(at)) tombstones[key] = at;
    }
  }

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
      prefs: decodePrefs(raw["prefs"]),
      tombstones,
    },
  };
}

/** The `meta.updatedAt` of a raw account value (or null), used to notice another device writing in between. */
export function stampOf(raw: unknown): string | null {
  if (!isRecord(raw) || !isRecord(raw["meta"])) return null;
  const at = raw["meta"]["updatedAt"];
  return typeof at === "string" ? at : null;
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

/** One preference. `hasBase`: the device has synced before, so "changed since then" is known. */
function pickScalar<T>(
  device: T | undefined,
  cloud: T | undefined,
  base: T | undefined,
  hasBase: boolean,
) {
  if (device === undefined) return cloud;
  if (cloud === undefined) return device;
  if (!hasBase) return cloud; // first meeting: the account's setup wins
  return device !== base ? device : cloud; // changed here since the last sync → this device wins, else take the account's
}

/** Dismissed tips as a three-way set merge: a tip dismissed or un-dismissed on either side since the last sync sticks. */
function mergeTips(
  device: readonly string[] | undefined,
  cloud: readonly string[] | undefined,
  base: readonly string[] | undefined,
  hasBase: boolean,
): string[] | undefined {
  if (device === undefined) return cloud ? sortedUnique(cloud) : undefined;
  if (cloud === undefined) return sortedUnique(device);
  if (!hasBase || base === undefined) return sortedUnique([...device, ...cloud]);
  const removed = new Set([
    ...base.filter((t) => !device.includes(t)),
    ...base.filter((t) => !cloud.includes(t)),
  ]);
  const added = [
    ...device.filter((t) => !base.includes(t)),
    ...cloud.filter((t) => !base.includes(t)),
  ];
  return sortedUnique([...base.filter((t) => !removed.has(t)), ...added]);
}

/** Reads prefs this app saved itself (localStorage) back safely: unknown or odd values are dropped. */
export function sanitizePrefs(raw: unknown): SyncPrefs {
  if (!isRecord(raw)) return {};
  const out: SyncPrefs = {};
  const index = raw["backgroundIndex"];
  if (
    typeof index === "number" &&
    Number.isInteger(index) &&
    index >= 0 &&
    index <= MAX_BACKGROUND_INDEX
  ) {
    out.backgroundIndex = index;
  }
  const speed = raw["bgZoomSpeed"];
  if (typeof speed === "string" && (ZOOM_SPEEDS as readonly string[]).includes(speed)) {
    out.bgZoomSpeed = speed as (typeof ZOOM_SPEEDS)[number];
  }
  if (typeof raw["showFurigana"] === "boolean") out.showFurigana = raw["showFurigana"];
  const tips = raw["tips"];
  if (Array.isArray(tips)) {
    out.tips = sortedUnique(
      tips.filter((t): t is string => typeof t === "string" && TIP_KEY_RE.test(t)),
    );
  }
  return out;
}

/**
 * Preferences, three-way against what both sides held after the last sync (`base`; null = never synced). A value the
 * device changed since then wins, otherwise the account's; a value only one side has is taken as it is.
 */
export function mergePrefs(device: SyncPrefs, cloud: SyncPrefs, base: SyncPrefs | null): SyncPrefs {
  const hasBase = base !== null;
  const out: SyncPrefs = {};
  const index = pickScalar(
    device.backgroundIndex,
    cloud.backgroundIndex,
    base?.backgroundIndex,
    hasBase,
  );
  if (index !== undefined) out.backgroundIndex = index;
  const speed = pickScalar(device.bgZoomSpeed, cloud.bgZoomSpeed, base?.bgZoomSpeed, hasBase);
  if (speed !== undefined) out.bgZoomSpeed = speed;
  const furigana = pickScalar(device.showFurigana, cloud.showFurigana, base?.showFurigana, hasBase);
  if (furigana !== undefined) out.showFurigana = furigana;
  const tips = mergeTips(device.tips, cloud.tips, base?.tips, hasBase);
  if (tips !== undefined) out.tips = tips;
  return out;
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
  /** Days the account loses (Use this device's data, or days this device deleted). */
  removedFromCloud: number;
}

/**
 * The data part of a merge (PLAN.md, Phase 9 rule 1): union of days, and a day on both sides with different content
 * keeps THIS DEVICE's version (lessons have no timestamps); word records merge per word (see `pickRecord`); the two
 * counters take the larger value; completed days and starred ids are the union; a weak id follows whichever side won
 * that word's record (so a right answer that cleared it isn't undone), or the union when only one side has the
 * record. Prefs are merged as on a first meeting (the account's win unless only the device has one); `planSync`
 * redoes them against the saved base. Deletions are NOT handled here (see `planSync`). Pure: neither input is changed.
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
    prefs: mergePrefs(device.prefs, cloud.prefs, null),
    tombstones: { ...cloud.tombstones },
  };
}

/** What a plan needs to know about this device's history with the account (all kept in localStorage). */
export interface SyncContext {
  /** This device has synced with this account before, so a tombstone it hasn't seen is real news. */
  linked: boolean;
  /** Days deleted on this device since its last good sync. */
  pendingDeletes: readonly number[];
  /** Tombstones this device has already acted on or created: `d5` → time. */
  seenTombstones: Readonly<Record<string, string>>;
  /** What the prefs were on both sides after the last sync; null = never synced. */
  basePrefs: SyncPrefs | null;
  /** Used as the time of any tombstone this sync creates. */
  now: Date;
}

export const freshContext = (now: Date = new Date()): SyncContext => ({
  linked: false,
  pendingDeletes: [],
  seenTombstones: {},
  basePrefs: null,
  now,
});

export type SyncPlan =
  | {
      ok: true;
      mode: SyncMode;
      /** What both sides should hold afterwards (prefs and tombstones included). */
      result: SyncSnapshot;
      writeCloud: boolean;
      replaceDevice: boolean;
      summary: SyncSummary;
      /** Days taken off this device because they were deleted on another device. */
      removedDays: number[];
      /** The tombstones this device should remember as seen after a successful sync. */
      nextSeen: Record<string, string>;
      /** The prefs this device should remember as "what we both held" after a successful sync. */
      nextBasePrefs: SyncPrefs;
    }
  | { ok: false; message: string };

function planMerge(device: SyncSnapshot, cloud: SyncSnapshot, ctx: SyncContext) {
  const deviceDays = new Set(device.lessons.map((l) => l.dayNumber));
  const tombstones: Record<string, string> = { ...cloud.tombstones };
  // Days deleted here since the last sync, unless they have come back here since (then they are not deletions).
  const pending = ctx.pendingDeletes.filter((d) => !deviceDays.has(d));
  for (const day of pending) tombstones[`d${day}`] = ctx.now.toISOString();

  const removedDays: number[] = [];
  for (const [key, at] of Object.entries(cloud.tombstones)) {
    const day = dayOfKey(key);
    if (pending.includes(day) || !deviceDays.has(day)) continue;
    if (ctx.linked && ctx.seenTombstones[key] !== at)
      removedDays.push(day); // deleted elsewhere since we last looked
    else delete tombstones[key]; // this device brought the day back (or has never synced): keep it, clear the tombstone
  }
  removedDays.sort(byNumber);

  // Whatever is still tombstoned (or was just deleted here) must not survive in the account's copy either.
  const deadDays = [...pending, ...Object.keys(tombstones).map(dayOfKey)];
  const merged = mergeSnapshots(stripDays(device, removedDays), stripDays(cloud, deadDays));
  const prefs = mergePrefs(device.prefs, cloud.prefs, ctx.basePrefs);
  return { result: { ...merged, prefs, tombstones }, removedDays };
}

/**
 * Decides what a sync does, without doing it. The one hard rule (PLAN.md, Phase 9 rule 2): EMPTINESS IS NEVER A
 * DELETION. "Use this device's data" with no lessons on this device while the account has some is refused, and
 * Merge with an empty device simply hands the account's data to the device. Deletions travel only as tombstones.
 */
export function planSync(
  mode: SyncMode,
  device: SyncSnapshot,
  cloud: SyncSnapshot,
  ctx: SyncContext = freshContext(),
): SyncPlan {
  let result: SyncSnapshot;
  let removedDays: number[] = [];
  if (mode === "merge") {
    ({ result, removedDays } = planMerge(device, cloud, ctx));
  } else if (mode === "use-cloud") {
    if (isEmptySnapshot(cloud)) {
      return {
        ok: false,
        message: "Your account has no data yet, so there is nothing to bring to this device.",
      };
    }
    result = { ...cloud, prefs: { ...device.prefs, ...cloud.prefs } };
  } else {
    if (device.lessons.length === 0 && !isEmptySnapshot(cloud)) {
      return {
        ok: false,
        message:
          "This device has no lessons, and replacing your account with it would erase the account's copy. Nothing was changed. Use Sync now to bring your account's data here, or \"Delete my cloud data\" if erasing it is what you want.",
      };
    }
    // The account becomes a mirror of this device. Days it loses get a tombstone so other devices drop them too
    // instead of uploading them again; days this device has are no longer deleted.
    const deviceDays = new Set(device.lessons.map((l) => l.dayNumber));
    const tombstones: Record<string, string> = {};
    for (const [key, at] of Object.entries(cloud.tombstones))
      if (!deviceDays.has(dayOfKey(key))) tombstones[key] = at;
    for (const lesson of cloud.lessons) {
      const key = `d${lesson.dayNumber}`;
      if (!deviceDays.has(lesson.dayNumber) && !(key in tombstones))
        tombstones[key] = ctx.now.toISOString();
    }
    for (const day of ctx.pendingDeletes) {
      if (!deviceDays.has(day) && !(`d${day}` in tombstones))
        tombstones[`d${day}`] = ctx.now.toISOString();
    }
    result = { ...device, tombstones };
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
    replaceDevice: !snapshotsEqual({ ...result, tombstones: {} }, { ...device, tombstones: {} }),
    summary: {
      daysFromCloud: [...resultDays].filter((day) => !deviceDays.has(day)).length,
      daysToCloud: [...resultDays].filter((day) => !cloudDays.has(day)).length,
      conflictDays,
      removedFromDevice: [...deviceDays.keys()].filter((day) => !resultDays.has(day)).length,
      removedFromCloud: [...cloudDays.keys()].filter((day) => !resultDays.has(day)).length,
    },
    removedDays,
    nextSeen: { ...result.tombstones },
    nextBasePrefs: { ...result.prefs },
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
    if (plan.removedDays.length > 0) {
      parts.push(
        `Removed ${plan.removedDays.map((d) => `Day ${d}`).join(", ")} (deleted on another device).`,
      );
    }
    if (parts.length === 0) parts.push("Progress and settings merged.");
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
