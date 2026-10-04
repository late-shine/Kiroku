/**
 * Phase 13 — no-browser checks for src/lib/backup.ts.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-13-backup-check.ts
 * (Lives in handoffs/, outside tsconfig's `include`, so it never becomes part of the app build.)
 * Exits non-zero if any case fails.
 */
import { isDeepStrictEqual } from "node:util";
import { INITIAL_LESSONS } from "../src/data/initialLessons";
import { BACKUP_VERSION, buildBackup, parseBackup } from "../src/lib/backup";
import type { UserProgressState } from "../src/types/japanese";

const defaults: UserProgressState = {
  completedDays: [],
  currentDay: 1,
  masteredVocabIds: [],
  weakVocabIds: [],
  vocabMemory: {},
  totalQuizzesTaken: 0,
  totalCorrectAnswers: 0,
  backgroundIndex: 0,
  bgZoomSpeed: "slow",
  showFurigana: true,
};
const progress: UserProgressState = {
  ...defaults,
  completedDays: [1, 2],
  currentDay: 2,
  masteredVocabIds: ["d1-1"],
  vocabMemory: {
    "d1-1": {
      japanese: "日",
      box: 3,
      due: "2026-10-09",
      right: 4,
      wrong: 1,
      lastAnswered: "2026-10-02T10:00:00.000Z",
    },
  },
  totalQuizzesTaken: 4,
  totalCorrectAnswers: 34,
  lastQuizScore: { correct: 8, total: 10, date: "2026-09-01" },
  backgroundIndex: 2,
  bgZoomSpeed: "medium",
  showFurigana: false,
};
const lessons = INITIAL_LESSONS;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const run = (value: unknown) =>
  parseBackup(typeof value === "string" ? value : JSON.stringify(value), defaults);
const refused = (name: string, value: unknown, mustInclude: string) => {
  const r = run(value);
  check(
    name,
    !r.ok && r.message.includes(mustInclude),
    r.ok ? "was accepted" : `message: ${r.message}`,
  );
};

// 1. legacy unversioned {lessons, progress} file -> version 0, accepted (13 real sample days, 11 of which have <3 grammar examples)
{
  const r = run({ lessons, progress });
  check(
    "legacy unversioned file is accepted as version 0",
    r.ok && r.data.version === 0 && r.data.lessons.length === 13 && r.data.exportedAt === null,
    JSON.stringify(r),
  );
  check(
    "legacy: progress values kept",
    r.ok &&
      r.data.progress.totalCorrectAnswers === 34 &&
      r.data.progress.lastQuizScore?.correct === 8,
  );
}

// 2. versioned file round-trips through buildBackup -> JSON -> parseBackup
{
  const built = buildBackup(lessons, progress, new Date("2026-09-30T12:00:00Z"));
  check(
    "buildBackup shape",
    built.app === "kiroku" &&
      built.version === BACKUP_VERSION &&
      built.exportedAt === "2026-09-30T12:00:00.000Z" &&
      Object.keys(built).sort().join() === "app,exportedAt,lessons,progress,version",
  );
  const r = run(JSON.stringify(built, null, 2));
  check(
    "versioned file round-trips",
    r.ok &&
      r.data.version === BACKUP_VERSION &&
      r.data.exportedAt === "2026-09-30T12:00:00.000Z" &&
      r.data.lessons.length === 13 &&
      isDeepStrictEqual(r.data.progress, progress),
    JSON.stringify(r.ok ? r.data.progress : r),
  );
}

// 3. garbage text / wrong top-level types
refused("garbage text is refused", "hello, not json {{", "valid JSON");
refused("JSON array is refused", [1, 2, 3], "doesn't look like a Kiroku backup");
refused("JSON string is refused", '"hi"', "doesn't look like a Kiroku backup");

// 4. lessons problems
refused("lessons not an array", { lessons: "nope", progress }, "no list of lessons");
refused("lessons missing", { progress }, "no list of lessons");
refused(
  "lesson missing required field",
  { lessons: [{ ...lessons[0], title: "" }], progress },
  "Day 1",
);
refused("lesson that is not an object", { lessons: [42], progress }, "Lesson #1");
refused("duplicate day numbers", { lessons: [lessons[0], lessons[0]], progress }, "more than once");
{
  const r = run({ lessons: [], progress });
  check("empty lessons list is a valid backup", r.ok && r.data.lessons.length === 0);
}
{
  const r = run({ lessons: [lessons[2], lessons[0]], progress });
  check(
    "lessons come back sorted by day",
    r.ok && r.data.lessons.map((l) => l.dayNumber).join() === "1,3",
  );
}

// 5. progress problems
refused("progress missing", { lessons }, "no progress data");
refused("progress not an object", { lessons, progress: [] }, "no progress data");
refused(
  "progress field with wrong type",
  { lessons, progress: { ...progress, completedDays: "1,2" } },
  "progress.completedDays",
);
refused(
  "progress enum field invalid",
  { lessons, progress: { ...progress, bgZoomSpeed: "warp" } },
  "progress.bgZoomSpeed",
);
{
  const { showFurigana: _a, bgZoomSpeed: _b, totalQuizzesTaken: _c, ...partial } = progress;
  const r = run({ lessons, progress: partial });
  check(
    "progress with missing fields is filled from defaults",
    r.ok &&
      r.data.progress.showFurigana === true &&
      r.data.progress.bgZoomSpeed === "slow" &&
      r.data.progress.totalQuizzesTaken === 0 &&
      r.data.progress.totalCorrectAnswers === 34,
    JSON.stringify(r),
  );
}
{
  const r = run({ lessons, progress: {} });
  check(
    "empty progress object -> all defaults",
    r.ok && isDeepStrictEqual(r.data.progress, defaults),
  );
}

// 5b. Phase 14b — vocabMemory + the v1 -> v2 migration
{
  const withRecords = {
    ...defaults,
    vocabMemory: {
      "d9-9": {
        japanese: "x",
        box: 2,
        due: "2026-10-10",
        right: 1,
        wrong: 0,
        lastAnswered: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const { vocabMemory: _vm, ...progressV1 } = progress;
  const v1 = {
    app: "kiroku",
    version: 1,
    exportedAt: "2026-09-30T12:00:00.000Z",
    lessons,
    progress: progressV1,
  };
  const r1 = parseBackup(JSON.stringify(v1), withRecords);
  check(
    "v1 file restores with an EMPTY vocabMemory (even if the caller's defaults hold records)",
    r1.ok && r1.data.version === 1 && isDeepStrictEqual(r1.data.progress.vocabMemory, {}),
    JSON.stringify(r1.ok ? r1.data.progress.vocabMemory : r1),
  );
  const r0 = parseBackup(JSON.stringify({ lessons, progress: progressV1 }), withRecords);
  check(
    "v0 file restores with an empty vocabMemory",
    r0.ok && isDeepStrictEqual(r0.data.progress.vocabMemory, {}),
  );
  const r2 = run(buildBackup(lessons, progress));
  check(
    "v2 file keeps its vocabMemory exactly",
    r2.ok && isDeepStrictEqual(r2.data.progress.vocabMemory, progress.vocabMemory),
  );
  const rm = run({ app: "kiroku", version: 2, lessons, progress: { completedDays: [1] } });
  check(
    "v2 file with no vocabMemory -> the defaults' (empty)",
    rm.ok && isDeepStrictEqual(rm.data.progress.vocabMemory, {}),
  );
}
const rec = {
  japanese: "日",
  box: 3,
  due: "2026-10-09",
  right: 4,
  wrong: 1,
  lastAnswered: "2026-10-02T10:00:00.000Z",
};
const withMem = (m: unknown) => ({ lessons, progress: { ...progress, vocabMemory: m } });
refused("vocabMemory that is not an object", withMem([1]), "progress.vocabMemory");
refused("record with box 9", withMem({ "d1-1": { ...rec, box: 9 } }), "progress.vocabMemory");
refused("record with box 0", withMem({ "d1-1": { ...rec, box: 0 } }), "progress.vocabMemory");
refused(
  "record with a fake due date",
  withMem({ "d1-1": { ...rec, due: "2026-13-40" } }),
  "progress.vocabMemory",
);
refused(
  "record with negative wrong",
  withMem({ "d1-1": { ...rec, wrong: -1 } }),
  "progress.vocabMemory",
);
refused("record missing a field", withMem({ "d1-1": { box: 2 } }), "progress.vocabMemory");
refused("record under a malformed id", withMem({ hello: rec }), "progress.vocabMemory");

// 6. version / app problems
refused(
  "too-new version",
  { ...buildBackup(lessons, progress), version: BACKUP_VERSION + 1 },
  "newer Kiroku",
);
refused(
  "non-integer version",
  { ...buildBackup(lessons, progress), version: 1.5 },
  "unreadable version",
);
refused(
  "string version",
  { ...buildBackup(lessons, progress), version: "1" },
  "unreadable version",
);
refused(
  "negative version",
  { ...buildBackup(lessons, progress), version: -1 },
  "unreadable version",
);
refused(
  "another app's file",
  { ...buildBackup(lessons, progress), app: "other" },
  "isn't a Kiroku backup",
);
refused("version 1 without app", { version: 1, lessons, progress }, "isn't a Kiroku backup");

// 7. key safety: nothing but the known fields survives a restore
{
  const sneaky = {
    ...buildBackup(lessons, progress),
    geminiKey: "AIza-fake",
    progress: { ...progress, geminiKey: "AIza-fake" },
  };
  const r = run(sneaky);
  check(
    "unknown keys (e.g. a Gemini key) are stripped on restore",
    r.ok && !JSON.stringify(r.data).includes("AIza-fake"),
  );
  check(
    "export never contains a key field",
    !JSON.stringify(buildBackup(lessons, progress)).toLowerCase().includes("gemini"),
  );
}

// 8. failure never throws on hostile-but-valid JSON
for (const v of [
  "null",
  "0",
  "true",
  "{}",
  '{"lessons":null,"progress":null}',
  '{"version":null}',
]) {
  let threw = false;
  try {
    parseBackup(v, defaults);
  } catch {
    threw = true;
  }
  check(`does not throw on ${v}`, !threw);
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
