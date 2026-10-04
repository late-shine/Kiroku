/**
 * Phase 14b-fix (calm intake) — no-browser checks for the new review-intake rules.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14b-fix-check.ts
 * Exits non-zero if any case fails. Covers: a word with no record is not due; "Add to review" (one word and
 * a whole day) never resets existing records; a restored 13-day course starts with 0 due; answering still
 * creates a record; the 99+ cap; most-overdue-first ordering with random ties; the Due round keeps that
 * order and still has 4 options.
 */
import {
  addToReview,
  applyAnswer,
  badgeText,
  dueWords,
  isDue,
  isInReview,
  localDay,
  notInReview,
  recordAnswer,
  reviewCount,
  type VocabMemory,
} from "../src/lib/word-memory";
import { buildDueRound, dueWordsOverdueFirst, type Rng } from "../src/components/quiz/round";
import type { VocabWord, WordMemory } from "../src/types/japanese";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const word = (id: string, japanese = `J-${id}`): VocabWord => ({
  id,
  japanese,
  reading: "r",
  meaning: `m-${id}`,
  day: 1,
});
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);
const TODAY = "2026-10-03";
const NOW = at(2026, 10, 3);
const rec = (japanese: string, box: number, due: string): WordMemory => ({
  japanese,
  box,
  due,
  right: 2,
  wrong: 1,
  lastAnswered: "2026-10-01T10:00:00.000Z",
});

// ---- a restored course starts calm ----
{
  const words = Array.from({ length: 130 }, (_, i) =>
    word(`d${Math.floor(i / 10) + 1}-${(i % 10) + 1}`),
  );
  check("130 untouched words -> 0 due", dueWords(words, {}, TODAY).length === 0);
  check("130 untouched words -> 0 in review", reviewCount(words, {}) === 0);
  check("130 untouched words -> all 130 are not in review", notInReview(words, {}).length === 130);
}

// ---- isDue / isInReview ----
{
  check("isDue(no record) is false", !isDue(undefined, TODAY));
  check("isDue(due today) is true", isDue(rec("a", 1, TODAY), TODAY));
  check("isDue(overdue) is true", isDue(rec("a", 1, "2026-09-01"), TODAY));
  check("isDue(due tomorrow) is false", !isDue(rec("a", 1, "2026-10-04"), TODAY));
  const w = word("d1-1", "日");
  check("isInReview: no record", !isInReview({}, w));
  check("isInReview: has record", isInReview({ "d1-1": rec("日", 1, TODAY) }, w));
  check(
    "isInReview: record for a different word (re-imported day) does not count",
    !isInReview({ "d1-1": rec("月", 1, TODAY) }, w),
  );
}

// ---- addToReview ----
{
  const a = word("d1-1", "日");
  const b = word("d1-2", "月");
  const c = word("d1-3", "火");
  const m0: VocabMemory = {};
  const m1 = addToReview(m0, [a], NOW);
  check("adding one word makes exactly one record", Object.keys(m1).length === 1 && !!m1["d1-1"]);
  check("input memory is not changed", Object.keys(m0).length === 0 && m1 !== m0);
  const r = m1["d1-1"] as WordMemory;
  check(
    "new record: box 1, due today, 0 right, 0 wrong, its Japanese text",
    r.box === 1 && r.due === TODAY && r.right === 0 && r.wrong === 0 && r.japanese === "日",
    JSON.stringify(r),
  );
  check("an added word is due today", dueWords([a], m1, TODAY).length === 1);
  check("an added word counts as in review", reviewCount([a, b], m1) === 1);

  // adding must never reset progress
  const existing = rec("月", 4, "2026-10-20");
  const m2: VocabMemory = { "d1-2": existing };
  const m3 = addToReview(m2, [a, b, c], NOW);
  check("adding a whole day leaves an existing record untouched", same(m3["d1-2"], existing));
  check("adding a whole day adds only the words that had none", Object.keys(m3).length === 3);
  check(
    "returns the SAME object when there is nothing to add",
    addToReview(m3, [a, b, c], NOW) === m3,
  );
  check(
    "a duplicate word in the input is added once",
    Object.keys(addToReview({}, [a, a], NOW)).length === 1,
  );

  // a stale record (day re-imported with another word under the same id) is replaced by a fresh one
  const stale: VocabMemory = { "d1-1": rec("OLD", 5, "2027-01-01") };
  const fixed = addToReview(stale, [a], NOW);
  check(
    "adding over a stale record (different Japanese) starts fresh",
    fixed["d1-1"]?.japanese === "日" && fixed["d1-1"]?.box === 1 && fixed["d1-1"]?.due === TODAY,
    JSON.stringify(fixed["d1-1"]),
  );
}

// ---- answering still creates a record (decision (b)) ----
{
  const w = word("d1-1", "日");
  const right = recordAnswer({}, w, true, NOW)["d1-1"] as WordMemory;
  check(
    "new word answered right -> box 2, due in 3 days",
    right.box === 2 && right.due === "2026-10-06",
  );
  const wrong = recordAnswer({}, w, false, NOW)["d1-1"] as WordMemory;
  check(
    "new word answered wrong -> box 1, due tomorrow (joins review)",
    wrong.box === 1 && wrong.due === "2026-10-04",
  );
  check(
    "added-then-answered-right the same day climbs one box (it is due)",
    applyAnswer(w, addToReview({}, [w], NOW)["d1-1"], true, NOW).box === 2,
  );
}

// ---- badge text ----
check("badgeText(0) = 0", badgeText(0) === "0");
check("badgeText(99) = 99", badgeText(99) === "99");
check("badgeText(100) = 99+", badgeText(100) === "99+");
check("badgeText(130) = 99+", badgeText(130) === "99+");

// ---- most overdue first ----
{
  const words = ["a", "b", "c", "d", "e", "f"].map((x) => word(`d1-${x.charCodeAt(0) - 96}`));
  const memory: VocabMemory = {
    "d1-1": rec("J-d1-1", 1, "2026-10-01"), // 2 days overdue
    "d1-2": rec("J-d1-2", 1, "2026-09-20"), // 13 days overdue (oldest)
    "d1-3": rec("J-d1-3", 1, "2026-10-03"), // due today
    "d1-4": rec("J-d1-4", 1, "2026-10-09"), // later: not due
    "d1-5": rec("J-d1-5", 1, "2026-10-01"), // 2 days overdue (tie with d1-1)
    // d1-6: no record: not in review
  };
  const ordered = dueWordsOverdueFirst(words, memory, TODAY).map((w) => w.id);
  check(
    "oldest due date first; not-due and untouched words left out",
    ordered[0] === "d1-2" && ordered[3] === "d1-3" && ordered.length === 4,
    JSON.stringify(ordered),
  );
  check(
    "the two tied words (2 days overdue) are in the middle",
    same([...ordered.slice(1, 3)].sort(), ["d1-1", "d1-5"]),
  );
  // ties really are random: with a rigged rng both orders show up
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) {
    const rng: Rng = () => Math.random();
    seen.add(
      dueWordsOverdueFirst(words, memory, TODAY, rng)
        .slice(1, 3)
        .map((w) => w.id)
        .join(","),
    );
  }
  check(
    "ties between equal due dates come in random order",
    seen.size === 2,
    [...seen].join(" | "),
  );
}

// ---- the Due round ----
{
  const words = Array.from({ length: 30 }, (_, i) => word(`d1-${i + 1}`));
  const memory: VocabMemory = {};
  // 15 due words with distinct due dates: d1-1 is the most overdue ... d1-15 the least
  for (let i = 1; i <= 15; i++)
    memory[`d1-${i}`] = rec(`J-d1-${i}`, 1, addDaysStr(TODAY, -(20 - i)));
  const round = buildDueRound(words, memory, TODAY, 10, words);
  check("a due round of 10 has 10 questions", round.length === 10);
  check(
    "a due round asks the 10 MOST overdue words, in that order",
    same(
      round.map((q) => q.word.id),
      Array.from({ length: 10 }, (_, i) => `d1-${i + 1}`),
    ),
    JSON.stringify(round.map((q) => q.word.id)),
  );
  check(
    "every question has 4 options",
    round.every((q) => q.options.length === 4),
  );
  const small: VocabMemory = { "d1-7": rec("J-d1-7", 1, TODAY), "d1-8": rec("J-d1-8", 1, TODAY) };
  const two = buildDueRound(words, small, TODAY, 10, words);
  check(
    "a 2-word due round still has 4 options (distractors from all words)",
    two.length === 2 && two.every((q) => q.options.length === 4),
  );
  check(
    "nothing in review -> an empty round",
    buildDueRound(words, {}, TODAY, 10, words).length === 0,
  );
  check(
    "length 'all' takes every due word",
    buildDueRound(words, memory, TODAY, "all", words).length === 15,
  );
}

function addDaysStr(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return localDay(new Date(y, m - 1, d + n));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
