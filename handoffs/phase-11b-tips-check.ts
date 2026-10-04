/**
 * Phase 11b — no-browser checks for the pure tip helpers in src/components/tips/tips.ts.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-11b-tips-check.ts
 * (Lives in handoffs/, outside tsconfig's `include`.) Exits non-zero if any case fails.
 */
import {
  TIP_COPY,
  TIP_IDS,
  parseDismissed,
  serializeDismissed,
  withDismissed,
} from "../src/components/tips/tips";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// reading: nothing stored / unreadable / odd shapes all mean "nothing dismissed", and never throw
for (const [label, raw] of [
  ["null", null],
  ["empty string", ""],
  ["not JSON", "{{nope"],
  ["JSON null", "null"],
  ["a number", "7"],
  ["an array", '["studio"]'],
  ["no dismissed key", "{}"],
  ["dismissed not a list", '{"dismissed":"studio"}'],
] as const) {
  let out: unknown,
    threw = false;
  try {
    out = parseDismissed(raw);
  } catch {
    threw = true;
  }
  check(`reads ${label} as nothing dismissed`, !threw && same(out, []), JSON.stringify(out));
}

// reading: valid data survives, unknown ids and non-strings are dropped, order follows TIP_IDS
check(
  "keeps known ids",
  same(parseDismissed('{"dismissed":["quiz","studio"]}'), ["studio", "quiz"]),
);
check(
  "drops unknown ids and non-strings",
  same(parseDismissed('{"dismissed":["quiz","bogus",3,null]}'), ["quiz"]),
);

// writing round trip, dismiss and reset
check(
  "serialize then parse round-trips",
  same(parseDismissed(serializeDismissed(["progress", "atmosphere"])), ["progress", "atmosphere"]),
);
check("withDismissed adds an id", same(withDismissed(["quiz"], "studio"), ["quiz", "studio"]));
check("withDismissed does not duplicate", same(withDismissed(["quiz"], "quiz"), ["quiz"]));
check(
  "withDismissed does not mutate its input",
  (() => {
    const a = ["quiz"] as const;
    withDismissed(a, "studio");
    return a.length === 1;
  })(),
);
check(
  "show tips again = empty list stores and reads back empty",
  same(parseDismissed(serializeDismissed([])), []),
);

// copy: every id has a title and a body
check(
  "every tip id has copy",
  TIP_IDS.every((id) => TIP_COPY[id].title.length > 0 && TIP_COPY[id].body.length > 0),
);
check(
  "exactly the four agreed ids",
  same([...TIP_IDS], ["studio", "quiz", "progress", "atmosphere"]),
);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
