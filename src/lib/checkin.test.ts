import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckinPrompt,
  checkinMapSchema,
  checkinScore,
  checkinSuggestion,
  createCheckinSession,
  mergeCheckins,
  parseCheckinResult,
  parseStoredCheckins,
  selectCheckinLessons,
  type CheckinRecord,
  type CheckinResult,
} from "./checkin";
import { buildBackup, parseBackup } from "./backup";
import {
  applyProgress,
  decodeCloud,
  encodeSnapshot,
  isEmptySnapshot,
  mergeSnapshots,
  planSync,
  snapshotOf,
  snapshotsEqual,
  stripDays,
  SYNC_SCHEMA,
} from "./sync";
import type { DayLesson, UserProgressState } from "../types/japanese";

const makeLesson = (dayNumber: number): DayLesson => ({
  dayNumber,
  title: `Lesson ${dayNumber}`,
  topic: "Introductions",
  completed: false,
  grammar: [
    {
      title: "です",
      summary: "Polite copula",
      structure: "Noun + です",
      explanation: "Use です to identify something politely.",
      examples: [{ japanese: "学生です。", reading: "がくせいです。", english: "I am a student." }],
    },
  ],
  vocab: [
    {
      id: `d${dayNumber}-1`,
      day: dayNumber,
      japanese: "学生",
      reading: "がくせい",
      meaning: "student",
    },
  ],
  kanji: [
    {
      character: "日",
      meaning: "day; sun",
      strokes: 4,
      onyomi: ["ニチ"],
      kunyomi: ["ひ"],
      compounds: [{ word: "日本", reading: "にほん", meaning: "Japan" }],
    },
  ],
  naturalPhrase: {
    phrase: "よろしくお願いします",
    reading: "よろしくおねがいします",
    meaning: "Nice to meet you",
    context: "After an introduction",
  },
  pattern: "Noun + です",
});
const lessons = [1, 2, 4, 5, 6, 7].map(makeLesson);
const defaults: UserProgressState = {
  completedDays: [],
  currentDay: 1,
  masteredVocabIds: [],
  weakVocabIds: [],
  vocabMemory: {},
  totalQuizzesTaken: 0,
  totalCorrectAnswers: 0,
  studyLog: {},
  writing: {},
  writingLog: {},
  badges: {},
  checkins: {},
  backgroundIndex: 0,
  bgZoomSpeed: "still",
  showFurigana: true,
};
const progress = { ...defaults, completedDays: lessons.map((l) => l.dayNumber) };
const now = new Date("2026-11-18T12:00:00.000Z");
const created = createCheckinSession(lessons, progress, 5, now);
assert.ok(created.ok);
const session = created.session;
const result: CheckinResult = {
  type: "kiroku-checkin",
  version: 1,
  sessionId: session.id,
  submitted: true,
  summary: "You can introduce yourself politely.",
  strengths: ["Clear vocabulary recall"],
  revisit: ["Practice sentence endings"],
  questions: session.questions.map((q) => ({
    ...q,
    prompt: "Introduce yourself.",
    answer: "学生です。",
    expectedAnswer: "学生です。",
    feedback: "The form and meaning are correct.",
    score: 2,
    status: "answered",
  })),
};
const pending: CheckinRecord = { status: "pending", session };
const complete: CheckinRecord = { status: "complete", session, result, savedAt: now.toISOString() };
const deleted: CheckinRecord = { status: "deleted", id: session.id, deletedAt: now.toISOString() };
const map = { [session.id]: complete };

test("lesson scopes respect completion, sorting and missing day numbers", () => {
  assert.deepEqual(
    selectCheckinLessons([...lessons].reverse(), progress.completedDays, "recent", 1, 7).map(
      (l) => l.dayNumber,
    ),
    [2, 4, 5, 6, 7],
  );
  assert.deepEqual(
    selectCheckinLessons(lessons, [], "range", 2, 5).map((l) => l.dayNumber),
    [2, 4, 5],
  );
  assert.equal(selectCheckinLessons(lessons, [], "all", 1, 7).length, 0);
  assert.equal(selectCheckinLessons(lessons, [], "range", 5, 2).length, 0);
});
test("empty and oversized scopes are refused", () => {
  assert.equal(createCheckinSession([], defaults, 5).ok, false);
  assert.equal(
    createCheckinSession(
      Array.from({ length: 21 }, (_, i) => makeLesson(i + 1)),
      progress,
      5,
    ).ok,
    false,
  );
});
test("session IDs are unique and blueprint has all four skills", () => {
  const next = createCheckinSession(lessons, progress, 10);
  assert.ok(next.ok);
  assert.notEqual(next.session.id, session.id);
  assert.equal(next.session.questions.length, 10);
  assert.equal(new Set(session.questions.map((q) => q.kind)).size, 4);
});
test("prompt sends only curriculum labels and retains the waiting/submission protocol", () => {
  const prompt = buildCheckinPrompt(session);
  for (const phrase of [
    "学生",
    "です",
    "日",
    "よろしくお願いします",
    "STOP and WAIT",
    "SUBMIT",
    "no answer key",
    "actual answers",
    "Assisted answers score at most 1",
    session.id,
  ])
    assert.ok(prompt.includes(phrase), phrase);
  const curriculum = JSON.parse(
    prompt
      .split("COMPACT CURRICULUM (labels only; IDs connect questions to their source):\n")[1]!
      .split("\n\nFINAL EXPORT")[0]!,
  );
  assert.deepEqual(
    curriculum,
    session.sources.map(({ id, day, kind, label }) => ({ id, day, kind, label })),
  );
  for (const omitted of [
    "student",
    "Polite copula",
    "がくせい",
    "日本",
    "Nice to meet you",
    "Noun + です",
    "completedDays",
    "vocabMemory",
  ])
    assert.ok(!prompt.includes(omitted), omitted);
});
test("the prompt scaffold cannot masquerade as an actual result", () => {
  assert.equal(parseCheckinResult(buildCheckinPrompt(session), session).ok, false);
  const forged = { ...result, summary: "__KIROKU_SUMMARY__" };
  assert.equal(parseCheckinResult(JSON.stringify(forged), session).ok, false);
});
test("device replacement retains tombstones and tombstones removed cloud-only results", () => {
  const device = snapshotOf(lessons, defaults);
  const cloudDeleted = snapshotOf(lessons, { ...progress, checkins: { [session.id]: deleted } });
  const retained = planSync("use-device", device, cloudDeleted);
  assert.ok(retained.ok);
  assert.equal(retained.result.progress.checkins?.[session.id]?.status, "deleted");
  const cloud = snapshotOf(lessons, { ...progress, checkins: map });
  const replacement = planSync("use-device", device, cloud);
  assert.ok(replacement.ok);
  assert.equal(replacement.result.progress.checkins?.[session.id]?.status, "deleted");
  assert.equal(
    mergeSnapshots(cloud, replacement.result).progress.checkins?.[session.id]?.status,
    "deleted",
  );
});
test("full final reply and bare JSON both parse", () => {
  const raw = `Your review\n\`\`\`kiroku-checkin\n${JSON.stringify(result)}\n\`\`\`\nDone`;
  assert.ok(parseCheckinResult(raw, session).ok);
  assert.ok(parseCheckinResult(JSON.stringify(result), session).ok);
  assert.deepEqual(checkinScore(result), { earned: 10, possible: 10, percent: 100 });
});
test("questions alone, malformed JSON and unsubmitted exports are rejected", () => {
  for (const raw of [
    "Q1: What does 学生 mean?",
    "{",
    JSON.stringify({ ...result, submitted: false }),
    JSON.stringify({ ...result, questions: [] }),
  ])
    assert.equal(parseCheckinResult(raw, session).ok, false);
});
test("foreign sessions and wrong or duplicate source/question references are rejected", () => {
  for (const value of [
    { ...result, sessionId: `ci_${"a".repeat(32)}` },
    { ...result, questions: result.questions.slice(1) },
    { ...result, questions: [result.questions[0], ...result.questions.slice(0, -1)] },
    {
      ...result,
      questions: result.questions.map((q, i) => (i ? q : { ...q, sourceId: "d999-g1" })),
    },
  ])
    assert.equal(parseCheckinResult(JSON.stringify(value), session).ok, false);
});
test("skipped and assisted answers follow rubric; valid partial attempts are retained", () => {
  const questions = structuredClone(result.questions);
  questions[0] = { ...questions[0]!, status: "skipped", score: 0, answer: "" };
  questions[1] = { ...questions[1]!, status: "assisted", score: 1 };
  const parsed = parseCheckinResult(JSON.stringify({ ...result, questions }), session);
  assert.ok(parsed.ok);
  assert.equal(checkinScore(parsed.result).earned, 7);
  questions[1].score = 2;
  assert.equal(parseCheckinResult(JSON.stringify({ ...result, questions }), session).ok, false);
  questions[1].score = 1;
  questions[0].answer = "Fabricated";
  assert.equal(parseCheckinResult(JSON.stringify({ ...result, questions }), session).ok, false);
});
test("two export blocks are refused and reordered valid questions are normalized", () => {
  const block = `\`\`\`kiroku-checkin\n${JSON.stringify(result)}\n\`\`\``;
  assert.equal(parseCheckinResult(block + block, session).ok, false);
  const parsed = parseCheckinResult(
    JSON.stringify({ ...result, questions: [...result.questions].reverse() }),
    session,
  );
  assert.ok(parsed.ok);
  assert.equal(parsed.result.questions[0]?.id, "q1");
});
test("record map rejects mismatched IDs and invalid local entries are isolated", () => {
  assert.ok(checkinMapSchema.safeParse(map).success);
  assert.equal(checkinMapSchema.safeParse({ [`ci_${"b".repeat(32)}`]: complete }).success, false);
  assert.deepEqual(parseStoredCheckins({ ...map, nonsense: {} }), map);
});
test("merge is idempotent and deletion wins over all stale devices", () => {
  assert.deepEqual(mergeCheckins(map, map), map);
  assert.deepEqual(mergeCheckins({ [session.id]: pending }, map), map);
  assert.deepEqual(mergeCheckins(map, { [session.id]: deleted }), { [session.id]: deleted });
  assert.deepEqual(mergeCheckins({ [session.id]: deleted }, map), { [session.id]: deleted });
});
test("backup v7 round-trips full journal and v6 starts with an empty journal", () => {
  const backup = buildBackup(lessons, { ...progress, checkins: map }, now);
  assert.equal(backup.version, 7);
  const parsed = parseBackup(JSON.stringify(backup), defaults);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.data.progress.checkins, map);
  const old = parseBackup(
    JSON.stringify({ ...backup, version: 6, progress: { ...progress, checkins: undefined } }),
    { ...defaults, checkins: map },
  );
  assert.ok(old.ok);
  assert.deepEqual(old.data.progress.checkins, {});
});
test("sync v4 JSON strings preserve arrays and do not alter measured quiz progress", () => {
  const snapshot = snapshotOf(lessons, { ...progress, checkins: map });
  const wire = encodeSnapshot(snapshot, now);
  assert.equal(SYNC_SCHEMA, 4);
  const decoded = decodeCloud(wire);
  assert.ok(decoded.ok);
  assert.ok(snapshotsEqual(decoded.snapshot, snapshot));
  assert.deepEqual(applyProgress(decoded.snapshot, defaults).checkins, map);
  assert.equal(decoded.snapshot.progress.totalQuizzesTaken, 0);
  assert.equal(isEmptySnapshot(snapshotOf([], { ...defaults, checkins: map })), false);
});
test("malformed cloud records and newer schemas fail closed", () => {
  for (const checkins of [
    "wrong",
    { [session.id]: "{" },
    {
      [session.id]: JSON.stringify({
        ...complete,
        result: { ...result, sessionId: `ci_${"c".repeat(32)}` },
      }),
    },
    JSON.parse('{"__proto__":"{}"}'),
  ])
    assert.equal(decodeCloud({ progress: { checkins } }).ok, false);
  assert.equal(decodeCloud({ meta: { schema: 5 } }).ok, false);
});
test("deleted lessons do not erase historical check-ins; use-cloud can clear local entries", () => {
  const snapshot = snapshotOf(lessons, { ...progress, checkins: map });
  assert.deepEqual(stripDays(snapshot, progress.completedDays).progress.checkins, map);
  const empty = snapshotOf([], defaults);
  assert.deepEqual(applyProgress(empty, { ...progress, checkins: map }).checkins, {});
  assert.deepEqual(
    mergeSnapshots(snapshot, snapshotOf([], { ...defaults, checkins: { [session.id]: deleted } }))
      .progress.checkins,
    { [session.id]: deleted },
  );
});
test("reminders use completed lessons, suppress pending sessions and observe cooldown", () => {
  assert.equal(checkinSuggestion(lessons, progress, now), 6);
  assert.equal(
    checkinSuggestion(lessons, { ...progress, checkins: { [session.id]: pending } }, now),
    0,
  );
  assert.equal(checkinSuggestion(lessons, { ...progress, checkins: map }, now), 0);
  const more = [...lessons, ...[8, 9, 10, 11, 12].map(makeLesson)];
  const p = { ...progress, completedDays: more.map((l) => l.dayNumber), checkins: map };
  assert.equal(checkinSuggestion(more, p, new Date("2026-11-19T12:00:00Z")), 0);
  assert.equal(checkinSuggestion(more, p, new Date("2026-11-26T12:00:00Z")), 5);
});
