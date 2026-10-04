/**
 * Phase 14b (+ 14b-fix) — interaction checks for QuizView's "Due today" scope and the Vocab tab's "Add to
 * review" controls, driven in jsdom (no browser needed). Since 14b-fix a word is only due once it is IN REVIEW,
 * so the due-round scenarios start with the words added to review.
 * NOT part of the project's dependencies; install them temporarily without touching package.json:
 *   npm install --no-save --no-package-lock jsdom @testing-library/react @testing-library/dom
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14b-quiz-ui-check.tsx
 * Covers: due round keeps its size while answers move words out of "due"; due count updates; New round picks
 * up only what is still due; a 2-word due round still gets 4 options; nothing-due message; retry the same day
 * can't climb a box; right answer on a not-due word keeps its schedule; weakVocabIds rule from 14a unchanged.
 */
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement;
g.IS_REACT_ACT_ENVIRONMENT = true;
const React = (await import("react")).default;
const { useState } = React;
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { QuizView } = await import("../src/components/quiz/QuizView");
const { VocabList } = await import("../src/components/lesson/VocabList");
const { addToReview } = await import("../src/lib/word-memory");

let failures = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  -> " + d}`);
  if (!ok) failures++;
};

const vocab = Array.from({ length: 12 }, (_, i) => ({
  id: `d1-${i + 1}`,
  japanese: `語${i + 1}`,
  reading: `r${i + 1}`,
  meaning: `meaning-${i + 1}`,
  day: 1,
}));
const lessons: any[] = [{ dayNumber: 1, vocab }];
const empty: any = {
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
let latest: any = empty;
function Harness({ initial }: { initial: any }) {
  const [p, setP] = useState(initial);
  latest = p;
  return (
    <QuizView
      lessons={lessons}
      day={1}
      memory={p.vocabMemory}
      setProgress={setP}
      onBack={() => {}}
    />
  );
}
const text = (c: HTMLElement) => c.textContent ?? "";
const btn = (c: HTMLElement, re: RegExp) =>
  Array.from(c.querySelectorAll("button")).find((b) => re.test(b.textContent ?? "")) as
    HTMLButtonElement | undefined;
const click = (b: HTMLElement | undefined) => {
  if (!b) throw new Error("button not found");
  fireEvent.click(b);
};
const currentWord = (c: HTMLElement) =>
  vocab.find((v) => v.japanese === c.querySelector("p.text-5xl")?.textContent)!;
const answer = (c: HTMLElement, right: boolean) => {
  const w = currentWord(c);
  const opts = Array.from(c.querySelectorAll("div.grid button")) as HTMLButtonElement[];
  const target = opts.find((b) =>
    right ? b.textContent === w.meaning : b.textContent !== w.meaning,
  )!;
  click(target);
  return w;
};
const next = (c: HTMLElement) => click(btn(c, /^(Next|Finish)$/));

// ---- scenario 1: a full due round, all right ----
{
  // 14b-fix: the 12 words have been added to review (that is what makes them due)
  const added = { ...empty, vocabMemory: addToReview({}, vocab as any) };
  const { container: c } = render(<Harness initial={added} />);
  check("button shows 12 due (all added to review)", /Due today\s*·\s*12/.test(text(c)));
  click(btn(c, /Due today/));
  check(
    "due round has 10 questions (round length), not 12",
    /Question 1 of 10/.test(text(c)),
    text(c).slice(0, 200),
  );
  for (let i = 0; i < 10; i++) {
    answer(c, true);
    if (i === 2) {
      // memory has changed (3 words no longer due) — the running round must be untouched
      check(
        "mid-round: counter did not reset or shrink",
        /Question 3 of 10/.test(text(c)),
        text(c).slice(0, 120),
      );
    }
    next(c);
  }
  check("summary shows 10 / 10", /10\s*\/\s*10/.test(text(c)), text(c).slice(0, 200));
  const boxes = Object.values<any>(latest.vocabMemory).map((r) => r.box);
  check(
    "10 answered words are in box 2; the 2 unanswered ones stay in box 1 (added, not yet answered)",
    boxes.length === 12 &&
      boxes.filter((b) => b === 2).length === 10 &&
      boxes.filter((b) => b === 1).length === 2,
    JSON.stringify(boxes),
  );
  check("button now shows 2 due", /Due today\s*·\s*2/.test(text(c)), text(c).slice(0, 200));
  click(btn(c, /New round/));
  check(
    "new round = only the 2 still-due words",
    /Question 1 of 2/.test(text(c)),
    text(c).slice(0, 200),
  );
  const opts = c.querySelectorAll("div.grid button").length;
  check(
    "a 2-word due round still has 4 options (distractors from all words)",
    opts === 4,
    String(opts),
  );
  answer(c, false);
  next(c); // one wrong
  answer(c, true);
  next(c);
  check("summary 1 / 2 with a missed word", /1\s*\/\s*2/.test(text(c)) && /Missed/.test(text(c)));
  const weak = latest.weakVocabIds.length;
  check("the miss is also in weakVocabIds (14a rule kept)", weak === 1, String(weak));
  const missedId = latest.weakVocabIds[0];
  check(
    "missed word is box 1, due tomorrow",
    latest.vocabMemory[missedId].box === 1 && latest.vocabMemory[missedId].wrong === 1,
  );
  click(btn(c, /Retry missed/));
  check(
    "retry round has the 1 missed word and 4 options",
    /Retry/.test(text(c)) && c.querySelectorAll("div.grid button").length === 4,
  );
  answer(c, true);
  next(c);
  check(
    "retry right the same day does NOT move the word up",
    latest.vocabMemory[missedId].box === 1,
    JSON.stringify(latest.vocabMemory[missedId]),
  );
  check("...but it leaves weakVocabIds (14a rule kept)", latest.weakVocabIds.length === 0);
  cleanup();
}

// ---- scenario 2: nothing due -> message, not a broken screen ----
{
  const memory: any = {};
  for (const v of vocab)
    memory[v.id] = {
      japanese: v.japanese,
      box: 3,
      due: "2999-01-01",
      right: 2,
      wrong: 0,
      lastAnswered: "2026-10-01T00:00:00.000Z",
    };
  const { container: c } = render(<Harness initial={{ ...empty, vocabMemory: memory }} />);
  check("nothing due: button shows 0", /Due today\s*·\s*0/.test(text(c)));
  click(btn(c, /Due today/));
  check(
    "nothing due: friendly message, no End round",
    /Nothing is due today/.test(text(c)) && !/End round/.test(text(c)),
  );
  click(btn(c, /^This day$/));
  check("other scopes still work with nothing due", /Question 1 of 10/.test(text(c)));
  // a right answer on a NOT-due word keeps its schedule
  const w = answer(c, true);
  const r = latest.vocabMemory[w.id];
  check(
    "right on a not-due word: box 3 and due date unchanged, right +1",
    r.box === 3 && r.due === "2999-01-01" && r.right === 3,
    JSON.stringify(r),
  );
  cleanup();
}

// ---- scenario 2b (14b-fix): untouched words are not due, and the message says how to add them ----
{
  const { container: c } = render(<Harness initial={empty} />);
  check(
    "untouched words: button shows 0, not 12",
    /Due today\s*·\s*0/.test(text(c)),
    text(c).slice(0, 160),
  );
  click(btn(c, /Due today/));
  check(
    "untouched words: 'Nothing due. Add words from a lesson' and no End round",
    /Nothing due\. Add words from a lesson/.test(text(c)) && !/End round/.test(text(c)),
    text(c).slice(0, 260),
  );
  cleanup();
}

// ---- scenario 3: an ordinary scope answer creates a record ----
{
  const { container: c } = render(<Harness initial={empty} />);
  const w = answer(c, true);
  const r = latest.vocabMemory[w.id];
  check(
    "'This day' answer on a new word creates a box-2 record",
    r?.box === 2 && r.japanese === w.japanese && r.right === 1,
    JSON.stringify(r),
  );
  check("totalQuizzesTaken still +1 per answer", latest.totalQuizzesTaken === 1);
  cleanup();
}

// ---- scenario 4 (14b-fix): the Vocab tab's Add to review controls ----
{
  function VocabHarness({ initial }: { initial: any }) {
    const [p, setP] = useState(initial);
    latest = p;
    return <VocabList lesson={lessons[0]} progress={p} setProgress={setP} showReading={true} />;
  }
  const inReview = () => Object.keys(latest.vocabMemory).length;

  // whole day
  const { container: c } = render(<VocabHarness initial={empty} />);
  check(
    "vocab tab offers the day button with the count",
    !!btn(c, /Add this day's words to review \(12\)/),
  );
  check(
    "every untouched word has its own add button",
    c.querySelectorAll('button[title="Add to review"]').length === 12,
  );
  click(btn(c, /Add this day's words to review/));
  check(
    "day button adds all 12 words in box 1, due today",
    inReview() === 12 &&
      Object.values<any>(latest.vocabMemory).every(
        (r) => r.box === 1 && r.right === 0 && r.wrong === 0,
      ),
  );
  check(
    "then the button is replaced by 'All of this day's words are in review.'",
    /All of this day's words are in review\./.test(text(c)) && !btn(c, /Add this day's words/),
  );
  check(
    "and every word shows the in-review mark instead of the add button",
    c.querySelectorAll('[aria-label="In review"]').length === 12 &&
      c.querySelectorAll('button[title="Add to review"]').length === 0,
  );
  cleanup();

  // one word
  const r2 = render(<VocabHarness initial={empty} />);
  click(r2.container.querySelector('button[title="Add to review"]') as HTMLElement);
  check("per-word add creates exactly one record", inReview() === 1);
  check(
    "the day button count drops to 11",
    !!btn(r2.container, /Add this day's words to review \(11\)/),
  );
  cleanup();

  // existing progress is never reset
  const seeded = {
    ...empty,
    vocabMemory: {
      "d1-3": {
        japanese: "語3",
        box: 4,
        due: "2999-01-01",
        right: 7,
        wrong: 1,
        lastAnswered: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const r3 = render(<VocabHarness initial={seeded} />);
  click(btn(r3.container, /Add this day's words to review \(11\)/));
  check(
    "adding the day keeps an existing record exactly (box 4, 7 right)",
    latest.vocabMemory["d1-3"].box === 4 &&
      latest.vocabMemory["d1-3"].right === 7 &&
      inReview() === 12,
  );
  cleanup();

  // star still works and is separate
  const r4 = render(<VocabHarness initial={empty} />);
  click(r4.container.querySelector('button[aria-label="Toggle mastery"]') as HTMLElement);
  check(
    "the star still toggles mastery and does NOT add to review",
    latest.masteredVocabIds.length === 1 && inReview() === 0,
  );
  cleanup();
}

console.log(failures === 0 ? "\nAll UI checks passed." : `\n${failures} UI check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
