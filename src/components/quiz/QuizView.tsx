// Phase 14a — the quiz, moved out of routes/index.tsx and turned into rounds: a round has an end, a
// score, a list of misses and a "retry missed" round. The round logic itself is pure and lives in
// ./round.ts; this file is only state + markup. Theme tokens only.
// Phase 14d: a "Due today" round asks harder questions for words that have climbed the boxes (choose the
// word, type the reading); the other scopes ask the plain question, as always.
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, X } from "lucide-react";
import {
  badgeText,
  dueWords,
  localDay,
  recordAnswer,
  reviewCount,
  type VocabMemory,
} from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import {
  DEFAULT_QUESTION_STYLE,
  DEFAULT_ROUND_LENGTH,
  DONT_KNOW,
  QUESTION_STYLES,
  ROUND_LENGTHS,
  answerIsCorrect,
  buildDueRound,
  buildRetryRound,
  buildRound,
  correctAnswer,
  isCorrect,
  kindsById,
  missedWords,
  scoreRound,
  updateWeakIds,
  type QuestionKind,
  type QuestionStyle,
  type RoundAnswers,
  type RoundLength,
  type RoundQuestion,
} from "./round";
import { TypedAnswer } from "./TypedAnswer";

/** The small caption above a harder question. The plain question (recognise) has none, so it looks as it always did. */
const KIND_CAPTIONS: Record<Exclude<QuestionKind, "recognise">, string> = {
  choose: "Which word means this?",
  type: "Type the reading in kana",
};

type QuizScope = "day" | "all" | "range" | "due";
const QUIZ_SCOPES: { id: QuizScope; label: string }[] = [
  { id: "day", label: "This day" },
  { id: "all", label: "All days" },
  { id: "range", label: "Day range" },
  { id: "due", label: "Due today" },
];

/**
 * One round in progress (or just finished). `key` is the scope + round length + pool it was built for.
 * `serial` is different for every round (even a retry or a new round with the same key), so a typed-answer
 * box is never carried over from one round to the next.
 */
interface Session {
  key: string;
  serial: number;
  questions: RoundQuestion[];
  index: number;
  answers: RoundAnswers;
  finished: boolean;
  retry: boolean;
}
let sessionCount = 0;
const freshSession = (key: string, questions: RoundQuestion[], retry = false): Session => ({
  key,
  serial: ++sessionCount,
  questions,
  index: 0,
  answers: {},
  finished: false,
  retry,
});

function Pane({ children }: { children: ReactNode }) {
  return <section className="glass-panel pane-in rounded-xl p-5 md:p-7">{children}</section>;
}

const segmentWrap = "flex items-center gap-1 rounded-full border border-border/50 bg-glass/50 p-1";
const segmentClass = (on: boolean) =>
  `rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
    on
      ? "bg-primary text-primary-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  }`;
const selectClass =
  "rounded-lg border border-border/60 bg-glass/60 px-2.5 py-1 text-xs outline-none focus:border-primary";

export function QuizView({
  lessons,
  day,
  memory,
  setProgress,
  onBack,
}: {
  lessons: DayLesson[];
  day: number;
  memory: VocabMemory;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  onBack: () => void;
}) {
  const [scope, setScope] = useState<QuizScope>("day");
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const [roundLength, setRoundLength] = useState<RoundLength>(DEFAULT_ROUND_LENGTH);
  const [style, setStyle] = useState<QuestionStyle>(DEFAULT_QUESTION_STYLE);

  const dayNumbers = useMemo(
    () => lessons.map((l) => l.dayNumber).sort((a, b) => a - b),
    [lessons],
  );
  const firstDay = dayNumbers[0] ?? day;
  const lastDay = dayNumbers[dayNumbers.length - 1] ?? day;
  // Saved picks can point at a day that was deleted since — fall back to the ends of what exists.
  const fromDay = rangeFrom !== null && dayNumbers.includes(rangeFrom) ? rangeFrom : firstDay;
  const toDay = rangeTo !== null && dayNumbers.includes(rangeTo) ? rangeTo : lastDay;
  const lo = Math.min(fromDay, toDay);
  const hi = Math.max(fromDay, toDay);
  const allVocab = useMemo(() => lessons.flatMap((l) => l.vocab), [lessons]);
  // `pool` = the words this scope is made of; for "Due today" it is every word (the due ones are picked when a
  // round starts, and every word is a possible wrong option).
  const pool = useMemo(() => {
    if (scope === "day") return lessons.find((l) => l.dayNumber === day)?.vocab ?? [];
    if (scope === "range")
      return lessons.filter((l) => l.dayNumber >= lo && l.dayNumber <= hi).flatMap((l) => l.vocab);
    return allVocab;
  }, [lessons, allVocab, day, scope, lo, hi]);
  const scopeLabel =
    scope === "day"
      ? `Day ${day}`
      : scope === "all"
        ? "All days"
        : scope === "due"
          ? "Due today"
          : lo === hi
            ? `Day ${lo}`
            : `Days ${lo}–${hi}`;
  const dueNow = dueWords(allVocab, memory, localDay()).length;
  const inReview = reviewCount(allVocab, memory);
  // A NEW round. Due words are decided here, at round start: answering moves a word out of "due", and that
  // must not shrink (or restart) the round that is already running. A due round asks the most overdue words
  // first (Phase 14b-fix); every other scope is a random pick from its pool, as before. A word taught twice
  // (same Japanese and reading under two ids) is asked once, and `style` is the "Question style" control.
  const startRound = () =>
    scope === "due"
      ? buildDueRound(allVocab, memory, localDay(), roundLength, pool, Math.random, style)
      : buildRound(pool, roundLength, Math.random, pool, style, memory);

  // Keyed by ids (not by the array's identity) so an unrelated lessons update can't restart a round
  // half-way through; a different scope, round length, question style or set of words does. "Due today" is keyed by the
  // whole vocabulary, never by what is due, for the reason above.
  const poolKey = useMemo(() => pool.map((w) => w.id).join("|"), [pool]);
  const configKey = `${scope}~${roundLength}~${style}~${poolKey}`;
  const [stored, setStored] = useState<Session>(() => freshSession(configKey, startRound()));
  let session = stored;
  if (stored.key !== configKey) {
    // Changing the scope / round length / style / words starts a fresh round (reset-during-render pattern).
    session = freshSession(configKey, startRound());
    setStored(session);
  }

  const total = session.questions.length;
  const question = session.questions[session.index];
  const picked = question ? session.answers[question.word.id] : undefined;
  const locked = picked !== undefined;
  const isLast = session.index >= total - 1;
  const score = scoreRound(session.questions, session.answers);
  const missed = missedWords(session.questions, session.answers);

  const right = question !== undefined && locked && isCorrect(question, session.answers);

  // `value` is the option that was picked, the reading that was typed, or DONT_KNOW. Every kind goes through
  // here, so every answer updates the score, weakVocabIds and the word's review record the same way.
  const pick = (value: string) => {
    if (!question || locked || session.finished) return;
    const id = question.word.id;
    const correct = answerIsCorrect(question, value);
    const now = new Date();
    setStored({ ...session, answers: { ...session.answers, [id]: value } });
    // totalQuizzesTaken keeps counting answered questions, exactly as before (Phase 14a decision (a) = B).
    // A miss adds the word to weakVocabIds; a right answer removes it.
    setProgress((p) => ({
      ...p,
      totalQuizzesTaken: p.totalQuizzesTaken + 1,
      totalCorrectAnswers: p.totalCorrectAnswers + (correct ? 1 : 0),
      weakVocabIds: updateWeakIds(p.weakVocabIds, id, correct),
      // Phase 14b: every answer, in every scope, updates the word's review record (box + due date).
      vocabMemory: recordAnswer(p.vocabMemory, question.word, correct, now),
    }));
  };
  const next = () =>
    setStored(isLast ? { ...session, finished: true } : { ...session, index: session.index + 1 });
  const endEarly = () => setStored({ ...session, finished: true });
  const newRound = () => setStored(freshSession(configKey, startRound()));
  // A missed word is retried the way it was asked (a missed typed reading is a typed reading again).
  const retryMissed = () =>
    setStored(
      freshSession(
        configKey,
        buildRetryRound(missed, pool, Math.random, kindsById(session.questions)),
        true,
      ),
    );

  const emptyMessage =
    lessons.length === 0
      ? "There are no lessons yet — import one first."
      : scope === "due"
        ? allVocab.length === 0
          ? "No vocabulary yet — import a lesson with vocab first."
          : inReview === 0
            ? "Nothing due. Add words from a lesson (Vocab tab), or practise any day with the other options above."
            : "Nothing is due today — every word in review is scheduled for later. Come back tomorrow, or practise any day with the other options above."
        : scope === "day"
          ? `Day ${day} doesn't have any vocabulary yet — import or select a lesson with vocab first.`
          : "No vocabulary in this selection yet.";

  const counter =
    total === 0
      ? scopeLabel
      : session.finished
        ? `${scopeLabel} · ${session.retry ? "Retry · " : ""}Round complete`
        : `${scopeLabel} · ${session.retry ? "Retry · " : ""}Question ${session.index + 1} of ${total}`;

  return (
    <div className="mx-auto max-w-3xl">
      <Pane>
        <div className="flex justify-between gap-3">
          <span className="font-display text-xs italic text-primary">無作為 · quick quiz</span>
          <span className="text-right text-xs text-muted-foreground">{counter}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className={segmentWrap}>
            {QUIZ_SCOPES.map((sc) => (
              <button
                key={sc.id}
                onClick={() => setScope(sc.id)}
                aria-pressed={scope === sc.id}
                className={segmentClass(scope === sc.id)}
              >
                {sc.label}
                {sc.id === "due" ? ` · ${badgeText(dueNow)}` : ""}
              </button>
            ))}
          </div>
          {scope === "range" && dayNumbers.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                From
                <select
                  value={fromDay}
                  onChange={(e) => setRangeFrom(Number(e.target.value))}
                  aria-label="First day of the range"
                  className={selectClass}
                >
                  {dayNumbers.map((n) => (
                    <option key={n} value={n}>
                      Day {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                to
                <select
                  value={toDay}
                  onChange={(e) => setRangeTo(Number(e.target.value))}
                  aria-label="Last day of the range"
                  className={selectClass}
                >
                  {dayNumbers.map((n) => (
                    <option key={n} value={n}>
                      Day {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Words per round</span>
            <div className={segmentWrap}>
              {ROUND_LENGTHS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoundLength(r.id)}
                  aria-pressed={roundLength === r.id}
                  className={segmentClass(roundLength === r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Question style</span>
            <div className={`${segmentWrap} flex-wrap`}>
              {QUESTION_STYLES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setStyle(q.id)}
                  aria-pressed={style === q.id}
                  className={segmentClass(style === q.id)}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {scope === "due" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Only words you've added to review, most overdue first. Add words on the Vocab tab, or
            answer them in any quiz. Right answers push a word further out; a wrong answer brings it
            back tomorrow.
            {style === "progress" &&
              " The better you know a word, the harder it is asked: pick the meaning, then pick the word, then type the reading."}
          </p>
        )}
        {style === "type" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Words written only in kana, such as ありがとう, have nothing to type, so they are asked
            as "Choose the word".
          </p>
        )}

        {total === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">{emptyMessage}</p>
        ) : session.finished ? (
          <div className="mt-10" aria-live="polite">
            {score.answered === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                You didn't answer any questions in this round.
              </p>
            ) : (
              <>
                <p className="text-center font-display text-5xl text-primary">
                  {score.correct} / {score.answered}
                </p>
                {score.answered < score.total && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Ended early — {score.answered} of {score.total} questions answered.
                  </p>
                )}
                {missed.length === 0 ? (
                  <p className="mt-6 text-center text-sm">
                    全問正解 — every word you answered was right.
                  </p>
                ) : (
                  <div className="mt-6">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Missed · {missed.length}
                    </p>
                    <ul className="mt-2 max-h-[280px] overflow-y-auto">
                      {missed.map((w) => (
                        <li
                          key={w.id}
                          className="flex items-baseline justify-between gap-3 border-b border-border py-2"
                        >
                          <span>
                            <span className="font-display text-lg">{w.japanese}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{w.reading}</span>
                          </span>
                          <span className="text-right text-sm">{w.meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {missed.length > 0 && (
                <button
                  onClick={retryMissed}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Retry missed words ({missed.length})
                </button>
              )}
              <button
                onClick={newRound}
                className={
                  missed.length > 0
                    ? "rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
                    : "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                }
              >
                New round
              </button>
              <button
                onClick={onBack}
                className="rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
              >
                Back to lessons
              </button>
            </div>
          </div>
        ) : (
          question && (
            <>
              {question.kind === "recognise" ? (
                <>
                  <p className="mt-12 text-center font-display text-5xl">
                    {question.word.japanese}
                  </p>
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    {question.word.reading}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-10 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {KIND_CAPTIONS[question.kind]}
                  </p>
                  {question.kind === "choose" ? (
                    <p className="mt-4 text-center font-display text-3xl">
                      {question.word.meaning}
                    </p>
                  ) : (
                    <>
                      <p lang="ja" className="mt-4 text-center font-display text-5xl">
                        {question.word.japanese}
                      </p>
                      {/* the meaning stays as a hint: the aim is recalling the reading */}
                      <p className="mt-2 text-center text-sm text-muted-foreground">
                        {question.word.meaning}
                      </p>
                    </>
                  )}
                </>
              )}
              {question.kind === "type" ? (
                <TypedAnswer
                  key={`${session.serial}-${session.index}`}
                  word={question.word}
                  answer={picked}
                  onSubmit={pick}
                  onNext={next}
                />
              ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {question.options.map((o) => {
                    const isAnswer = o === correctAnswer(question);
                    const isWrongPick = locked && o === picked && !isAnswer;
                    const state = !locked
                      ? "border-border/50 bg-glass/40 hover:border-primary/50 hover:bg-glass/70 shadow-sm"
                      : isAnswer
                        ? "border-success/60 bg-success/15 shadow-sm ring-1 ring-success/30"
                        : isWrongPick
                          ? "border-destructive/60 bg-destructive/15 ring-1 ring-destructive/30"
                          : "border-border/30 bg-glass/20 opacity-50";
                    return (
                      <button
                        key={o}
                        onClick={() => pick(o)}
                        disabled={locked}
                        className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left text-sm transition-all disabled:cursor-default ${state}`}
                      >
                        {question.kind === "choose" ? (
                          <span lang="ja" className="font-display text-xl tracking-wide">
                            {o}
                          </span>
                        ) : (
                          <span className="font-medium text-foreground">{o}</span>
                        )}
                        {locked && isAnswer && (
                          <Check
                            className="size-4 shrink-0 text-success"
                            aria-label="Correct answer"
                          />
                        )}
                        {isWrongPick && (
                          <X
                            className="size-4 shrink-0 text-destructive"
                            aria-label="Your answer"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {locked && (
                <div className="mt-5 flex items-center justify-between gap-3" aria-live="polite">
                  <div>
                    <p className="text-sm">
                      {right
                        ? "正解 — Correct"
                        : question.kind === "type"
                          ? picked === DONT_KNOW
                            ? "No problem — the reading is shown above."
                            : "Not quite — the right reading is shown above."
                          : "Not quite — the right answer is highlighted."}
                    </p>
                    {question.kind === "choose" && (
                      <p lang="ja" className="mt-0.5 text-xs text-muted-foreground">
                        {question.word.japanese} · {question.word.reading}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={next}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    {isLast ? "Finish" : "Next"}
                  </button>
                </div>
              )}
              <div className="mt-6 border-t border-border pt-3">
                <button
                  onClick={endEarly}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  End round
                </button>
              </div>
            </>
          )
        )}
      </Pane>
    </div>
  );
}
