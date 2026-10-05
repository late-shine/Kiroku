/**
 * Phase 13 — backup file format, versioning and validation.
 *
 * Pure functions only (no React, no localStorage, no DOM) so they can be tested without a browser.
 * `ProgressView`'s Export / Restore controls in `src/routes/index.tsx` are the only callers.
 *
 * Format (version 2):  { app: "kiroku", version: 2, exportedAt: <ISO string>, lessons, progress }
 *
 * What is deliberately NOT in a backup:
 * - The Gemini API key (BYOK rule — backup files get shared and emailed). `buildBackup` only accepts
 *   lessons and progress, and `parseBackup` strips every key it doesn't know, so a hand-edited file
 *   can't smuggle extra settings into the app either.
 * - Music, AI-studio and voice settings (not in v1; a later version may add them).
 *
 * RULE GOING FORWARD: any change to the `DayLesson` or `UserProgressState` shape bumps
 * `BACKUP_VERSION` and adds a step to `MIGRATIONS` below, so older backup files keep restoring.
 */
import { z } from "zod";
import { dayLessonSchema, grammarExampleSchema, grammarPointSchema } from "@/lib/lesson-schema";
import { vocabMemorySchema } from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export const BACKUP_APP = "kiroku";
export const BACKUP_VERSION = 2;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  lessons: DayLesson[];
  progress: UserProgressState;
}

/** What a successful `parseBackup` hands back: already validated, safe to put straight into state. */
export interface ParsedBackup {
  /** The version the FILE declared (0 = an old unversioned `{lessons, progress}` file). */
  version: number;
  /** When the file says it was made, or null for old files / unreadable dates. */
  exportedAt: string | null;
  lessons: DayLesson[];
  progress: UserProgressState;
}

export type BackupParseResult = { ok: true; data: ParsedBackup } | { ok: false; message: string };

export function buildBackup(
  lessons: DayLesson[],
  progress: UserProgressState,
  now: Date = new Date(),
): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    lessons,
    progress,
  };
}

// ---------------------------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------------------------

// Restore validates the SHAPE of a saved lesson, not the quality bar used for AI imports. The
// import schema demands at least 3 grammar examples so an AI can't hand back a thin lesson; but
// days the app already saved (e.g. the original hand-written sample days, 11 of the 13 of which
// have fewer than 3) must still restore, or a user's own older backups would be rejected.
// Built from the existing schema pieces, so every other rule stays in one place.
// (Exported in Phase 9b: cloud sync reads lessons back with the same lenient shape check.)
export const restoredLessonSchema = dayLessonSchema.extend({
  grammar: grammarPointSchema.extend({ examples: z.array(grammarExampleSchema) }),
});

// Mirrors `UserProgressState` by hand (same as lesson-schema.ts mirrors the lesson types). Every
// field is optional here: a missing one is filled from the default progress (older backups predate
// newer fields), but a field that IS present must have the right type.
const progressSchema = z
  .object({
    completedDays: z.array(z.number().int().positive()),
    currentDay: z.number().int().positive(),
    masteredVocabIds: z.array(z.string()),
    weakVocabIds: z.array(z.string()),
    vocabMemory: vocabMemorySchema,
    totalQuizzesTaken: z.number().int().nonnegative(),
    totalCorrectAnswers: z.number().int().nonnegative(),
    lastQuizScore: z.object({
      correct: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      date: z.string(),
    }),
    backgroundIndex: z.number().int().nonnegative(),
    bgZoomSpeed: z.enum(["slow", "medium", "still"]),
    showFurigana: z.boolean(),
  })
  .partial();

/** Written out field by field (not a spread) so adding a field to `UserProgressState` is a compile error here. */
function fillProgress(
  parsed: z.infer<typeof progressSchema>,
  defaults: UserProgressState,
): UserProgressState {
  const lastQuizScore = parsed.lastQuizScore ?? defaults.lastQuizScore;
  return {
    completedDays: parsed.completedDays ?? defaults.completedDays,
    currentDay: parsed.currentDay ?? defaults.currentDay,
    masteredVocabIds: parsed.masteredVocabIds ?? defaults.masteredVocabIds,
    weakVocabIds: parsed.weakVocabIds ?? defaults.weakVocabIds,
    vocabMemory: parsed.vocabMemory ?? defaults.vocabMemory,
    totalQuizzesTaken: parsed.totalQuizzesTaken ?? defaults.totalQuizzesTaken,
    totalCorrectAnswers: parsed.totalCorrectAnswers ?? defaults.totalCorrectAnswers,
    ...(lastQuizScore ? { lastQuizScore } : {}),
    backgroundIndex: parsed.backgroundIndex ?? defaults.backgroundIndex,
    bgZoomSpeed: parsed.bgZoomSpeed ?? defaults.bgZoomSpeed,
    showFurigana: parsed.showFurigana ?? defaults.showFurigana,
  };
}

// ---------------------------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------------------------

type RawFile = Record<string, unknown>;

/**
 * `MIGRATIONS[i]` upgrades a file from version i to version i + 1; they run in order until the file
 * is at `BACKUP_VERSION`, and only then is it validated against the CURRENT shape.
 * v0 (the old unversioned `{lessons, progress}` export) → v1: the lesson and progress shapes are
 * identical, so nothing to convert.
 * v1 → v2 (Phase 14b): progress gains `vocabMemory` (per-word review records). Older files have none, so
 * they restore with an empty memory — set explicitly here rather than left to whatever the caller's defaults hold.
 */
const MIGRATIONS: ReadonlyArray<(file: RawFile) => RawFile> = [
  (file) => file,
  (file) => {
    const progress = file["progress"];
    if (!isRecord(progress) || "vocabMemory" in progress) return file;
    return { ...file, progress: { ...progress, vocabMemory: {} } };
  },
];

// ---------------------------------------------------------------------------------------------
// parseBackup
// ---------------------------------------------------------------------------------------------

const MAX_ISSUES_SHOWN = 3;

const fail = (message: string): BackupParseResult => ({ ok: false, message });

const isRecord = (value: unknown): value is RawFile =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function summarise(issues: string[]): string {
  const shown = issues.slice(0, MAX_ISSUES_SHOWN).join("; ");
  const more = issues.length - MAX_ISSUES_SHOWN;
  return more > 0 ? `${shown}; and ${plural(more, "more problem")}` : shown;
}

/**
 * Reads backup text and either returns validated data or a plain-language reason it was refused.
 * It never throws and never touches app state — the caller only applies `data` after the user
 * confirms. `defaultProgress` fills progress fields an older file doesn't have.
 */
export function parseBackup(text: string, defaultProgress: UserProgressState): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return fail("That file isn't valid JSON, so it can't be a Kiroku backup.");
  }
  if (!isRecord(parsed)) {
    return fail(
      "That file doesn't look like a Kiroku backup (expected a JSON object with your lessons and progress).",
    );
  }

  // Which Kiroku made it? Old unversioned files have neither `app` nor `version` and count as v0.
  if ("app" in parsed && parsed["app"] !== BACKUP_APP) {
    return fail("That file isn't a Kiroku backup.");
  }
  let version = 0;
  if ("version" in parsed) {
    const declared = parsed["version"];
    if (typeof declared !== "number" || !Number.isInteger(declared) || declared < 0) {
      return fail("That backup has an unreadable version number, so it wasn't restored.");
    }
    version = declared;
  }
  if (version >= 1 && parsed["app"] !== BACKUP_APP) {
    return fail("That file isn't a Kiroku backup.");
  }
  if (version > BACKUP_VERSION) {
    return fail(
      `That backup was made by a newer Kiroku (backup format v${version}; this version understands up to v${BACKUP_VERSION}). Update Kiroku, or restore it there.`,
    );
  }

  let file: RawFile = parsed;
  for (let v = version; v < BACKUP_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step)
      return fail(
        "That backup is from a version this Kiroku can't convert, so it wasn't restored.",
      );
    file = step(file);
  }

  // ---- lessons ----
  const rawLessons = file["lessons"];
  if (!Array.isArray(rawLessons)) {
    return fail(
      "That backup has no list of lessons (\"lessons\" is missing or isn't a list), so it wasn't restored.",
    );
  }
  const lessons: DayLesson[] = [];
  const lessonIssues: string[] = [];
  rawLessons.forEach((rawLesson: unknown, index) => {
    const result = restoredLessonSchema.safeParse(rawLesson);
    if (result.success) {
      lessons.push({ completed: false, ...result.data } as DayLesson);
      return;
    }
    const dayNumber = isRecord(rawLesson) ? rawLesson["dayNumber"] : undefined;
    const label = typeof dayNumber === "number" ? `Day ${dayNumber}` : `Lesson #${index + 1}`;
    for (const issue of result.error.issues) {
      lessonIssues.push(`${label}: ${issue.path.join(".") || "(whole lesson)"} — ${issue.message}`);
    }
  });
  if (lessonIssues.length > 0) {
    return fail(
      `Some lessons in that backup are damaged: ${summarise(lessonIssues)}. Nothing was restored.`,
    );
  }
  const seen = new Set<number>();
  for (const lesson of lessons) {
    if (seen.has(lesson.dayNumber)) {
      return fail(
        `That backup lists Day ${lesson.dayNumber} more than once, so it wasn't restored.`,
      );
    }
    seen.add(lesson.dayNumber);
  }
  lessons.sort((a, b) => a.dayNumber - b.dayNumber);

  // ---- progress ----
  const rawProgress = file["progress"];
  if (!isRecord(rawProgress)) {
    return fail(
      "That backup has no progress data (\"progress\" is missing or isn't an object), so it wasn't restored.",
    );
  }
  const progressResult = progressSchema.safeParse(rawProgress);
  if (!progressResult.success) {
    const issues = progressResult.error.issues.map(
      (i) => `progress.${i.path.join(".") || "(root)"} — ${i.message}`,
    );
    return fail(
      `The progress data in that backup is damaged: ${summarise(issues)}. Nothing was restored.`,
    );
  }

  const exportedAt =
    typeof file["exportedAt"] === "string" && !Number.isNaN(Date.parse(file["exportedAt"]))
      ? file["exportedAt"]
      : null;

  return {
    ok: true,
    data: {
      version,
      exportedAt,
      lessons,
      progress: fillProgress(progressResult.data, defaultProgress),
    },
  };
}
