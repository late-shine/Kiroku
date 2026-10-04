/**
 * Phase 14d — no-browser checks for the harder question types: the typed-reading rules in
 * src/components/quiz/typed-answer.ts and the question kinds in src/components/quiz/round.ts.
 * Run from the project root:  npx tsx --tsconfig tsconfig.json handoffs/phase-14d-quiz-check.ts
 * (Lives in handoffs/, outside tsconfig's `include`.) Exits non-zero if any case fails.
 *
 * Covers: kana normalisation (NFKC, spaces, katakana -> hiragana, long vowel mark, half-width forms), words with
 * several readings, romaji never accepted, kana-only words falling back to "choose the word", the box -> kind
 * mapping, "choose the word" options (all different Japanese text, exactly one right, no second right answer),
 * the Due round mixing kinds while practice rounds stay plain, mixed scoring / "I don't know" / retry, the
 * answer feeding the Leitner box, and the Enter rule for Japanese keyboards (the jsdom script checks the real input).
 */
import {
  DEFAULT_QUESTION_STYLE,
  DONT_KNOW,
  QUESTION_STYLES,
  answerIsCorrect,
  buildChooseOptions,
  buildDueRound,
  buildOptions,
  buildRetryRound,
  buildRound,
  correctAnswer,
  dueWordsOverdueFirst,
  isCorrect,
  kindForBox,
  kindForStyle,
  kindForWord,
  kindsById,
  missedWords,
  scoreRound,
  uniqueWords,
  type RoundAnswers,
  type RoundQuestion,
} from "../src/components/quiz/round";
import {
  canTypeReading,
  isReadingCorrect,
  isSubmitKey,
  normalizeReading,
  readingAnswers,
} from "../src/components/quiz/typed-answer";
import { recordAnswer, type VocabMemory } from "../src/lib/word-memory";
import type { VocabWord, WordMemory } from "../src/types/japanese";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
  if (!ok) failures++;
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const word = (id: string, japanese: string, reading: string, meaning: string): VocabWord => ({
  id,
  japanese,
  reading,
  meaning,
  day: 1,
});
const TODAY = "2026-10-03";
const NOW = new Date(2026, 9, 3, 12, 0, 0);
const rec = (japanese: string, box: number, due: string): WordMemory => ({
  japanese,
  box,
  due,
  right: 2,
  wrong: 1,
  lastAnswered: "2026-10-01T10:00:00.000Z",
});

// ---- normalisation ----
{
  check("half-width katakana matches", normalizeReading("ｶﾀｶﾅ") === "かたかな");
  check("katakana matches", normalizeReading("カタカナ") === "かたかな");
  check("hiragana is left alone", normalizeReading("かたかな") === "かたかな");
  check(
    "spaces (normal and full-width) are ignored",
    normalizeReading(" か　た かな ") === "かたかな",
  );
  check("half-width dakuten is composed", normalizeReading("ｶﾞｯｺｳ") === "がっこう");
  check("a combining dakuten is composed", normalizeReading("が") === "が");
  check("the long vowel mark is kept", normalizeReading("ラーメン") === "らーめん");
  check("half-width long vowel mark is kept", normalizeReading("ﾗｰﾒﾝ") === "らーめん");
  check("punctuation and wave dashes are dropped", normalizeReading("〜さん。") === "さん");
  check("romaji is not converted to kana", normalizeReading("Sensei") === "Sensei");
  check(
    "nothing typed stays empty",
    normalizeReading("") === "" && normalizeReading(" 。 ") === "",
  );
}

// ---- stored readings: one, several, unusable ----
{
  check("one reading", same(readingAnswers("せんせい"), ["せんせい"]));
  check("a slash separates readings", same(readingAnswers("わたし/あたし"), ["わたし", "あたし"]));
  check(
    "a full-width slash separates readings",
    same(readingAnswers("わたし／あたし"), ["わたし", "あたし"]),
  );
  check(
    "a Japanese comma separates readings",
    same(readingAnswers("かた、うで"), ["かた", "うで"]),
  );
  check(
    "a comma and a semicolon separate readings",
    same(readingAnswers("かた,うで;て"), ["かた", "うで", "て"]),
  );
  check(
    "a middle dot separates readings AND the dot-less whole is accepted",
    same(readingAnswers("かた・うで"), ["かた", "うで", "かたうで"]),
  );
  check(
    "a katakana name with a middle dot accepts the whole name",
    readingAnswers("ジョン・スミス").includes("じょんすみす"),
  );
  check("a note in brackets is ignored", same(readingAnswers("たべる (to eat)"), ["たべる"]));
  check("a reading with kanji in it cannot be asked", readingAnswers("食べる").length === 0);
  check("a romaji reading cannot be asked", readingAnswers("taberu").length === 0);
  check("an empty reading cannot be asked", readingAnswers("").length === 0);
  check(
    "one unusable alternative is dropped, the usable one stays",
    same(readingAnswers("たべる/taberu"), ["たべる"]),
  );
}

// ---- checking a typed answer ----
{
  check("exact reading", isReadingCorrect("せんせい", "せんせい"));
  check("katakana for hiragana", isReadingCorrect("せんせい", "センセイ"));
  check("half-width katakana", isReadingCorrect("かたかな", "ｶﾀｶﾅ"));
  check("hiragana for a katakana reading", isReadingCorrect("コーヒー", "こーひー"));
  check("katakana typed for a katakana reading", isReadingCorrect("コーヒー", "コーヒー"));
  check(
    "any one of several readings",
    isReadingCorrect("わたし/あたし", "あたし") && isReadingCorrect("わたし/あたし", "わたし"),
  );
  check("surrounding spaces are fine", isReadingCorrect("せんせい", " せんせい "));
  check("romaji is rejected", !isReadingCorrect("せんせい", "sensei"));
  check(
    "empty and spaces are rejected",
    !isReadingCorrect("せんせい", "") && !isReadingCorrect("せんせい", "  "),
  );
  check("a wrong reading is rejected", !isReadingCorrect("せんせい", "がくせい"));
  check("part of a reading is rejected", !isReadingCorrect("せんせい", "せんせ"));
  check("the written form is not a reading", !isReadingCorrect("せんせい", "先生"));
  check("an unusable stored reading accepts nothing", !isReadingCorrect("sensei", "sensei"));
}

// ---- which words can be typed ----
{
  check("a kanji word can be typed", canTypeReading({ japanese: "先生", reading: "せんせい" }));
  check(
    "a kanji + kana word can be typed",
    canTypeReading({ japanese: "食べる", reading: "たべる" }),
  );
  check(
    "a kana-only word is just copying",
    !canTypeReading({ japanese: "ありがとう", reading: "ありがとう" }),
  );
  check(
    "ノート with the reading のーと is just copying",
    !canTypeReading({ japanese: "ノート", reading: "のーと" }),
  );
  check(
    "ノート with the reading ノート is just copying",
    !canTypeReading({ japanese: "ノート", reading: "ノート" }),
  );
  check(
    "a romaji reading cannot be typed",
    !canTypeReading({ japanese: "先生", reading: "sensei" }),
  );
  check("an empty reading cannot be typed", !canTypeReading({ japanese: "先生", reading: "" }));
}

// ---- the Enter key on a Japanese keyboard ----
{
  check("plain Enter submits", isSubmitKey({ key: "Enter" }));
  check("Enter with keyCode 13 submits", isSubmitKey({ key: "Enter", keyCode: 13 }));
  check(
    "Enter while converting (isComposing) does NOT submit",
    !isSubmitKey({ key: "Enter", isComposing: true }),
  );
  check(
    "Enter with keyCode 229 (Safari, just after converting) does NOT submit",
    !isSubmitKey({ key: "Enter", keyCode: 229 }),
  );
  check("a held-down Enter does NOT submit", !isSubmitKey({ key: "Enter", repeat: true }));
  check("other keys do not submit", !isSubmitKey({ key: "a" }) && !isSubmitKey({ key: " " }));
}

// ---- box -> kind ----
{
  check(
    "box 1 and 2 are the plain question",
    kindForBox(1) === "recognise" && kindForBox(2) === "recognise",
  );
  check("box 3 is choose the word", kindForBox(3) === "choose");
  check("box 4 and 5 are type the reading", kindForBox(4) === "type" && kindForBox(5) === "type");
  const sensei = word("d1-1", "先生", "せんせい", "Teacher");
  const arigatou = word("d1-2", "ありがとう", "ありがとう", "Thank you");
  const odd = word("d1-3", "先生", "sensei", "Teacher");
  check("no record keeps the plain question", kindForWord(sensei, undefined) === "recognise");
  check("a box 5 kanji word is typed", kindForWord(sensei, rec("先生", 5, TODAY)) === "type");
  check(
    "a box 5 kana-only word is choose instead",
    kindForWord(arigatou, rec("ありがとう", 5, TODAY)) === "choose",
  );
  check(
    "a box 4 word with an unusable reading is choose instead",
    kindForWord(odd, rec("先生", 4, TODAY)) === "choose",
  );
  check(
    "a kana-only word in box 2 stays plain",
    kindForWord(arigatou, rec("ありがとう", 2, TODAY)) === "recognise",
  );
}

// ---- "choose the word" options ----
{
  const pool: VocabWord[] = [
    word("d1-1", "水", "みず", "Water"),
    word("d1-2", "火", "ひ", "Fire"),
    word("d1-3", "山", "やま", "Mountain"),
    word("d1-4", "川", "かわ", "River"),
    word("d1-5", "花", "はな", "Flower"),
    word("d2-1", "水", "みず", "Water"), // the same word taught again on another day, another id
    word("d2-2", "お水", "おみず", "Water"), // a different word with the same meaning
  ];
  let unique = true;
  let oneRight = true;
  let four = true;
  let noSecondRight = true;
  for (let seed = 1; seed <= 50; seed++) {
    for (const w of pool) {
      const opts = buildChooseOptions(w, pool, seeded(seed));
      if (new Set(opts).size !== opts.length) unique = false;
      if (opts.filter((o) => o === w.japanese).length !== 1) oneRight = false;
      if (opts.length !== 4) four = false;
      // no other word with the same meaning may be on screen as a wrong option
      const sameMeaning = pool.filter((x) => x.meaning === w.meaning).map((x) => x.japanese);
      if (opts.some((o) => o !== w.japanese && sameMeaning.includes(o))) noSecondRight = false;
    }
  }
  check("every option is a different Japanese text (50 seeds)", unique);
  check("exactly one option is the asked word", oneRight);
  check("four options when enough different words exist", four);
  check("a word with the same meaning is never a wrong option", noSecondRight);
  const tiny = [word("d1-1", "水", "みず", "Water")];
  check(
    "a pool of one gives just the right option",
    same(buildChooseOptions(tiny[0] as VocabWord, tiny, seeded(1)), ["水"]),
  );
  const opts = buildChooseOptions(pool[0] as VocabWord, pool, seeded(9));
  check(
    "wrong options come from the pool",
    opts.every((o) => pool.some((w) => w.japanese === o)),
  );
}

// ---- the Due round mixes kinds; practice rounds stay plain ----
const dueWords: VocabWord[] = [
  word("d1-1", "水", "みず", "Water"), // box 1
  word("d1-2", "山", "やま", "Mountain"), // box 2
  word("d1-3", "火", "ひ", "Fire"), // box 3
  word("d1-4", "川", "かわ", "River"), // box 4
  word("d1-5", "花", "はな", "Flower"), // box 5
  word("d1-6", "ありがとう", "ありがとう", "Thank you"), // box 5, kana-only
  word("d1-7", "先生", "sensei", "Teacher"), // box 4, unusable reading
];
const others: VocabWord[] = Array.from({ length: 8 }, (_, i) =>
  word(`d2-${i + 1}`, `語${i + 1}`, `ご${i + 1}`.replace(/\d/g, "る"), `other ${i + 1}`),
);
const everyWord = [...dueWords, ...others];
const boxes = [1, 2, 3, 4, 5, 5, 4];
const dueMemory: VocabMemory = {};
dueWords.forEach((w, i) => {
  // distinct due dates, d1-1 the most overdue, so the round order is fixed
  dueMemory[w.id] = rec(
    w.japanese,
    boxes[i] as number,
    `2026-09-${String(20 + i).padStart(2, "0")}`,
  );
});
const dueRound = buildDueRound(everyWord, dueMemory, TODAY, "all", everyWord, seeded(3));
{
  check("the Due round asks every due word once", dueRound.length === 7);
  check(
    "kinds follow the boxes (kana-only and unusable readings fall back to choose)",
    same(
      dueRound.map((q) => q.kind),
      ["recognise", "recognise", "choose", "type", "type", "choose", "choose"],
    ),
    JSON.stringify(dueRound.map((q) => q.kind)),
  );
  const q = (id: string) => dueRound.find((x) => x.word.id === id) as RoundQuestion;
  check(
    "a plain question has four meanings, one of them right",
    q("d1-1").options.length === 4 && q("d1-1").options.includes("Water"),
  );
  check(
    "a choose question has four different Japanese words, one of them right",
    q("d1-3").options.length === 4 &&
      new Set(q("d1-3").options).size === 4 &&
      q("d1-3").options.includes("火"),
  );
  check(
    "a type question has no options",
    q("d1-4").options.length === 0 && q("d1-5").options.length === 0,
  );
  check(
    "the right answer shown is the meaning / the word / the reading",
    correctAnswer(q("d1-1")) === "Water" &&
      correctAnswer(q("d1-3")) === "火" &&
      correctAnswer(q("d1-4")) === "かわ",
  );
  check(
    "a 1-word Due round still gets four options (distractors from every word)",
    buildDueRound(everyWord, { "d1-3": rec("火", 3, TODAY) }, TODAY, 10, everyWord, seeded(4))[0]
      ?.options.length === 4,
  );
  check(
    "box 1 and 2 words stay plain in practice rounds, whatever their box",
    buildRound(dueWords, "all", seeded(5)).every(
      (x) => x.kind === "recognise" && x.options.length > 0,
    ),
  );
  check(
    "buildOptions is unchanged for plain questions",
    buildOptions(dueWords[0] as VocabWord, everyWord, seeded(6)).includes("Water"),
  );
}

// ---- scoring a mixed round ----
{
  const q = (id: string) => dueRound.find((x) => x.word.id === id) as RoundQuestion;
  const answers: RoundAnswers = {
    "d1-1": "Water", // right (plain)
    "d1-2": "other 1", // wrong (plain)
    "d1-3": "火", // right (choose)
    "d1-4": "カワ", // right (typed, katakana)
    "d1-5": "hana", // wrong (typed romaji)
    "d1-6": "水", // wrong (choose)
    "d1-7": DONT_KNOW, // I don't know (choose here, so also wrong)
  };
  const score = scoreRound(dueRound, answers);
  check(
    "score counts right answers of every kind",
    score.correct === 3 && score.answered === 7 && score.total === 7,
    JSON.stringify(score),
  );
  check(
    "missed = the wrong picks, the wrong typing and the skip",
    same(
      missedWords(dueRound, answers).map((w) => w.id),
      ["d1-2", "d1-5", "d1-6", "d1-7"],
    ),
  );
  check("a typed right answer is correct", isCorrect(q("d1-4"), answers));
  check("a typed romaji answer is wrong", !isCorrect(q("d1-5"), answers));
  check("the typed meaning is not a reading", !answerIsCorrect(q("d1-4"), "River"));
  check(
    "I don't know is never right, for any kind",
    dueRound.every((x) => !answerIsCorrect(x, DONT_KNOW)),
  );
  check("an unanswered question is not right", !isCorrect(q("d1-4"), {}));
  check(
    "the picked meaning is not right for a choose question",
    !answerIsCorrect(q("d1-3"), "Fire"),
  );

  // retry keeps how each word was asked
  const retry = buildRetryRound(
    missedWords(dueRound, answers),
    everyWord,
    seeded(7),
    kindsById(dueRound),
  );
  // a retry round is shuffled, so compare by word id, not by position
  const retryKinds = kindsById(retry);
  check(
    "retry asks each missed word the way it was asked",
    retry.length === 4 &&
      retryKinds["d1-2"] === "recognise" &&
      retryKinds["d1-5"] === "type" &&
      retryKinds["d1-6"] === "choose" &&
      retryKinds["d1-7"] === "choose",
    JSON.stringify(retryKinds),
  );
  check(
    "a retried typed word has no options, the others have four",
    retry.every((x) => (x.kind === "type" ? x.options.length === 0 : x.options.length === 4)),
  );
  check(
    "retry without kinds is the plain question (as in 14a)",
    buildRetryRound([dueWords[0] as VocabWord], everyWord, seeded(8)).every(
      (x) => x.kind === "recognise",
    ),
  );
  check(
    "kindsById reads the round",
    kindsById(dueRound)["d1-4"] === "type" && kindsById(dueRound)["d1-3"] === "choose",
  );
}

// ---- a typed answer moves the Leitner box like any other ----
{
  const w4 = dueWords[3] as VocabWord; // 川, box 4, overdue
  const q4 = dueRound.find((x) => x.word.id === "d1-4") as RoundQuestion;
  const right = recordAnswer(dueMemory, w4, answerIsCorrect(q4, "かわ"), NOW);
  check(
    "typing it right moves box 4 -> 5",
    right["d1-4"]?.box === 5 && right["d1-4"]?.right === 3,
    JSON.stringify(right["d1-4"]),
  );
  const skip = recordAnswer(dueMemory, w4, answerIsCorrect(q4, DONT_KNOW), NOW);
  check(
    "I don't know sends the word back to box 1, due tomorrow",
    skip["d1-4"]?.box === 1 && skip["d1-4"]?.due === "2026-10-04" && skip["d1-4"]?.wrong === 2,
    JSON.stringify(skip["d1-4"]),
  );
  const typo = recordAnswer(dueMemory, w4, answerIsCorrect(q4, "かあ"), NOW);
  check("a wrong typed answer is an ordinary miss (box 1)", typo["d1-4"]?.box === 1);
}

// ---- Question style (addendum): the control that picks how every word is asked ----
{
  check(
    "four styles, 'By progress' first and the default",
    same(
      QUESTION_STYLES.map((q) => q.label),
      ["By progress", "Meaning", "Choose the word", "Type the reading"],
    ) &&
      QUESTION_STYLES[0]?.id === "progress" &&
      DEFAULT_QUESTION_STYLE === "progress",
  );
  const kawa = dueWords[3] as VocabWord; // 川
  const arigatou = dueWords[5] as VocabWord; // kana-only
  const odd = dueWords[6] as VocabWord; // reading is romaji
  const box5 = rec("川", 5, TODAY);
  check(
    "meaning: plain for every word, whatever the box",
    kindForStyle("meaning", kawa, box5) === "recognise",
  );
  check(
    "choose: choose for every word",
    kindForStyle("choose", kawa, undefined) === "choose" &&
      kindForStyle("choose", arigatou, box5) === "choose",
  );
  check(
    "type: type for a typeable word, even with no record",
    kindForStyle("type", kawa, undefined) === "type",
  );
  check(
    "type: kana-only and unusable readings fall back to choose",
    kindForStyle("type", arigatou, undefined) === "choose" &&
      kindForStyle("type", odd, undefined) === "choose",
  );
  check(
    "progress follows the box, and is plain with no record",
    kindForStyle("progress", kawa, box5) === "type" &&
      kindForStyle("progress", kawa, rec("川", 3, TODAY)) === "choose" &&
      kindForStyle("progress", kawa, undefined) === "recognise",
  );

  // practice rounds: the default stays plain even for words in review; a style applies to every word
  const practice = (style?: Parameters<typeof buildRound>[4]) =>
    buildRound(dueWords, "all", seeded(31), dueWords, style, dueMemory);
  check(
    "practice + default style: plain, though the words are in boxes 1-5",
    practice().every((q) => q.kind === "recognise"),
  );
  check(
    "practice + 'meaning': plain",
    practice("meaning").every((q) => q.kind === "recognise"),
  );
  check(
    "practice + 'choose': every word is choose the word, four different Japanese options, the right one among them",
    practice("choose").every(
      (q) =>
        q.kind === "choose" &&
        q.options.length === 4 &&
        new Set(q.options).size === 4 &&
        q.options.includes(q.word.japanese),
    ),
  );
  const typed = practice("type");
  check(
    "practice + 'type': typeable words are typed (no options), the two others are choose",
    typed.length === 7 &&
      typed.filter((q) => q.kind === "type").length === 5 &&
      typed
        .filter((q) => q.kind === "choose")
        .map((q) => q.word.id)
        .sort()
        .join() === "d1-6,d1-7" &&
      typed.filter((q) => q.kind === "type").every((q) => q.options.length === 0),
    JSON.stringify(typed.map((q) => [q.word.id, q.kind])),
  );

  // the Due round: a fixed style overrides the boxes
  const dueWith = (style: Parameters<typeof buildDueRound>[6]) =>
    buildDueRound(everyWord, dueMemory, TODAY, "all", everyWord, seeded(32), style);
  check(
    "Due + default: by box (unchanged)",
    same(
      dueWith(undefined).map((q) => q.kind),
      dueRound.map((q) => q.kind),
    ),
  );
  check(
    "Due + 'meaning': plain even for the box 5 words",
    dueWith("meaning").every((q) => q.kind === "recognise" && q.options.length === 4),
  );
  check(
    "Due + 'choose': all choose, even the box 1 word",
    dueWith("choose").every((q) => q.kind === "choose"),
  );
  check(
    "Due + 'type': even the box 1 word is typed; no typed question when the reading can't be typed",
    same(
      dueWith("type").map((q) => q.kind),
      ["type", "type", "type", "type", "type", "choose", "choose"],
    ),
    JSON.stringify(dueWith("type").map((q) => q.kind)),
  );
  check(
    "a fixed style leaves the due order alone (most overdue first)",
    same(
      dueWith("type").map((q) => q.word.id),
      dueRound.map((q) => q.word.id),
    ),
  );
  // answers in any style go through the same checks and the same Leitner update
  const asChoose = dueWith("choose").find((q) => q.word.id === "d1-1") as RoundQuestion;
  const rightChoose = recordAnswer(
    dueMemory,
    dueWords[0] as VocabWord,
    answerIsCorrect(asChoose, "水"),
    NOW,
  );
  check(
    "a right 'choose' answer on a box 1 word moves it to box 2 like any right answer",
    rightChoose["d1-1"]?.box === 2,
  );
}

// ---- no repeated words in a round (addendum) ----
{
  const wd = (
    id: string,
    japanese: string,
    reading: string,
    meaning: string,
    day: number,
  ): VocabWord => ({ id, japanese, reading, meaning, day });
  const hon1 = wd("d1-5", "本", "ほん", "Book", 1);
  const hon3 = wd("d3-5", "本", "ほん", "Book", 3);
  const mizu1 = wd("d1-6", "水", "みず", "Water", 1);
  const mizu2 = wd("d2-1", "水", "みず", "Water", 2);
  const mizu4 = wd("d4-8", "水", "みず", "Water", 4);
  const hi = wd("d2-2", "日", "ひ", "Sun / day", 2);
  const nichi = wd("d2-3", "日", "にち", "Day (counter)", 2);
  const fillers = Array.from({ length: 6 }, (_, i) =>
    wd(`d5-${i + 1}`, `字${i + 1}`, `じ${"ああいうえお"[i]}`, `filler ${i + 1}`, 5),
  );
  const pool = [hon3, hon1, mizu4, mizu1, mizu2, hi, nichi, ...fillers];

  const u = uniqueWords(pool);
  check(
    "the same word taught on several days is kept once",
    u.filter((w) => w.japanese === "本").length === 1 &&
      u.filter((w) => w.japanese === "水").length === 1,
  );
  check(
    "with nothing in review the copy from the earlier day is kept (even if listed later)",
    u.find((w) => w.japanese === "本")?.id === "d1-5" &&
      u.find((w) => w.japanese === "水")?.id === "d1-6",
  );
  check(
    "the same text with a different reading is a different word (日 ひ / 日 にち)",
    u.filter((w) => w.japanese === "日").length === 2,
  );
  check(
    "nothing else is lost: 6 fillers + 本 + 水 + 2 × 日 = 10",
    u.length === 10,
    String(u.length),
  );
  check("input is not changed", pool.length === 13 && pool[0] === hon3);
  check("an empty pool stays empty", uniqueWords([]).length === 0);
  check(
    "katakana and hiragana readings are the same word",
    uniqueWords([wd("d1-1", "本", "ほん", "Book", 1), wd("d2-1", "本", "ホン", "Book", 2)])
      .length === 1,
  );
  check("a repeated id is still dropped", uniqueWords([hon1, hon1]).length === 1);

  // the copy already in review wins, even when it is from the later day
  const inReview: VocabMemory = { "d3-5": rec("本", 2, TODAY), "d4-8": rec("水", 1, TODAY) };
  const kept = uniqueWords(pool, inReview);
  check(
    "the copy that is in review is kept, not the earlier day's",
    kept.find((w) => w.japanese === "本")?.id === "d3-5" &&
      kept.find((w) => w.japanese === "水")?.id === "d4-8",
  );
  // both in review: the earlier day
  const both: VocabMemory = { "d3-5": rec("本", 2, TODAY), "d1-5": rec("本", 4, TODAY) };
  check(
    "both copies in review: the earlier day's",
    uniqueWords([hon3, hon1], both)[0]?.id === "d1-5",
  );
  // a record written for different text does not count as 'in review'
  check(
    "a stale record (different text) does not make a copy 'in review'",
    uniqueWords([hon3, hon1], { "d3-5": rec("木", 2, TODAY) })[0]?.id === "d1-5",
  );

  // rounds
  let repeats = 0;
  for (let seed = 1; seed <= 50; seed++) {
    for (const length of [10, "all"] as const) {
      const round = buildRound(pool, length, seeded(seed));
      const keys = round.map((q) => `${q.word.japanese}|${q.word.reading}`);
      if (new Set(keys).size !== keys.length) repeats++;
    }
  }
  check(
    "a practice round never asks the same word twice (50 seeds, two lengths)",
    repeats === 0,
    String(repeats),
  );
  check(
    "a round of 'all' has one question per distinct word",
    buildRound(pool, "all", seeded(40)).length === 10,
  );
  check(
    "the in-review copy is the one asked",
    buildRound(pool, "all", seeded(41), pool, "meaning", inReview).some(
      (q) => q.word.id === "d3-5",
    ) &&
      !buildRound(pool, "all", seeded(41), pool, "meaning", inReview).some(
        (q) => q.word.id === "d1-5",
      ),
  );

  // Due rounds: both copies due and in review -> asked once
  const dueBoth: VocabMemory = {
    "d1-5": rec("本", 1, "2026-09-01"),
    "d3-5": rec("本", 1, "2026-09-02"),
    "d1-6": rec("水", 1, "2026-09-03"),
  };
  const dueList = dueWordsOverdueFirst(pool, dueBoth, TODAY, seeded(42));
  check(
    "Due list: the repeated word appears once (the earlier day's copy)",
    same(
      dueList.map((w) => w.id),
      ["d1-5", "d1-6"],
    ),
    JSON.stringify(dueList.map((w) => w.id)),
  );
  check(
    "Due round: 2 questions, not 3",
    buildDueRound(pool, dueBoth, TODAY, "all", pool, seeded(43)).length === 2,
  );
  // distractor options also stay unique by text
  check(
    "options never show the same text twice, even with repeated words in the pool",
    buildRound(pool, "all", seeded(44)).every(
      (q) => new Set(q.options).size === q.options.length,
    ) &&
      buildRound(pool, "all", seeded(44), pool, "choose").every(
        (q) => new Set(q.options).size === q.options.length,
      ),
  );
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
