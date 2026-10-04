/**
 * Phase 14d — interaction checks for the harder question types in QuizView, driven in jsdom (no browser needed).
 * NOT part of the project's dependencies; install them temporarily without touching package.json:
 *   npm install --no-save --no-package-lock jsdom @testing-library/react @testing-library/dom
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14d-quiz-ui-check.tsx
 *
 * Covers: a "Due today" round that mixes the three kinds (plain, choose the word, type the reading); a kana-only
 * word in the top box falling back to "choose the word"; the typing box (attributes, focus, empty answer cannot be
 * checked); Enter during Japanese-keyboard conversion (isComposing, keyCode 229) NOT submitting and NOT being
 * cancelled; katakana typed for a hiragana reading; Enter after answering going to the next question, but not
 * when held down; a wrong typed answer showing what was typed next to the right reading; "I don't know" counting
 * as a miss; every answer updating the word's Leitner box; Retry missed keeping each word's question type; and the
 * practice scopes (This day) staying plain.
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
const { render, fireEvent, cleanup, act } = await import("@testing-library/react");
const { QuizView } = await import("../src/components/quiz/QuizView");

let failures = 0;
const check = (n: string, ok: boolean, d = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}${ok ? "" : "  -> " + d}`);
  if (!ok) failures++;
};

// d1-1..d1-5 are in review in different boxes; d1-6..d1-12 are plain lesson words (not in review).
const vocab = [
  { id: "d1-1", japanese: "水", reading: "みず", meaning: "Water" }, // box 1 -> plain
  { id: "d1-2", japanese: "火", reading: "ひ", meaning: "Fire" }, // box 3 -> choose the word
  { id: "d1-3", japanese: "川", reading: "かわ", meaning: "River" }, // box 4 -> type the reading
  { id: "d1-4", japanese: "先生", reading: "せんせい", meaning: "Teacher" }, // box 5 -> type the reading
  { id: "d1-5", japanese: "ありがとう", reading: "ありがとう", meaning: "Thank you" }, // box 5, kana-only -> choose
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `d1-${i + 6}`,
    japanese: `語${i + 6}`,
    reading: `ご${i + 6}`,
    meaning: `meaning-${i + 6}`,
  })),
].map((v) => ({ ...v, day: 1 }));
const lessons: any[] = [{ dayNumber: 1, vocab }];
// Due dates far in the past, one day apart, so the round order is fixed: d1-1 first ... d1-5 last.
const boxes = [1, 3, 4, 5, 5];
const memory: any = {};
vocab.slice(0, 5).forEach((v, i) => {
  memory[v.id] = {
    japanese: v.japanese,
    box: boxes[i],
    due: `2000-01-0${i + 1}`,
    right: 2,
    wrong: 1,
    lastAnswered: "2026-10-01T00:00:00.000Z",
  };
});
const empty: any = {
  completedDays: [],
  currentDay: 1,
  masteredVocabIds: [],
  weakVocabIds: [],
  vocabMemory: memory,
  totalQuizzesTaken: 0,
  totalCorrectAnswers: 0,
  backgroundIndex: 0,
  bgZoomSpeed: "slow",
  showFurigana: true,
};
let latest: any = empty;
function Harness({ initial, data = lessons }: { initial: any; data?: any[] }) {
  const [p, setP] = useState(initial);
  latest = p;
  return (
    <QuizView lessons={data} day={1} memory={p.vocabMemory} setProgress={setP} onBack={() => {}} />
  );
}

const text = (c: HTMLElement) => c.textContent ?? "";
const btn = (c: HTMLElement, re: RegExp) =>
  Array.from(c.querySelectorAll("button")).find((b) => re.test(b.textContent ?? "")) as
    | HTMLButtonElement
    | undefined;
const click = (b: HTMLElement | undefined) => {
  if (!b) throw new Error("button not found");
  fireEvent.click(b);
};
const options = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("div.grid button")) as HTMLButtonElement[];
const input = (c: HTMLElement) => c.querySelector("input") as HTMLInputElement | null;
const type = (c: HTMLElement, value: string) =>
  fireEvent.change(input(c) as HTMLInputElement, { target: { value } });
/** A real keydown for Enter, with the Japanese-keyboard flags a browser would set. Returns the event. */
function pressEnter(
  el: HTMLElement,
  flags: { isComposing?: boolean; keyCode?: number; repeat?: boolean } = {},
) {
  const ev = new dom.window.KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    isComposing: flags.isComposing ?? false,
    repeat: flags.repeat ?? false,
  });
  if (flags.keyCode !== undefined) Object.defineProperty(ev, "keyCode", { value: flags.keyCode });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
}
const next = (c: HTMLElement) => click(btn(c, /^(Next|Finish)$/));
const counter = (c: HTMLElement) => /Question (\d+) of (\d+)/.exec(text(c))?.[0] ?? "";
const KIND_CHOOSE = "Which word means this?";
const KIND_TYPE = "Type the reading in kana";

// ---- scenario 1: a Due round that mixes all three kinds ----
{
  const { container: c } = render(<Harness initial={empty} />);
  click(btn(c, /Due today/));
  check(
    "5 words in review are due -> 5 questions",
    /Question 1 of 5/.test(text(c)),
    text(c).slice(0, 160),
  );

  // Q1: 水, box 1 -> the plain question, exactly as before
  check(
    "Q1 is the plain question: Japanese word, reading, four meanings, no caption, no typing box",
    c.querySelector("p.text-5xl")?.textContent === "水" &&
      options(c).length === 4 &&
      input(c) === null &&
      !text(c).includes(KIND_CHOOSE) &&
      !text(c).includes(KIND_TYPE),
    text(c).slice(0, 200),
  );
  click(options(c).find((b) => b.textContent === "Water"));
  check(
    "Q1 right: box 1 -> 2",
    latest.vocabMemory["d1-1"].box === 2,
    JSON.stringify(latest.vocabMemory["d1-1"]),
  );
  next(c);

  // Q2: 火, box 3 -> choose the word
  check("Q2 counter", counter(c) === "Question 2 of 5", counter(c));
  check(
    "Q2 is 'choose the word': caption, the meaning as the prompt, four Japanese words, no typing box",
    text(c).includes(KIND_CHOOSE) &&
      c.querySelector("p.text-3xl")?.textContent === "Fire" &&
      options(c).length === 4 &&
      options(c).every((b) => b.querySelector("span")?.getAttribute("lang") === "ja") &&
      options(c).some((b) => b.textContent === "火") &&
      input(c) === null,
    text(c).slice(0, 240),
  );
  check(
    "Q2 options are all different Japanese text",
    new Set(options(c).map((b) => b.textContent)).size === 4,
  );
  const wrongOption = options(c).find((b) => b.textContent !== "火");
  click(wrongOption);
  check(
    "Q2 wrong pick: the right word is highlighted, the verdict and the reading are shown",
    options(c)
      .find((b) => b.textContent === "火")
      ?.className.includes("border-success") === true &&
      wrongOption?.className.includes("border-destructive") === true &&
      /Not quite/.test(text(c)) &&
      text(c).includes("火 · ひ"),
    text(c).slice(0, 300),
  );
  check("Q2 wrong: box 3 -> 1", latest.vocabMemory["d1-2"].box === 1);
  check("Q2 wrong: the word is now in weakVocabIds", latest.weakVocabIds.includes("d1-2"));
  next(c);

  // Q3: 川, box 4 -> type the reading
  check("Q3 counter", counter(c) === "Question 3 of 5", counter(c));
  const box = input(c);
  check(
    "Q3 is 'type the reading': caption, the word, its meaning as a hint, a typing box and no options",
    text(c).includes(KIND_TYPE) &&
      c.querySelector("p.text-5xl")?.textContent === "川" &&
      text(c).includes("River") &&
      box !== null &&
      options(c).length === 0,
    text(c).slice(0, 240),
  );
  check(
    "the typing box is set up for kana (lang=ja, no autocomplete / autocapitalise / spellcheck) and is focused",
    box?.getAttribute("lang") === "ja" &&
      box.getAttribute("autocomplete") === "off" &&
      box.getAttribute("autocapitalize") === "off" &&
      box.getAttribute("spellcheck") === "false" &&
      box.getAttribute("aria-label") === KIND_TYPE &&
      document.activeElement === box,
  );
  check(
    "nothing typed: Check is disabled, and Enter does nothing",
    btn(c, /^Check$/)?.disabled === true &&
      (pressEnter(box as HTMLElement), !/Correct|Not quite/.test(text(c))) &&
      latest.vocabMemory["d1-3"].box === 4,
  );
  check("'I don't know' is offered", !!btn(c, /I don't know/));
  check("'End round' is still there", !!btn(c, /End round/));

  // Japanese keyboard: the Enter that confirms a conversion must not submit
  type(c, "かわ");
  const composing = pressEnter(box as HTMLElement, { isComposing: true });
  check(
    "Enter while converting (isComposing) does not submit and is not cancelled",
    !/Correct|Not quite/.test(text(c)) &&
      !composing.defaultPrevented &&
      latest.vocabMemory["d1-3"].box === 4,
  );
  const safari = pressEnter(box as HTMLElement, { keyCode: 229 });
  check(
    "Enter with keyCode 229 (Safari) does not submit and is not cancelled",
    !/Correct|Not quite/.test(text(c)) &&
      !safari.defaultPrevented &&
      latest.vocabMemory["d1-3"].box === 4,
  );
  check(
    "the box still holds what was typed",
    input(c)?.value === "かわ" && input(c)?.readOnly === false,
  );

  // katakana for a hiragana reading is fine; a real Enter submits
  type(c, "カワ");
  const submit = pressEnter(box as HTMLElement, { keyCode: 13 });
  check(
    "a real Enter submits; katakana カワ is accepted for かわ",
    submit.defaultPrevented && /正解/.test(text(c)) && latest.vocabMemory["d1-3"].box === 5,
    text(c).slice(0, 240),
  );
  check(
    "after answering: the box is read-only, the reading is shown, Next is offered, 'I don't know' and Check are gone",
    input(c)?.readOnly === true &&
      text(c).includes("Reading") &&
      text(c).includes("かわ") &&
      !!btn(c, /^Next$/) &&
      !btn(c, /^Check$/) &&
      !btn(c, /I don't know/),
  );
  // a held-down Enter must not race through the next question; a fresh Enter goes on
  pressEnter(input(c) as HTMLElement, { repeat: true });
  check(
    "a held-down Enter does not go to the next question",
    counter(c) === "Question 3 of 5",
    counter(c),
  );
  pressEnter(input(c) as HTMLElement);
  check(
    "Enter after answering goes to the next question",
    counter(c) === "Question 4 of 5",
    counter(c),
  );

  // Q4: 先生, box 5 -> type the reading; a wrong (romaji) answer through the Check button
  check(
    "Q4 is 'type the reading' with a new, empty, focused box",
    c.querySelector("p.text-5xl")?.textContent === "先生" &&
      input(c)?.value === "" &&
      document.activeElement === input(c),
    text(c).slice(0, 200),
  );
  type(c, "sensei");
  check("Check is enabled once something is typed", btn(c, /^Check$/)?.disabled === false);
  click(btn(c, /^Check$/));
  check(
    "romaji is wrong: shows what was typed next to the right reading",
    text(c).includes("You typed") &&
      text(c).includes("sensei") &&
      text(c).includes("せんせい") &&
      /right reading is shown above/.test(text(c)),
    text(c).slice(0, 300),
  );
  check(
    "a wrong typed answer is an ordinary miss: box 5 -> 1, weak",
    latest.vocabMemory["d1-4"].box === 1 && latest.weakVocabIds.includes("d1-4"),
    JSON.stringify(latest.vocabMemory["d1-4"]),
  );
  next(c);

  // Q5: ありがとう, box 5 but kana-only -> choose the word instead of copying
  check("Q5 counter", counter(c) === "Question 5 of 5", counter(c));
  check(
    "Q5 is kana-only, so it is 'choose the word' (not typing it)",
    text(c).includes(KIND_CHOOSE) &&
      c.querySelector("p.text-3xl")?.textContent === "Thank you" &&
      input(c) === null &&
      options(c).some((b) => b.textContent === "ありがとう"),
    text(c).slice(0, 240),
  );
  click(options(c).find((b) => b.textContent === "ありがとう"));
  check("Q5 right: still box 5 (the top)", latest.vocabMemory["d1-5"].box === 5);
  check("the last question's button is Finish", !!btn(c, /^Finish$/));
  next(c);

  // summary: 3 right (Q1, Q3, Q5), 2 missed (火, 先生)
  check("summary 3 / 5", /3\s*\/\s*5/.test(text(c)), text(c).slice(0, 200));
  check(
    "the missed list has 火 and 先生 with their readings",
    /Missed\s*·\s*2/.test(text(c)) &&
      text(c).includes("火") &&
      text(c).includes("先生") &&
      text(c).includes("せんせい"),
  );
  check("5 answers counted", latest.totalQuizzesTaken === 5 && latest.totalCorrectAnswers === 3);

  // Retry missed: 火 is asked as choose the word, 先生 as type the reading
  click(btn(c, /Retry missed words \(2\)/));
  check(
    "retry round has 2 questions",
    /Retry/.test(text(c)) && /Question 1 of 2/.test(text(c)),
    text(c).slice(0, 160),
  );
  const kinds: string[] = [];
  for (let i = 0; i < 2; i++) {
    if (input(c)) {
      kinds.push("type");
      check("retried typed word: 先生", c.querySelector("p.text-5xl")?.textContent === "先生");
      click(btn(c, /I don't know/));
      check(
        "'I don't know': 'You skipped this one', the reading is shown, and it counts as a miss",
        text(c).includes("You skipped this one") &&
          text(c).includes("せんせい") &&
          /No problem/.test(text(c)) &&
          latest.vocabMemory["d1-4"].box === 1 &&
          latest.vocabMemory["d1-4"].wrong === 3,
        JSON.stringify(latest.vocabMemory["d1-4"]),
      );
    } else {
      kinds.push("choose");
      check("retried choose word: 火", c.querySelector("p.text-3xl")?.textContent === "Fire");
      click(options(c).find((b) => b.textContent === "火"));
    }
    next(c);
  }
  check(
    "retry kept each word's question type (one typed, one chosen)",
    kinds.slice().sort().join() === "choose,type",
    kinds.join(),
  );
  check("retry summary 1 / 2", /1\s*\/\s*2/.test(text(c)), text(c).slice(0, 160));
  cleanup();
}

// ---- scenario 2: practice scopes stay plain, whatever the boxes ----
{
  const { container: c } = render(<Harness initial={empty} />);
  click(btn(c, /^This day$/));
  let plain = true;
  for (let i = 0; i < 4; i++) {
    if (
      input(c) !== null ||
      options(c).length !== 4 ||
      text(c).includes(KIND_CHOOSE) ||
      text(c).includes(KIND_TYPE) ||
      !c.querySelector("p.text-5xl")
    )
      plain = false;
    click(options(c)[0]);
    next(c);
  }
  check("'This day': every question is the plain question (4 checked)", plain);
  click(btn(c, /^All days$/));
  check(
    "'All days': plain too",
    input(c) === null && options(c).length === 4 && !text(c).includes(KIND_CHOOSE),
  );
  cleanup();
}

// ---- scenario 3: a typed answer with half-width katakana and spaces ----
{
  const only: any = {
    ...empty,
    vocabMemory: { "d1-3": { ...memory["d1-3"], due: "2000-01-01" } },
  };
  const { container: c } = render(<Harness initial={only} />);
  click(btn(c, /Due today/));
  check(
    "one word in review -> a 1-question round, typed",
    /Question 1 of 1/.test(text(c)) && input(c) !== null,
  );
  type(c, "  ｶﾜ ");
  click(btn(c, /^Check$/));
  check("half-width katakana with spaces is accepted", /正解/.test(text(c)));
  cleanup();
}

// ---- scenario 4 (addendum): the Question style control. Each part renders fresh, because answering changes the records. ----
{
  // 4a: practice scope. 'Choose the word' means nothing can be typed (the answer for people with no Japanese keyboard).
  const { container: c } = render(<Harness initial={empty} />);
  const pressed = (re: RegExp) => btn(c, re)?.getAttribute("aria-pressed");
  check(
    "four style buttons, 'By progress' pressed by default",
    ["By progress", "Meaning", "Choose the word", "Type the reading"].every(
      (label) => !!btn(c, new RegExp(`^${label}$`)),
    ) && pressed(/^By progress$/) === "true",
  );
  click(btn(c, /^Choose the word$/));
  check(
    "choosing a style marks it pressed",
    pressed(/^Choose the word$/) === "true" && pressed(/^By progress$/) === "false",
  );
  let allChoose = true;
  for (let i = 0; i < 4; i++) {
    if (input(c) !== null || !text(c).includes(KIND_CHOOSE) || options(c).length !== 4)
      allChoose = false;
    click(options(c)[0]);
    next(c);
  }
  check(
    "'This day' + 'Choose the word': every question is choose the word, none can be typed (4 checked)",
    allChoose,
  );

  // 4a, continued: 'Type the reading' types what can be typed; kana-only and unusable readings become choose
  click(btn(c, /^Type the reading$/));
  check(
    "'Type the reading' explains the kana-only fallback",
    /Words written only in kana/.test(text(c)),
    text(c).slice(0, 300),
  );
  check(
    "changing the style started a fresh round",
    /Question 1 of 10/.test(text(c)),
    text(c).slice(0, 160),
  );
  let sawTyped = false;
  let badKind = false;
  for (let i = 0; i < 10; i++) {
    if (input(c) !== null) {
      sawTyped = true;
      click(btn(c, /I don't know/));
    } else if (text(c).includes(KIND_CHOOSE)) {
      click(options(c)[0]);
    } else badKind = true;
    next(c);
  }
  check(
    "'This day' + 'Type the reading': typed questions appear, nothing is the plain question",
    sawTyped && !badKind,
  );
  cleanup();
}
{
  // 4b: 'Meaning' in a Due round is plain for every word, even those in the higher boxes
  const { container: c } = render(<Harness initial={empty} />);
  click(btn(c, /Due today/));
  click(btn(c, /^Meaning$/));
  check("Due + 'Meaning': 5 questions", /Question 1 of 5/.test(text(c)), text(c).slice(0, 160));
  let plain = true;
  for (let i = 0; i < 5; i++) {
    if (input(c) !== null || text(c).includes(KIND_CHOOSE) || options(c).length !== 4)
      plain = false;
    click(options(c)[0]);
    next(c);
  }
  check("Due today + 'Meaning': all 5 questions are the plain question", plain);
  cleanup();
}
{
  // 4c: an answer in 'Choose the word' updates the box like any other (Due: 水 is box 1 and the most overdue)
  const { container: c } = render(<Harness initial={empty} />);
  click(btn(c, /Due today/));
  click(btn(c, /^Choose the word$/));
  check(
    "Due + 'Choose the word': Q1 is choose the word (the box 1 word too)",
    text(c).includes(KIND_CHOOSE) && c.querySelector("p.text-3xl")?.textContent === "Water",
    text(c).slice(0, 200),
  );
  click(options(c).find((b) => b.textContent === "水"));
  check(
    "a right 'choose' answer moves the box 1 word to box 2",
    latest.vocabMemory["d1-1"].box === 2,
    JSON.stringify(latest.vocabMemory["d1-1"]),
  );
  click(btn(c, /^By progress$/));
  check(
    "changing the style starts a fresh round",
    /Question 1 of/.test(text(c)) && !/Round complete/.test(text(c)),
  );
  cleanup();
}

// ---- scenario 5 (addendum): a word taught on two days is asked once ----
{
  const mk = (id: string, japanese: string, reading: string, meaning: string, day: number) => ({
    id,
    japanese,
    reading,
    meaning,
    day,
  });
  const twoDays: any[] = [
    {
      dayNumber: 1,
      vocab: [
        mk("d1-1", "本", "ほん", "Book", 1),
        mk("d1-2", "水", "みず", "Water", 1),
        mk("d1-3", "火", "ひ", "Fire", 1),
        mk("d1-4", "山", "やま", "Mountain", 1),
      ],
    },
    {
      dayNumber: 3,
      vocab: [
        mk("d3-1", "本", "ほん", "Book", 3),
        mk("d3-2", "水", "みず", "Water", 3),
        mk("d3-3", "川", "かわ", "River", 3),
      ],
    },
  ];
  // the Day 3 copy of 本 is the one in review (not due until far in the future)
  const seeded3: any = {
    ...empty,
    vocabMemory: {
      "d3-1": {
        japanese: "本",
        box: 2,
        due: "2999-01-01",
        right: 5,
        wrong: 0,
        lastAnswered: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const { container: c } = render(<Harness initial={seeded3} data={twoDays} />);
  click(btn(c, /^All days$/));
  check(
    "7 words on 2 days, 2 repeated -> 5 questions",
    /Question 1 of 5/.test(text(c)),
    text(c).slice(0, 160),
  );
  const asked: string[] = [];
  for (let i = 0; i < 5; i++) {
    const j = c.querySelector("p.text-5xl")?.textContent ?? "";
    asked.push(j);
    const meaning = twoDays.flatMap((l) => l.vocab).find((v: any) => v.japanese === j)?.meaning;
    click(options(c).find((b) => b.textContent === meaning)); // answer right
    next(c);
  }
  check(
    "every word was asked once (no 本 or 水 twice)",
    new Set(asked).size === 5 && asked.length === 5,
    asked.join(" "),
  );
  check(
    "the copy in review was the one asked: its record got the answer, the Day 1 copy got none",
    latest.vocabMemory["d3-1"]?.right === 6 && latest.vocabMemory["d1-1"] === undefined,
    JSON.stringify(latest.vocabMemory),
  );
  cleanup();
}

console.log(failures === 0 ? "\nAll UI checks passed." : `\n${failures} UI check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
