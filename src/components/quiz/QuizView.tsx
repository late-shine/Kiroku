// Phase 14a — the quiz, moved out of routes/index.tsx and turned into rounds: a round has an end, a
// score, a list of misses and a "retry missed" round. The round logic itself is pure and lives in
// ./round.ts; this file is only state + markup. Theme tokens only.
// Phase 14d: a "Due today" round asks harder questions for words that have climbed the boxes (choose the
// word, type the reading); the other scopes ask the plain question, as always.
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Check, Sparkles, X } from "lucide-react";
import {
  badgeText,
  dueWords,
  gapFor,
  isDue,
  localDay,
  memoryFor,
  recordAnswer,
  reviewCount,
  spreadBacklog,
  type VocabMemory,
} from "@/lib/word-memory";
import {
  BACKLOG_SPREAD_THRESHOLD,
  DAILY_GOALS,
  DUE_FOCUSES,
  backlogKeepCount,
  dailyDueDone,
  dailyDueRemaining,
  dailyDueTarget,
  effectiveDueRoundLength,
  grantBonusReview,
  isDailyGoalComplete,
  recordDueAnswered,
  type QuizPrefs,
} from "@/lib/quiz-prefs";
import { pruneLog, recordStudy } from "@/lib/study-log";
import { useToday } from "@/hooks/use-today";
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
import { useQuizPrefs } from "./useQuizPrefs";
import { BacklogSpreadControl } from "./BacklogSpreadControl";

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
// Phase 16e: the four scope pills ("This day", "All days", "Day range", "Due today · N") add up to about 350 px, wider
// than a phone's pane, so on a phone they sit in a 2 x 2 grid instead of squeezing and wrapping inside each pill.
const scopeWrap =
  "grid grid-cols-2 items-center gap-1 rounded-2xl border border-border/50 bg-glass/50 p-1 sm:flex sm:rounded-full";
const segmentClass = (on: boolean) =>
  `hit-area whitespace-nowrap rounded-full px-3 py-1 text-center text-[11px] font-medium transition-all ${
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
  onOpenStudio,
}: {
  lessons: DayLesson[];
  day: number;
  memory: VocabMemory;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  onBack: () => void;
  /** Opens the AI Lesson Studio; offered when there are no lessons to quiz on. */
  onOpenStudio: () => void;
}) {
  const [scope, setScope] = useState<QuizScope>("day");
  const [rangeFrom, setRangeFrom] = useState<number | null>(null);
  const [rangeTo, setRangeTo] = useState<number | null>(null);
  const [roundLength, setRoundLength] = useState<RoundLength>(DEFAULT_ROUND_LENGTH);
  const [style, setStyle] = useState<QuestionStyle>(DEFAULT_QUESTION_STYLE);
  const { prefs, loaded: prefsLoaded, update: updateQuizPrefs } = useQuizPrefs();
  const today = useToday() ?? localDay();

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
  const dueNow = dueWords(allVocab, memory, today).length;
  const dueRemaining = dailyDueRemaining(dueNow, prefs, today);
  const targetToday = dailyDueTarget(prefs, today);
  const doneToday = dailyDueDone(prefs, today);
  const goalCapped = targetToday !== null;
  const goalComplete = isDailyGoalComplete(dueNow, prefs, today);
  const keepOnSpread = backlogKeepCount(dueNow, dueRemaining, goalCapped);
  const canSpreadBacklog = dueNow >= BACKLOG_SPREAD_THRESHOLD && dueNow > keepOnSpread;
  const [spreadNotice, setSpreadNotice] = useState<string | null>(null);
  const inReview = reviewCount(allVocab, memory);

  // A NEW round. Due words are decided here, at round start: answering moves a word out of "due", and that
  // must not shrink (or restart) the round that is already running.
  const startRound = (activePrefs: QuizPrefs = prefs, activeMemory: VocabMemory = memory) => {
    if (scope !== "due") {
      return buildRound(pool, roundLength, Math.random, pool, style, activeMemory);
    }
    const activeDue = dueWords(allVocab, activeMemory, today).length;
    const remaining = dailyDueRemaining(activeDue, activePrefs, today);
    const capped = dailyDueTarget(activePrefs, today) !== null;
    const dueLen = effectiveDueRoundLength(roundLength, remaining, capped);
    return buildDueRound(
      allVocab,
      activeMemory,
      today,
      dueLen,
      pool,
      Math.random,
      style,
      activePrefs.dueFocus,
    );
  };

  // Keyed by ids + pacing config (never `doneCount`, so answering a question never resets an active round).
  const poolKey = useMemo(() => pool.map((w) => w.id).join("|"), [pool]);
  const dueConfigPart =
    scope === "due" ? `~${prefsLoaded ? 1 : 0}~${prefs.dailyGoal}~${prefs.dueFocus}` : "";
  const configKey = `${scope}~${roundLength}~${style}${dueConfigPart}~${poolKey}`;
  const [stored, setStored] = useState<Session>(() => freshSession(configKey, startRound()));
  let session = stored;
  if (stored.key !== configKey) {
    // Changing the scope / round length / style / goal / focus / words starts a fresh round.
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
  const missedWordMemory =
    question !== undefined && locked && !right ? memoryFor(memory, question.word) : undefined;
  const missedReturnDays = gapFor(missedWordMemory?.box ?? 1);

  // `value` is the option that was picked, the reading that was typed, or DONT_KNOW. Every kind goes through
  // here, so every answer updates the score, weakVocabIds, the word's review record, and today's due count.
  const pick = (value: string) => {
    if (!question || locked || session.finished) return;
    const id = question.word.id;
    const correct = answerIsCorrect(question, value);
    const now = new Date();
    const answerDay = localDay(now);
    const wasDue = isDue(memoryFor(memory, question.word), answerDay);
    setStored({ ...session, answers: { ...session.answers, [id]: value } });
    setProgress((p) => ({
      ...p,
      totalQuizzesTaken: p.totalQuizzesTaken + 1,
      totalCorrectAnswers: p.totalCorrectAnswers + (correct ? 1 : 0),
      weakVocabIds: updateWeakIds(p.weakVocabIds, id, correct),
      vocabMemory: recordAnswer(p.vocabMemory, question.word, correct, now),
      studyLog: pruneLog(recordStudy(p.studyLog, answerDay, correct), answerDay),
    }));
    if (wasDue) {
      updateQuizPrefs((p) => recordDueAnswered(p, answerDay, 1));
    }
  };
  const next = () =>
    setStored(isLast ? { ...session, finished: true } : { ...session, index: session.index + 1 });
  const endEarly = () => setStored({ ...session, finished: true });
  const newRound = () => {
    setSpreadNotice(null);
    setStored(freshSession(configKey, startRound()));
  };
  const reviewMore = (extra = 10) => {
    setSpreadNotice(null);
    const nextPrefs = grantBonusReview(prefs, today, extra);
    updateQuizPrefs(() => nextPrefs);
    const questions = buildDueRound(
      allVocab,
      memory,
      today,
      Math.min(extra, dueNow),
      pool,
      Math.random,
      style,
      nextPrefs.dueFocus,
    );
    setStored(freshSession(configKey, questions));
  };
  const handleSpreadBacklog = (days: 7 | 14) => {
    const moved = Math.max(0, dueNow - keepOnSpread);
    if (moved === 0) return;
    const now = new Date();
    const nextMemory = spreadBacklog(memory, allVocab, today, days, keepOnSpread, now);
    setProgress((p) => ({
      ...p,
      vocabMemory: spreadBacklog(p.vocabMemory, allVocab, today, days, keepOnSpread, now),
    }));
    setSpreadNotice(
      keepOnSpread > 0
        ? `Spaced ${moved} overdue words across the next ${days} days — ${keepOnSpread} remain due today.`
        : `Spaced ${moved} overdue words across the next ${days} days starting tomorrow.`,
    );
    if (!session.finished && Object.keys(session.answers).length === 0) {
      setStored(freshSession(configKey, startRound(prefs, nextMemory)));
    }
  };
  // A missed word is retried the way it was asked (a missed typed reading is a typed reading again).
  const retryMissed = () => {
    setSpreadNotice(null);
    setStored(
      freshSession(
        configKey,
        buildRetryRound(missed, pool, Math.random, kindsById(session.questions)),
        true,
      ),
    );
  };

  const duePillSuffix =
    dueNow === 0 ? " · 0" : goalComplete ? " · Done" : ` · ${badgeText(dueRemaining)}`;

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

  const showGoalCompleteScreen =
    scope === "due" && goalComplete && total === 0 && !session.finished;

  return (
    <div className="mx-auto max-w-3xl">
      <Pane>
        <div className="flex justify-between gap-3">
          <span className="font-display text-xs italic text-primary">無作為 · quick quiz</span>
          <span className="text-right text-xs text-muted-foreground">{counter}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className={scopeWrap}>
            {QUIZ_SCOPES.map((sc) => (
              <button
                key={sc.id}
                onClick={() => {
                  setScope(sc.id);
                  if (sc.id !== "due") setSpreadNotice(null);
                }}
                aria-pressed={scope === sc.id}
                className={segmentClass(scope === sc.id)}
              >
                {sc.label}
                {sc.id === "due" ? duePillSuffix : ""}
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
          {scope === "due" && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Daily goal</span>
                <div className={segmentWrap}>
                  {DAILY_GOALS.map((g) => (
                    <button
                      key={String(g.id)}
                      type="button"
                      onClick={() => updateQuizPrefs((p) => ({ ...p, dailyGoal: g.id }))}
                      aria-pressed={prefs.dailyGoal === g.id}
                      className={segmentClass(prefs.dailyGoal === g.id)}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Order</span>
                <div className={`${segmentWrap} flex-wrap`}>
                  {DUE_FOCUSES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => updateQuizPrefs((p) => ({ ...p, dueFocus: f.id }))}
                      aria-pressed={prefs.dueFocus === f.id}
                      className={segmentClass(prefs.dueFocus === f.id)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {scope === "due" && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {dueNow > 0 && (
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-foreground/85">
                    {goalCapped && targetToday !== null
                      ? `Today’s goal: ${Math.min(doneToday, targetToday)} / ${targetToday} reviewed · ${dueNow} total due`
                      : `Showing all ${dueNow} due ${dueNow === 1 ? "word" : "words"}`}
                  </p>
                  {canSpreadBacklog && (
                    <BacklogSpreadControl
                      dueNow={dueNow}
                      keepToday={keepOnSpread}
                      onSpread={handleSpreadBacklog}
                    />
                  )}
                </div>
              </div>
            )}
            {spreadNotice && (
              <p role="status" className="text-primary">
                {spreadNotice}
              </p>
            )}
            <p>
              Only words you've added to review. Right answers push a word further out; missed words
              step back gently without losing all progress.
              {style === "progress" &&
                " The better you know a word, the harder it is asked: pick the meaning, then pick the word, then type the reading."}
            </p>
          </div>
        )}
        {style === "type" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Words written only in kana, such as ありがとう, have nothing to type, so they are asked
            as "Choose the word".
          </p>
        )}

        {showGoalCompleteScreen ? (
          <div className="mt-10 text-center" aria-live="polite">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full border border-primary/40 bg-primary/15 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-display text-2xl text-foreground">
              Today’s review goal complete
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You reviewed {doneToday} of {targetToday} words today.
              {dueNow > 0 &&
                ` ${dueNow} older ${dueNow === 1 ? "word is" : "words are"} still waiting in your backlog — no rush, chip away whenever you like.`}
            </p>
            {canSpreadBacklog && (
              <div className="mt-3">
                <BacklogSpreadControl
                  dueNow={dueNow}
                  keepToday={keepOnSpread}
                  onSpread={handleSpreadBacklog}
                  centered
                />
              </div>
            )}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => reviewMore(10)}
                className="hit-area rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Review 10 more
              </button>
              <button
                type="button"
                onClick={() => {
                  setSpreadNotice(null);
                  setScope("day");
                }}
                className="hit-area rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
              >
                Practise This day
              </button>
              <button
                type="button"
                onClick={onBack}
                className="hit-area rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
              >
                Back to lessons
              </button>
            </div>
          </div>
        ) : total === 0 ? (
          <div className="mt-10">
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            {lessons.length === 0 && (
              <button
                type="button"
                onClick={onOpenStudio}
                className="hit-area mt-4 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Open AI Lesson Studio
              </button>
            )}
          </div>
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
                {scope === "due" && goalComplete && targetToday !== null && (
                  <div className="mt-5 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center">
                    <p className="font-display text-sm font-semibold text-primary">
                      Today’s review goal complete ({doneToday} / {targetToday})
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dueNow} older {dueNow === 1 ? "word" : "words"} still waiting in your backlog
                      — chip away whenever you like.
                    </p>
                  </div>
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
                    <ul className="mt-2 max-h-[280px] overflow-y-auto overscroll-contain">
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
                    <p className="mt-3 text-xs text-muted-foreground">
                      {missed.length === 1
                        ? "This word stays in your review and returns on its stepped-down schedule."
                        : `These ${missed.length} words stay in your review and return on their stepped-down schedule.`}
                    </p>
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
              {scope === "due" && goalComplete ? (
                <button
                  type="button"
                  onClick={() => reviewMore(10)}
                  className={
                    missed.length > 0
                      ? "rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
                      : "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  }
                >
                  Review 10 more
                </button>
              ) : (
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
              )}
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
                <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div
                  className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  aria-live="polite"
                >
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
                    {!right && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {missedReturnDays <= 1
                          ? "Stepped back in review — back tomorrow."
                          : `Stepped back in review — back in ${missedReturnDays} days.`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={next}
                    className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:w-auto sm:py-2"
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
