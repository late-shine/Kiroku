import assert from "node:assert/strict";
import test from "node:test";
import type { VocabWord, WordMemory } from "@/types/japanese";
import {
  DEFAULT_QUIZ_PREFS,
  backlogKeepCount,
  dailyDueDone,
  dailyDueRemaining,
  effectiveDueRoundLength,
  grantBonusReview,
  isDailyGoalComplete,
  parseQuizPrefs,
  recordDueAnswered,
} from "./quiz-prefs";
import { applyAnswer, nextBoxOnMiss, spreadBacklog, type VocabMemory } from "./word-memory";
import { buildDueRound, dueWordsByFocus } from "../components/quiz/round";

const makeWord = (id: string, day = 1): VocabWord => ({
  id,
  day,
  japanese: `語${id}`,
  reading: `ご${id}`,
  meaning: `meaning ${id}`,
});

const makeMemory = (word: VocabWord, box: number, due: string): WordMemory => ({
  japanese: word.japanese,
  box,
  due,
  right: 2,
  wrong: 0,
  lastAnswered: "2026-10-01T10:00:00.000Z",
});

test("gentle step-down miss rule preserves progress for higher boxes", () => {
  assert.equal(nextBoxOnMiss(1), 1);
  assert.equal(nextBoxOnMiss(2), 1);
  assert.equal(nextBoxOnMiss(3), 2);
  assert.equal(nextBoxOnMiss(4), 2);
  assert.equal(nextBoxOnMiss(5), 3);

  const w = makeWord("d1-1");
  const now = new Date("2026-11-21T12:00:00.000Z");
  const box5 = makeMemory(w, 5, "2026-11-20");
  const afterMiss = applyAnswer(w, box5, false, now);
  assert.equal(afterMiss.box, 3);
  assert.equal(afterMiss.due, "2026-11-28"); // Box 3 gap = 7 days

  const box4 = makeMemory(w, 4, "2026-11-20");
  const afterMiss4 = applyAnswer(w, box4, false, now);
  assert.equal(afterMiss4.box, 2);
  assert.equal(afterMiss4.due, "2026-11-24"); // Box 2 gap = 3 days
});

test("daily goal pacing tracks remaining count, completion, bonus rounds, and midnight reset", () => {
  const today = "2026-11-21";
  const tomorrow = "2026-11-22";

  // 312 overdue words, default goal 20
  let prefs = { ...DEFAULT_QUIZ_PREFS };
  assert.equal(dailyDueRemaining(312, prefs, today), 20);
  assert.equal(isDailyGoalComplete(312, prefs, today), false);

  // Answer 10 due words -> 10 remaining
  prefs = recordDueAnswered(prefs, today, 10);
  assert.equal(dailyDueDone(prefs, today), 10);
  assert.equal(dailyDueRemaining(302, prefs, today), 10);
  assert.equal(isDailyGoalComplete(302, prefs, today), false);

  // Answer 10 more -> goal complete, 0 remaining even with 292 in backlog
  prefs = recordDueAnswered(prefs, today, 10);
  assert.equal(dailyDueRemaining(292, prefs, today), 0);
  assert.equal(isDailyGoalComplete(292, prefs, today), true);

  // Request 10 more -> remaining becomes 10
  prefs = grantBonusReview(prefs, today, 10);
  assert.equal(dailyDueRemaining(292, prefs, today), 10);
  assert.equal(isDailyGoalComplete(292, prefs, today), false);

  // Next day resets done count and bonus
  assert.equal(dailyDueDone(prefs, tomorrow), 0);
  assert.equal(dailyDueRemaining(292, prefs, tomorrow), 20);

  // All goal returns full dueNow
  const allPrefs = parseQuizPrefs({ dailyGoal: "all" });
  assert.equal(dailyDueRemaining(292, allPrefs, today), 292);
  assert.equal(isDailyGoalComplete(292, allPrefs, today), false);
});

test("dueWordsByFocus mixes fresh and overdue words in balanced mode without duplicates", () => {
  const words: VocabWord[] = [];
  const memory: VocabMemory = {};
  for (let i = 1; i <= 12; i++) {
    const w = makeWord(`d1-${i}`);
    words.push(w);
    const day = String(i).padStart(2, "0");
    memory[w.id] = makeMemory(w, 2, `2026-11-${day}`);
  }
  const fixedRng = () => 0;
  const oldest = dueWordsByFocus(words, memory, "2026-11-21", "oldest", fixedRng);
  const fresh = dueWordsByFocus(words, memory, "2026-11-21", "fresh", fixedRng);
  const balanced = dueWordsByFocus(words, memory, "2026-11-21", "balanced", fixedRng);

  assert.equal(oldest[0]?.id, "d1-1");
  assert.equal(fresh[0]?.id, "d1-12");

  // Balanced round of 10 mixes both fresh (late dates) and oldest (early dates) with zero duplicates
  const round = buildDueRound(
    words,
    memory,
    "2026-11-21",
    10,
    words,
    fixedRng,
    "progress",
    "balanced",
  );
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((q) => q.word.id)).size, 10);
  assert.equal(balanced.length, 12);
  assert.ok(round.slice(0, 6).some((q) => q.word.id === "d1-12"));
  assert.ok(round.slice(0, 6).some((q) => q.word.id === "d1-1"));
});

test("spreadBacklog keeps today's cap and distributes excess across future days", () => {
  const words: VocabWord[] = [];
  const memory: VocabMemory = {};
  for (let i = 1; i <= 50; i++) {
    const w = makeWord(`d1-${i}`);
    words.push(w);
    const due = i <= 30 ? "2026-10-01" : "2026-11-20";
    memory[w.id] = { ...makeMemory(w, 4, due), streak: 2 };
  }

  const spread = spreadBacklog(
    memory,
    words,
    "2026-11-21",
    7,
    20,
    new Date("2026-11-21T12:00:00.000Z"),
  );
  const dueToday = words.filter((w) => (spread[w.id]?.due ?? "") <= "2026-11-21");
  const dueLater = words.filter((w) => (spread[w.id]?.due ?? "") > "2026-11-21");
  assert.equal(dueToday.length, 20);
  assert.equal(dueLater.length, 30);

  // Kept words keep freshest dates (2026-11-20)
  for (let i = 31; i <= 50; i++) {
    assert.equal(spread[`d1-${i}`]?.due, "2026-11-20");
  }
  // Spread words preserve box & streak and land within 1..7 days after today
  for (let i = 1; i <= 30; i++) {
    const rec = spread[`d1-${i}`];
    assert.ok(rec);
    assert.equal(rec.box, 4);
    assert.equal(rec.streak, 2);
    assert.ok(rec.due >= "2026-11-22" && rec.due <= "2026-11-28");
  }
});

test("backlogKeepCount and keepToday=0 spreadBacklog move all overdue words starting tomorrow", () => {
  assert.equal(backlogKeepCount(120, 20, true), 20);
  assert.equal(backlogKeepCount(120, 7, true), 7);
  assert.equal(backlogKeepCount(120, 0, true), 0);
  assert.equal(backlogKeepCount(120, 120, false), 20);
  assert.equal(backlogKeepCount(12, 12, false), 12);

  const words: VocabWord[] = [];
  const memory: VocabMemory = {};
  for (let i = 1; i <= 42; i++) {
    const w = makeWord(`d2-${i}`);
    words.push(w);
    memory[w.id] = { ...makeMemory(w, 3, "2026-11-10"), streak: 1 };
  }
  const spread = spreadBacklog(
    memory,
    words,
    "2026-11-21",
    14,
    0,
    new Date("2026-11-21T12:00:00.000Z"),
  );
  const dueToday = words.filter((w) => (spread[w.id]?.due ?? "") <= "2026-11-21");
  assert.equal(dueToday.length, 0);
  for (const w of words) {
    const rec = spread[w.id];
    assert.ok(rec);
    assert.equal(rec.box, 3);
    assert.equal(rec.streak, 1);
    assert.ok(rec.due >= "2026-11-22" && rec.due <= "2026-12-05");
  }
});

test("effectiveDueRoundLength caps rounds to remaining daily goal", () => {
  assert.equal(effectiveDueRoundLength(10, 20, true), 10);
  assert.equal(effectiveDueRoundLength(20, 5, true), 5);
  assert.equal(effectiveDueRoundLength("all", 12, true), 12);
  assert.equal(effectiveDueRoundLength(10, 0, true), 0);
  assert.equal(effectiveDueRoundLength("all", 312, false), "all");
});
