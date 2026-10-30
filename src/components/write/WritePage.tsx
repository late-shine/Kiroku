// Writing quests, Phase Q2 — the Write page: a MODE of the shell (like Profile), shown only while writing practice is on.
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
// midnight) and saving clears it. After a save the page says it is done for today: today's attempted kanji never come
// back the same day.
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PageCard } from "@/components/write/PageCard";
import type { QuestPrefsApi } from "@/components/write/useQuestPrefs";
import { useToday } from "@/hooks/use-today";
import {
  allMarked,
  draftForDay,
  draftResults,
  markDraft,
  markedCount,
  newDraft,
  resolveDraft,
  revealDraft,
  type WritingDraft,
  type WritingMark,
} from "@/lib/quest-prefs";
import { applyPage, knownKanji, pickPage, poolKanji, recordWritingDay } from "@/lib/writing";
import type { DayLesson, UserProgressState } from "@/types/japanese";

const labelClass = "font-display text-xs font-semibold tracking-wider text-primary";
const headingClass = "font-display text-2xl text-foreground focus-visible:outline-none";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const primaryButton = `hit-area rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors motion-reduce:transition-none hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;
const quietButton = `hit-area rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground transition-colors motion-reduce:transition-none hover:bg-accent hover:text-foreground ${focusRing}`;

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
  const { prefs, loaded, setDraft } = quests;

  const pool = useMemo(() => poolKanji(lessons), [lessons]);
  const known = useMemo(() => knownKanji(lessons), [lessons]);

  // The stored page, only while it belongs to today.
  const stored = today === null ? null : draftForDay(prefs.draft, today);
  const dayEntry = today === null ? undefined : progress.writingLog[today];
  const savedToday = (dayEntry?.n ?? 0) > 0;

  // With no page yet, today's page is picked now (deterministic: same lessons and records, same page). Nothing is
  // picked once a page is saved for today, or while a page is already open.
  const picked = useMemo(
    () =>
      loaded && today !== null && stored === null && !savedToday
        ? pickPage(lessons, progress.writing, today)
        : [],
    [loaded, today, stored, savedToday, lessons, progress.writing],
  );
  const provisional = useMemo(
    () =>
      today !== null && picked.length > 0
        ? newDraft(
            today,
            picked.map((p) => p.key),
          )
        : null,
    [today, picked],
  );
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

  // What the done step says: the numbers just saved, or (after a reload) the day's log.
  const doneNumbers =
    saved !== null && saved.day === today
      ? { ok: saved.ok, total: saved.total }
      : { ok: dayEntry?.ok ?? 0, total: dayEntry?.n ?? 0 };

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

  const announce =
    view === "write"
      ? `Today's page, ${cards.length} kanji. Write them on paper.`
      : view === "reveal"
        ? "Compare with your page. Mark each kanji."
        : view === "done"
          ? `Saved. ${doneNumbers.ok} of ${doneNumbers.total} written right.`
          : "";

  return (
    <section
      aria-label="Writing practice"
      className="glass-panel pane-in mx-auto max-w-3xl rounded-xl p-5 md:p-6"
    >
      <span className={labelClass}>書く · WRITE</span>
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

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
            Nothing to write right now. Come back after your next lesson.
          </p>
          <button type="button" onClick={onBack} className={`mt-4 ${quietButton}`}>
            Back to lessons
          </button>
        </div>
      )}

      {view === "done" && (
        <div className="mt-3">
          <h2 ref={headingRef} tabIndex={-1} className={headingClass}>
            Saved. {doneNumbers.ok} of {doneNumbers.total} written right.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            That&apos;s today&apos;s page. Come back tomorrow for the next one.
          </p>
          <button type="button" onClick={onBack} className={`mt-4 ${primaryButton}`}>
            Back to lessons
          </button>
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
