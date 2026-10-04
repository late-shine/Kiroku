/**
 * Phase 14a — no-browser checks for the pure round helpers in src/components/quiz/round.ts.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14a-quiz-check.ts
 * (Lives in handoffs/, outside tsconfig's `include`.) Exits non-zero if any case fails.
 */
import {
  buildOptions,
  buildRetryRound,
  buildRound,
  missedWords,
  scoreRound,
  shuffle,
  uniqueById,
  updateWeakIds,
  type RoundAnswers,
  type RoundQuestion,
} from "../src/components/quiz/round";
import type { VocabWord } from "../src/types/japanese";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// small seeded generator so the cases are repeatable
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const word = (id: string, meaning: string): VocabWord => ({
  id,
  japanese: `J-${id}`,
  reading: `r-${id}`,
  meaning,
  day: 1,
});
const makePool = (n: number): VocabWord[] =>
  Array.from({ length: n }, (_, i) => word(`d1-${i + 1}`, `meaning ${i + 1}`));
const ids = (qs: RoundQuestion[]) => qs.map((q) => q.word.id);

// ---- shuffle ----
{
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = [...input];
  const out = shuffle(input, seeded(1));
  check("shuffle does not change its input", same(input, copy));
  check("shuffle keeps every item exactly once", same([...out].sort(), copy));
  check("shuffle of [] is []", same(shuffle([], seeded(1)), []));
}

// ---- empty pool ----
check("empty pool -> empty round (10)", buildRound([], 10).length === 0);
check("empty pool -> empty round (all)", buildRound([], "all").length === 0);
check("empty retry -> empty round", buildRetryRound([], makePool(5)).length === 0);

// ---- round length ----
{
  const pool = makePool(30);
  check("length 10 of 30 -> 10 questions", buildRound(pool, 10, seeded(2)).length === 10);
  check("length 20 of 30 -> 20 questions", buildRound(pool, 20, seeded(3)).length === 20);
  check('length "all" of 30 -> 30 questions', buildRound(pool, "all", seeded(4)).length === 30);
  const r = buildRound(pool, 10, seeded(5));
  check("each word asked once in a round", new Set(ids(r)).size === r.length);
  check(
    "round words all come from the pool",
    ids(r).every((id) => pool.some((w) => w.id === id)),
  );
}

// ---- pool smaller than the round length ----
{
  const pool = makePool(4);
  const r = buildRound(pool, 10, seeded(6));
  check("pool of 4, length 10 -> 4 questions", r.length === 4);
  check(
    "pool of 4, every word asked once",
    same(
      [...ids(r)].sort(),
      ids(pool.map((w) => ({ word: w, kind: "recognise" as const, options: [] }))),
    ),
  );
  check("pool of 1 -> 1 question", buildRound(makePool(1), 20, seeded(7)).length === 1);
  check(
    "pool of 1: its only option is the right answer",
    same(buildRound(makePool(1), 20, seeded(7))[0]?.options, ["meaning 1"]),
  );
}

// ---- duplicate ids / duplicate meanings ----
{
  const dupIds = [word("d1-1", "a"), word("d1-1", "a"), word("d1-2", "b")];
  check("uniqueById drops a repeated id", uniqueById(dupIds).length === 2);
  check("a repeated id is asked once", buildRound(dupIds, "all", seeded(8)).length === 2);

  // many words share the same meaning: options must still be unique, and exactly one must be right
  const shared = [
    word("d1-1", "to eat"),
    word("d1-2", "to eat"),
    word("d1-3", "to eat"),
    word("d1-4", "to drink"),
    word("d1-5", "to drink"),
    word("d1-6", "water"),
    word("d1-7", "tea"),
  ];
  let allUnique = true;
  let oneCorrect = true;
  let fourOptions = true;
  for (let seed = 1; seed <= 50; seed++) {
    for (const q of buildRound(shared, "all", seeded(seed))) {
      if (new Set(q.options).size !== q.options.length) allUnique = false;
      if (q.options.filter((o) => o === q.word.meaning).length !== 1) oneCorrect = false;
      if (q.options.length !== 4) fourOptions = false;
    }
  }
  check("shared meanings: every option list is unique (50 seeds)", allUnique);
  check("shared meanings: exactly one option equals the right meaning", oneCorrect);
  check("shared meanings: 4 distinct meanings exist, so 4 options", fourOptions);

  // everything has the same meaning -> only the one correct option, no duplicates
  const allSame = [word("d1-1", "x"), word("d1-2", "x"), word("d1-3", "x")];
  check(
    "all-same-meaning pool -> a single option",
    same(buildOptions(allSame[0] as VocabWord, allSame, seeded(9)), ["x"]),
  );

  // wrong options never include the right text, and there are at most 3
  const pool = makePool(12);
  const opts = buildOptions(pool[0] as VocabWord, pool, seeded(10));
  check("at most 4 options", opts.length === 4);
  check("right answer is among the options", opts.includes("meaning 1"));
}

// ---- distractors (Phase 14b: "Due today" rounds draw wrong options from every word) ----
{
  const all = makePool(12);
  const few = all.slice(0, 2);
  const r = buildRound(few, "all", seeded(21), all);
  check("2-word round with a wider distractor pool: 2 questions", r.length === 2);
  check(
    "...each still has 4 options incl. the right one",
    r.every((q) => q.options.length === 4 && q.options.includes(q.word.meaning)),
  );
  check(
    "...and asks only the 2 words, not the distractor words",
    same([...ids(r)].sort(), ["d1-1", "d1-2"]),
  );
  check(
    "without distractors the old behaviour holds (2 words -> 2 options)",
    buildRound(few, "all", seeded(22)).every((q) => q.options.length === 2),
  );
}

// ---- scoring, misses, retry ----
{
  const pool = makePool(6);
  const round = buildRound(pool, "all", seeded(11));
  const answers: RoundAnswers = {};
  // answer 4 of 6: first 2 right, next 2 wrong; last 2 unanswered
  round.forEach((q, i) => {
    if (i < 2) answers[q.word.id] = q.word.meaning;
    else if (i < 4) answers[q.word.id] = "something else";
  });
  const score = scoreRound(round, answers);
  check("score counts right answers", score.correct === 2, JSON.stringify(score));
  check("score counts only answered questions", score.answered === 4, JSON.stringify(score));
  check("score total is the round size", score.total === 6, JSON.stringify(score));
  const missed = missedWords(round, answers);
  check(
    "missed = the 2 wrong ones",
    same(
      missed.map((w) => w.id),
      ids(round.slice(2, 4)),
    ),
  );
  check(
    "unanswered words are not misses",
    missed.every((m) => answers[m.id] !== undefined),
  );

  const retry = buildRetryRound(missed, pool, seeded(12));
  check(
    "retry round has exactly the missed words",
    same([...ids(retry)].sort(), missed.map((w) => w.id).sort()),
  );
  check(
    "retry questions still have 4 options (distractors from the full pool)",
    retry.every((q) => q.options.length === 4),
  );
  check(
    "retry questions contain their right answer",
    retry.every((q) => q.options.includes(q.word.meaning)),
  );

  // a perfect round has no misses
  const perfect: RoundAnswers = {};
  for (const q of round) perfect[q.word.id] = q.word.meaning;
  check("perfect round: nothing missed", missedWords(round, perfect).length === 0);
  check(
    "perfect round: score 6/6",
    same(scoreRound(round, perfect), { correct: 6, answered: 6, total: 6 }),
  );

  // nothing answered
  check(
    "nothing answered: 0/0 of 6",
    same(scoreRound(round, {}), { correct: 0, answered: 0, total: 6 }),
  );
  check("nothing answered: nothing missed", missedWords(round, {}).length === 0);

  // retry of a retry
  const retryAnswers: RoundAnswers = {};
  retry.forEach((q, i) => (retryAnswers[q.word.id] = i === 0 ? q.word.meaning : "nope"));
  check(
    "second-level retry has only the still-missed word(s)",
    missedWords(retry, retryAnswers).length === retry.length - 1,
  );
}

// ---- weakVocabIds updates ----
{
  const w0: string[] = ["d1-1", "d2-3"];
  check("a miss adds the id", same(updateWeakIds(w0, "d1-9", false), ["d1-1", "d2-3", "d1-9"]));
  check(
    "a miss on an already-weak id does not duplicate it",
    same(updateWeakIds(w0, "d1-1", false), ["d1-1", "d2-3"]),
  );
  check("a right answer removes the id", same(updateWeakIds(w0, "d1-1", true), ["d2-3"]));
  check(
    "a right answer on a non-weak id changes nothing",
    same(updateWeakIds(w0, "d9-9", true), w0),
  );
  check(
    "unchanged -> same array object (no re-render)",
    updateWeakIds(w0, "d9-9", true) === w0 && updateWeakIds(w0, "d1-1", false) === w0,
  );
  check("input array is never mutated", same(w0, ["d1-1", "d2-3"]));
  check(
    "works on an empty list",
    same(updateWeakIds([], "d1-1", false), ["d1-1"]) && same(updateWeakIds([], "d1-1", true), []),
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
