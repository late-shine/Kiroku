/**
 * Phase 14b — no-browser checks for src/lib/word-memory.ts (Leitner boxes, due dates, mastery).
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14b-memory-check.ts
 * (Phase 14b-fix changed three cases: a word with no record is no longer due; see phase-14b-fix-check.ts.)
 * Exits non-zero if any case fails. Dates are built with local-time constructors, like the app does.
 */
import {
  BOX_GAPS,
  TOP_BOX,
  addDays,
  applyAnswer,
  countMastered,
  dueWords,
  isDue,
  isValidDay,
  localDay,
  masteryState,
  memoryFor,
  parseStoredMemory,
  pruneMemory,
  recordAnswer,
  type VocabMemory,
} from "../src/lib/word-memory";
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
  meaning: "m",
  day: 1,
});
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h, 0, 0);

// ---- calendar days ----
check("localDay formats local date", localDay(at(2026, 10, 3, 23)) === "2026-10-03");
check(
  "localDay just after midnight is still that local day",
  localDay(new Date(2026, 9, 3, 0, 5)) === "2026-10-03",
);
check("addDays +1", addDays("2026-10-03", 1) === "2026-10-04");
check("addDays across month end", addDays("2026-10-30", 3) === "2026-11-02");
check("addDays across year end", addDays("2026-12-31", 1) === "2027-01-01");
check(
  "addDays leap day (2028)",
  addDays("2028-02-28", 1) === "2028-02-29" && addDays("2027-02-28", 1) === "2027-03-01",
);
check("addDays 30 across a DST change window", addDays("2026-03-01", 30) === "2026-03-31");
check("addDays negative", addDays("2026-03-01", -1) === "2026-02-28");
check(
  "isValidDay rejects fake dates",
  !isValidDay("2026-02-30") &&
    !isValidDay("2026-13-01") &&
    !isValidDay("tomorrow") &&
    isValidDay("2026-02-28"),
);

// ---- isDue ----
// Phase 14b-fix (calm intake): a word with no record is NOT in review, so it is never due.
check("no record -> NOT due (calm intake)", !isDue(undefined, "2026-10-03"));
const rec = (box: number, due: string): WordMemory => ({
  japanese: "J-d1-1",
  box,
  due,
  right: 0,
  wrong: 0,
  lastAnswered: "2026-10-01T00:00:00.000Z",
});
check("due today -> due", isDue(rec(2, "2026-10-03"), "2026-10-03"));
check("overdue -> due", isDue(rec(2, "2026-09-01"), "2026-10-03"));
check("due tomorrow -> not due", !isDue(rec(2, "2026-10-04"), "2026-10-03"));

// ---- the ladder ----
{
  const w = word("d1-1");
  const day0 = at(2026, 10, 3);
  const first = applyAnswer(w, undefined, true, day0);
  check(
    "new word right -> box 2, due in 3 days",
    first.box === 2 && first.due === "2026-10-06" && first.right === 1 && first.wrong === 0,
    JSON.stringify(first),
  );
  const firstWrong = applyAnswer(w, undefined, false, day0);
  check(
    "new word wrong -> box 1, due tomorrow",
    firstWrong.box === 1 && firstWrong.due === "2026-10-04" && firstWrong.wrong === 1,
    JSON.stringify(firstWrong),
  );

  // climb the whole ladder, answering right on each due day
  let r: WordMemory | undefined;
  let now = day0;
  const boxes: number[] = [];
  const gaps: number[] = [];
  for (let i = 0; i < 6; i++) {
    r = applyAnswer(w, r, true, now);
    boxes.push(r.box);
    const [y, m, d] = r.due.split("-").map(Number) as [number, number, number];
    gaps.push(
      Math.round(
        (new Date(y, m - 1, d).getTime() -
          new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
          86400000,
      ),
    );
    now = new Date(y, m - 1, d, 12);
  }
  check("climbing: boxes 2,3,4,5,5,5", same(boxes, [2, 3, 4, 5, 5, 5]), JSON.stringify(boxes));
  check(
    "climbing: gaps are 3,7,14,30,30,30 days",
    same(gaps, [3, 7, 14, 30, 30, 30]),
    JSON.stringify(gaps),
  );
  check("BOX_GAPS / TOP_BOX as in the plan", same(BOX_GAPS, [1, 3, 7, 14, 30]) && TOP_BOX === 5);

  // wrong answer from a high box
  const high = rec(4, "2026-10-03");
  check("wrong in box 4 -> box 1 (reset)", applyAnswer(w, high, false, day0).box === 1);
  check(
    "wrong in box 4 with down-one -> box 3",
    applyAnswer(w, high, false, day0, "down-one").box === 3,
  );
  check(
    "down-one never goes below box 1",
    applyAnswer(w, rec(1, "2026-10-03"), false, day0, "down-one").box === 1,
  );

  // right answer on a word that is NOT due: counted, schedule untouched
  const notDue = { ...rec(3, "2026-10-10"), right: 5 };
  const again = applyAnswer(w, notDue, true, day0);
  check(
    "right on a not-due word keeps box and due date",
    again.box === 3 && again.due === "2026-10-10",
    JSON.stringify(again),
  );
  check(
    "...but still counts the right answer and the time",
    again.right === 6 && again.lastAnswered === day0.toISOString(),
  );
  // wrong answer on a not-due word still demotes
  check("wrong on a not-due word still resets it", applyAnswer(w, notDue, false, day0).box === 1);
  // miss then retry the same day: retry cannot climb back
  const missed = applyAnswer(w, rec(3, "2026-10-03"), false, day0);
  const retried = applyAnswer(w, missed, true, day0);
  check(
    "miss then right the same day: stays box 1, due tomorrow",
    retried.box === 1 && retried.due === "2026-10-04",
    JSON.stringify(retried),
  );
  // overdue right moves up from today, not from the old due date
  const overdue = applyAnswer(w, rec(2, "2026-09-01"), true, day0);
  check(
    "overdue right: box 3, due 7 days from TODAY",
    overdue.box === 3 && overdue.due === "2026-10-10",
    JSON.stringify(overdue),
  );
}

// ---- memoryFor / recordAnswer ----
{
  const w = word("d1-1", "日");
  const m0: VocabMemory = {};
  const m1 = recordAnswer(m0, w, true, at(2026, 10, 3));
  check(
    "recordAnswer returns a new object and leaves the input alone",
    m1 !== m0 && Object.keys(m0).length === 0 && m1["d1-1"]?.box === 2,
  );
  check("memoryFor finds the record for the same word", memoryFor(m1, w)?.box === 2);
  const replaced = word("d1-1", "月"); // the AI re-emitted Day 1 with a different word under the same id
  check(
    "memoryFor ignores a record written for a different word",
    memoryFor(m1, replaced) === undefined,
  );
  check(
    "a replaced word is not in review any more (not due)",
    !isDue(memoryFor(m1, replaced), "2026-10-03"),
  );
  const m2 = recordAnswer(m1, replaced, false, at(2026, 10, 3));
  check(
    "answering the replaced word starts a fresh record",
    m2["d1-1"]?.japanese === "月" &&
      m2["d1-1"]?.right === 0 &&
      m2["d1-1"]?.wrong === 1 &&
      m2["d1-1"]?.box === 1,
  );
  check(
    "other words' records are untouched",
    same(recordAnswer({ "d2-1": rec(2, "2026-10-09") }, w, true)["d2-1"], rec(2, "2026-10-09")),
  );
}

// ---- due list, mastery ----
{
  const words = [word("d1-1"), word("d1-2"), word("d1-3"), word("d1-4")];
  const memory: VocabMemory = {
    "d1-1": { ...rec(2, "2026-10-09"), japanese: "J-d1-1" }, // later
    "d1-2": { ...rec(5, "2026-10-03"), japanese: "J-d1-2" }, // due today, top box
    "d1-3": { ...rec(1, "2026-10-01"), japanese: "OTHER" }, // record for a different word
  };
  const due = dueWords(words, memory, "2026-10-03").map((w) => w.id);
  check(
    "dueWords: only the due-today record (no-record, mismatched and later words are not due)",
    same(due, ["d1-2"]),
    JSON.stringify(due),
  );
  check(
    "masteryState: starred wins",
    masteryState(words[1] as VocabWord, ["d1-2"], memory) === "starred",
  );
  check(
    "masteryState: top box = earned",
    masteryState(words[1] as VocabWord, [], memory) === "earned",
  );
  check("masteryState: otherwise none", masteryState(words[0] as VocabWord, [], memory) === "none");
  check(
    "masteryState: mismatched record is not earned",
    masteryState(word("d1-3"), [], { "d1-3": { ...rec(5, "2026-10-03"), japanese: "OTHER" } }) ===
      "none",
  );
  check(
    "countMastered = starred OR earned, no double count",
    countMastered(words, ["d1-2", "d1-4"], memory) === 2,
  );
  check(
    "countMastered ignores stale ids of deleted words",
    countMastered(words, ["d9-9", "d1-4"], memory) === 2 /* d1-2 earned + d1-4 */,
  );
  check("countMastered with nothing", countMastered(words, [], {}) === 0);
}

// ---- prune ----
{
  const memory: VocabMemory = {
    "d1-1": rec(1, "2026-10-03"),
    "d2-1": rec(1, "2026-10-03"),
    "d10-1": rec(1, "2026-10-03"),
  };
  const kept = pruneMemory(memory, (id) => !id.startsWith("d1-"));
  check("pruneMemory drops d1-* but not d10-*", same(Object.keys(kept).sort(), ["d10-1", "d2-1"]));
  check("pruneMemory leaves its input alone", Object.keys(memory).length === 3);
}

// ---- reading localStorage ----
{
  check(
    "parseStoredMemory: undefined / null / array / string -> {}",
    [undefined, null, [], "x", 5].every((v) => same(parseStoredMemory(v), {})),
  );
  const good = { "d1-1": rec(2, "2026-10-09") };
  check("parseStoredMemory keeps valid records", same(parseStoredMemory(good), good));
  const mixed = parseStoredMemory({
    "d1-1": rec(2, "2026-10-09"),
    "d1-2": { ...rec(2, "2026-10-09"), box: 9 },
    "d1-3": { ...rec(2, "2026-10-09"), due: "2026-02-30" },
    "d1-4": "junk",
    hello: rec(2, "2026-10-09"),
  });
  check(
    "parseStoredMemory drops only the bad entries",
    same(Object.keys(mixed), ["d1-1"]),
    JSON.stringify(Object.keys(mixed)),
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
