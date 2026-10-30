// Writing quests, Phases Q2 and Q3 — the Write page: a MODE of the shell (like Profile), shown only while writing
// practice is on.
//
// One page of up to 3 kanji from the learner's own lessons, in two steps (the optional photo step arrives in Phase Q5):
//   1. Write:   numbered cue cards (meaning, readings, one blanked compound). The characters are not in the DOM.
//   2. Compare: the characters are revealed; the learner marks each "Wrote it right" or "Not yet", then saves.
// The learner's own mark is the record. Saving writes `progress.writing` and `progress.writingLog[today]` and nothing
// else: no vocab memory, no study log, no quiz counters. No network request is made anywhere on this page.
//
// The page being written is kept in the device-only quest prefs (`prefs.draft`), so a reload keeps the marks. It is
// made the first time the page is shown, which also freezes which kanji are on it (a sync that changes the lessons
// meanwhile cannot change the numbering on the learner's paper). It belongs to one local day (`useToday` moves on at
// midnight) and saving clears it. Today's attempted kanji never come back the same day, which is also what keeps the
// extras below from farming rank.
//
// Phase Q3 extras:
//   - "Write 3 more" (after a save): a new page from the kanji not yet attempted today.
//   - "Choose by meaning" (when nothing is left to pick automatically): the learner ticks 1 to 5 kanji by meaning and
//     reading. The list never shows a character, and a chosen page runs through the same steps and the same save.
//   - A first-visit note, dismissible; the dismissal is kept in the device prefs (`intro`).
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ChoiceRow, PageCard } from "@/components/write/PageCard";
import type { QuestPrefsApi } from "@/components/write/useQuestPrefs";
import { useToday } from "@/hooks/use-today";
import {
  DRAFT_MAX_KEYS,
  allMarked,
  draftForDay,
  draftResults,
  markDraft,
  markedCount,
  newDraft,
  resolveDraft,
  revealDraft,
  withIntro,
  type WritingDraft,
  type WritingMark,
} from "@/lib/quest-prefs";
import {
  WRITING_PAGE_SIZE,
  applyPage,
  eligibleKanji,
  knownKanji,
  pickPage,
  poolKanji,
  recordWritingDay,
  type WritingPick,
} from "@/lib/writing";
import type { DayLesson, UserProgressState } from "@/types/japanese";

const labelClass = "font-display text-xs font-semibold tracking-wider text-primary";
const headingClass = "font-display text-2xl text-foreground focus-visible:outline-none";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const primaryButton = `hit-area rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors motion-reduce:transition-none hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const quietButton = `hit-area rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-accent hover:text-foreground ${focusRing}`;

const NO_PICKS: readonly WritingPick[] = [];

type View = "loading" | "no-kanji" | "write" | "reveal" | "done" | "empty";

export function WritePage({
  lessons,
  progress,
  setProgress,
  quests,
  onOpenStudio,
  onBack,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  quests: QuestPrefsApi;
  onOpenStudio: () => void;
  onBack: () => void;
}) {
  const today = useToday();
  const { prefs, loaded, setDraft, update } = quests;

  const pool = useMemo(() => poolKanji(lessons), [lessons]);
  const known = useMemo(() => knownKanji(lessons), [lessons]);

  // The stored page, only while it belongs to today.
  const stored = today === null ? null : draftForDay(prefs.draft, today);
  const dayEntry = today === null ? undefined : progress.writingLog[today];
  const savedToday = (dayEntry?.n ?? 0) > 0;

  // What the automatic picker offers now (deterministic: same lessons and records, same page). Computed while no page
  // is open. Before anything is saved today it IS today's page; after a save it is what "Write 3 more" would start.
  const candidates = useMemo(
    () =>
      loaded && today !== null && stored === null
        ? pickPage(lessons, progress.writing, today)
        : NO_PICKS,
    [loaded, today, stored, lessons, progress.writing],
  );
  const provisional = useMemo(
    () =>
      today !== null && !savedToday && candidates.length > 0
        ? newDraft(
            today,
            candidates.map((p) => p.key),
          )
        : null,
    [today, savedToday, candidates],
  );
  const more = savedToday ? candidates : NO_PICKS;
  const shown: WritingDraft | null = stored ?? provisional;
  const cards = useMemo(() => (shown === null ? [] : resolveDraft(shown, pool)), [shown, pool]);

  // Keep the stored page tidy and make it the first time it is shown (see the header comment). Every branch moves
  // toward a steady state, so this cannot loop.
  useEffect(() => {
    if (!loaded || today === null) return;
    if (prefs.draft !== undefined && stored === null) {
      setDraft(null); // yesterday's page: forget it
      return;
    }
    if (stored !== null && cards.length === 0) {
      setDraft(null); // every kanji on it has left the lessons
      return;
    }
    if (stored === null && provisional !== null) setDraft(provisional);
  }, [loaded, today, prefs.draft, stored, cards.length, provisional, setDraft]);

  const [saved, setSaved] = useState<{ day: string; ok: number; total: number } | null>(null);

  let view: View = "empty";
  if (today === null || !loaded) view = "loading";
  else if (pool.length === 0) view = "no-kanji";
  else if (shown !== null && cards.length > 0) view = shown.step;
  else if (savedToday) view = "done";

  // "Choose by meaning": only offered when no page is open and the automatic picker has nothing left to give.
  const choices = useMemo(
    () =>
      (view === "empty" || view === "done") && candidates.length === 0 && today !== null
        ? eligibleKanji(lessons, progress.writing, today)
        : [],
    [view, candidates.length, today, lessons, progress.writing],
  );
  const [ticked, setTicked] = useState<string[]>([]);
  const tickedNow = choices
    .filter((choice) => ticked.includes(choice.key))
    .slice(0, DRAFT_MAX_KEYS);

  // What the done step says: the numbers just saved, or (after a reload) the day's log.
  const savedNow = saved !== null && saved.day === today;
  const doneNumbers = savedNow
    ? { ok: saved.ok, total: saved.total }
    : { ok: dayEntry?.ok ?? 0, total: dayEntry?.n ?? 0 };
  const doneText = `${savedNow ? "Saved." : "Saved today."} ${doneNumbers.ok} of ${doneNumbers.total} written right.`;

  // The first-visit note: until it is dismissed, and never once a page has been saved (the note has done its job).
  const showIntro =
    loaded &&
    prefs.intro !== true &&
    Object.keys(progress.writing).length === 0 &&
    (view === "write" || view === "reveal" || view === "empty");

  // Focus moves to the new step's heading when the step changes (never on the first display).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastView = useRef<View | null>(null);
  useEffect(() => {
    if (view === "loading") return;
    if (lastView.current !== null && lastView.current !== view) headingRef.current?.focus();
    lastView.current = view;
  }, [view]);

  const keys = cards.map((card) => card.entry.key);

  // A tap works on the stored page when there is one; otherwise on the page on screen. (Never on yesterday's.)
  const baseOf = (previous: WritingDraft | undefined): WritingDraft | null =>
    previous !== undefined && shown !== null && previous.day === shown.day ? previous : shown;

  const reveal = () =>
    setDraft((previous) => {
      const base = baseOf(previous);
      return base === null ? null : revealDraft(base);
    });

  const setMark = (key: string, next: WritingMark) =>
    setDraft((previous) => {
      const base = baseOf(previous);
      if (base === null) return null;
      return markDraft(base, key, base.marks[key] === next ? null : next);
    });

  const canSave = shown !== null && allMarked(shown, keys);
  const save = () => {
    if (shown === null || today === null || !allMarked(shown, keys)) return;
    const results = draftResults(shown, keys);
    setProgress((p) => {
      const writing = applyPage(p.writing, results, today);
      // A repeat of a page that is already saved changes nothing, so it must not be counted twice in the day log.
      if (writing === p.writing) return p;
      return { ...p, writing, writingLog: recordWritingDay(p.writingLog, today, results) };
    });
    setSaved({ day: today, ok: results.filter((r) => r.right).length, total: results.length });
    setDraft(null);
  };

  // "Write 3 more": a new page from what the picker still offers today (attempted kanji are already left out).
  const writeMore = () => {
    if (today === null || more.length === 0) return;
    setDraft(
      newDraft(
        today,
        more.map((pick) => pick.key),
      ),
    );
  };

  // "Choose by meaning": the ticked kanji, in list order, become the page.
  const toggleTick = (key: string) =>
    setTicked((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
    );
  const writeChosen = () => {
    if (today === null || tickedNow.length === 0) return;
    setDraft(
      newDraft(
        today,
        tickedNow.map((choice) => choice.key),
      ),
    );
    setTicked([]);
  };

  const dismissIntro = () => {
    update(withIntro);
    headingRef.current?.focus();
  };

  const announce =
    view === "write"
      ? `Today's page, ${cards.length} kanji. Write them on paper.`
      : view === "reveal"
        ? "Compare with your page. Mark each kanji."
        : view === "done"
          ? doneText
          : "";

  // The collapsed "Choose by meaning" list (empty when there is nothing to choose from).
  const chooseList =
    choices.length > 0 ? (
      <details className="mt-5 rounded-xl border border-border/60 bg-glass/50 p-4">
        <summary
          className={`cursor-pointer rounded-md py-2 font-display text-base text-foreground ${focusRing}`}
        >
          Choose by meaning
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Pick 1 to {DRAFT_MAX_KEYS} kanji by what they mean. The characters stay hidden until you
          compare.
        </p>
        <ul className="mt-3 max-h-88 space-y-2 overflow-y-auto pr-1">
          {choices.map((choice) => {
            const checked = ticked.includes(choice.key);
            return (
              <ChoiceRow
                key={choice.key}
                item={choice.kanji}
                state={choice.state}
                checked={checked}
                disabled={!checked && tickedNow.length >= DRAFT_MAX_KEYS}
                onToggle={() => toggleTick(choice.key)}
              />
            );
          })}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={writeChosen}
            disabled={tickedNow.length === 0}
            className={primaryButton}
          >
            Write these
          </button>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {tickedNow.length} of {DRAFT_MAX_KEYS} picked
          </p>
        </div>
      </details>
    ) : null;

  return (
    <section
      aria-label="Writing practice"
      className="glass-panel pane-in mx-auto max-w-3xl rounded-xl p-5 md:p-6"
    >
      <span className={labelClass}>書く · WRITE</span>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      {showIntro && (
        <div
          role="note"
          className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3"
        >
          <p className="text-xs text-foreground">
            Write the answers on paper, from memory. Kiroku shows what to write; you do the writing.
          </p>
          <button
            type="button"
            onClick={dismissIntro}
            className={`hit-area shrink-0 rounded-md border border-border px-2.5 py-1.5 text-xs text-foreground transition-colors motion-reduce:transition-none hover:bg-accent ${focusRing}`}
          >
            Got it
          </button>
        </div>
      )}

      {view === "no-kanji" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            Save a lesson with kanji first, then there is something to write.
          </p>
          <button type="button" onClick={onOpenStudio} className={`mt-4 ${primaryButton}`}>
            Open the Studio
          </button>
        </div>
      )}

      {view === "empty" && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            {choices.length > 0
              ? "Nothing to write right now. Come back after your next lesson, or choose by meaning below."
              : "Nothing to write right now. Come back after your next lesson."}
          </p>
          <button type="button" onClick={onBack} className={`mt-4 ${quietButton}`}>
            Back to lessons
          </button>
          {chooseList}
        </div>
      )}

      {view === "done" && (
        <div className="mt-3">
          <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
            {doneText}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {more.length > 0
              ? "Write more whenever you like, or come back tomorrow."
              : choices.length > 0
                ? "Nothing more to write right now. Come back after your next lesson, or choose by meaning below."
                : "Nothing more to write right now. Come back after your next lesson."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {more.length > 0 && (
              <button type="button" onClick={writeMore} className={primaryButton}>
                Write {Math.min(WRITING_PAGE_SIZE, more.length)} more
              </button>
            )}
            <button
              type="button"
              onClick={onBack}
              className={more.length > 0 ? quietButton : primaryButton}
            >
              Back to lessons
            </button>
          </div>
          {more.length === 0 && chooseList}
        </div>
      )}

      {(view === "write" || view === "reveal") && shown !== null && (
        <div className="mt-3">
          <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
            {view === "write" ? `Today's page · ${cards.length} kanji` : "Compare with your page"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {view === "write"
              ? `On paper, write the kanji for each cue. Number your answers ${cards
                  .map((card) => card.n)
                  .join(", ")}. No peeking: the check comes next.`
              : "Look at what you wrote, then mark each kanji. Your marks are what Kiroku remembers."}
          </p>
          <ol className="mt-5 space-y-4">
            {cards.map(({ n, entry }) => (
              <PageCard
                key={entry.key}
                n={n}
                item={entry.kanji}
                known={known}
                revealed={view === "reveal"}
                mark={shown.marks[entry.key]}
                onMark={(next) => setMark(entry.key, next)}
              />
            ))}
          </ol>
          {view === "write" ? (
            <button type="button" onClick={reveal} className={`mt-6 ${primaryButton}`}>
              I&apos;ve written them
            </button>
          ) : (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={!canSave}
                aria-describedby="write-save-hint"
                className={primaryButton}
              >
                Save this page
              </button>
              <p id="write-save-hint" className="text-xs text-muted-foreground">
                {markedCount(shown, keys)} of {keys.length} marked
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
