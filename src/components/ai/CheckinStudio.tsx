import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardPaste,
  Copy,
  FileCheck2,
  MessageCircle,
  NotebookPen,
  Trash2,
} from "lucide-react";
import type { DayLesson, UserProgressState } from "@/types/japanese";
import {
  buildCheckinPrompt,
  checkinSuggestion,
  createCheckinSession,
  lessonRangeLabel,
  MAX_CHECKIN_RECORD_CHARS,
  parseCheckinResult,
  selectCheckinLessons,
  type CheckinRecord,
  type CheckinResult,
  type CheckinScope,
} from "@/lib/checkin";
import { CheckinJournal, CheckinResultView } from "@/components/progress/CheckinJournal";
import type { CheckinPrefsController } from "./useCheckinPrefs";
import "./checkin.css";

type Props = {
  lessons: DayLesson[];
  progress: UserProgressState;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onSave: (record: CheckinRecord) => string | null;
  onBack: () => void;
  backLabel: string;
  onOpenLessons: () => void;
  onOpenProfile: () => void;
  preferences: CheckinPrefsController;
};

export function CheckinStudio({
  lessons,
  progress,
  selectedId,
  onSelect,
  onSave,
  onBack,
  backLabel,
  onOpenLessons,
  onOpenProfile,
  preferences,
}: Props) {
  const [scope, setScope] = useState<CheckinScope>(() =>
    lessons.some((lesson) => progress.completedDays.includes(lesson.dayNumber))
      ? "recent"
      : "range",
  );
  const [chosenFrom, setFrom] = useState<number | null>(null);
  const [chosenTo, setTo] = useState<number | null>(null);
  const from = lessons.some((lesson) => lesson.dayNumber === chosenFrom)
    ? chosenFrom!
    : (lessons[0]?.dayNumber ?? 1);
  const to = lessons.some((lesson) => lesson.dayNumber === chosenTo)
    ? chosenTo!
    : (lessons[lessons.length - 1]?.dayNumber ?? 1);
  const [count, setCount] = useState<5 | 10>(5);
  const [step, setStep] = useState<"copy" | "import">("copy");
  const [pasted, setPasted] = useState("");
  const [preview, setPreview] = useState<CheckinResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmDelete) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [confirmDelete]);
  const selected = selectedId ? progress.checkins?.[selectedId] : undefined;
  const active = selected && selected.status !== "deleted" ? selected : null;
  const included = useMemo(
    () => selectCheckinLessons(lessons, progress.completedDays, scope, from, to),
    [lessons, progress.completedDays, scope, from, to],
  );
  const prompt = useMemo(() => (active ? buildCheckinPrompt(active.session) : ""), [active]);
  useEffect(() => {
    setStep("copy");
    setPasted("");
    setPreview(null);
    setError("");
    setCopied(false);
    setConfirmDelete(false);
  }, [selectedId]);
  useEffect(() => {
    if (selected?.status === "deleted" || (selectedId && !selected)) {
      setPasted("");
      setPreview(null);
    }
  }, [selected, selectedId]);
  const start = () => {
    const created = createCheckinSession(included, progress, count);
    if (!created.ok) {
      setError(created.error);
      return;
    }
    const failure = onSave({ status: "pending", session: created.session });
    if (failure) {
      setError(failure);
      return;
    }
    onSelect(created.session.id);
    window.scrollTo({ top: 0 });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setError("");
    } catch {
      setError("Clipboard access was blocked. Select and copy the prompt below manually.");
    }
  };
  const validate = () => {
    if (!active || active.status !== "pending") return;
    const parsed = parseCheckinResult(pasted, active.session);
    if (!parsed.ok) {
      setError(parsed.error);
      setPreview(null);
      return;
    }
    setError("");
    setPreview(parsed.result);
  };
  const save = () => {
    if (!active || active.status !== "pending" || !preview) return;
    const failure = onSave({
      status: "complete",
      session: active.session,
      result: preview,
      savedAt: new Date().toISOString(),
    });
    if (failure) {
      setError(failure);
      return;
    }
    setPreview(null);
    setPasted("");
    setError("");
    window.scrollTo({ top: 0 });
  };
  const remove = () => {
    if (!active) return;
    const failure = onSave({
      status: "deleted",
      id: active.session.id,
      deletedAt: new Date().toISOString(),
    });
    if (failure) {
      setError(failure);
      return;
    }
    setConfirmDelete(false);
    setError("");
    onSelect(null);
  };
  const totalItems = included.reduce(
    (n, l) => n + l.vocab.length + l.kanji.length + l.grammar.length + 1,
    0,
  );
  const currentStep = !active
    ? 1
    : active.status === "complete" || preview
      ? 3
      : step === "copy"
        ? 2
        : 3;
  return (
    <div className="checkin">
      <div className="ci-topline">
        <button className="ci-back" onClick={onBack}>
          <ArrowLeft size={15} /> {backLabel}
        </button>
        <nav aria-label="Check-in steps" className="ci-stepper">
          <div className="ci-step" aria-current={currentStep === 1 ? "step" : undefined}>
            <span>1</span>
            <span>Choose lessons</span>
          </div>
          <i />
          <div className="ci-step" aria-current={currentStep === 2 ? "step" : undefined}>
            <span>2</span>
            <span>Meet your AI</span>
          </div>
          <i />
          <div className="ci-step" aria-current={currentStep === 3 ? "step" : undefined}>
            <span>3</span>
            <span>Keep the result</span>
          </div>
        </nav>
      </div>
      {!active && lessons.length === 0 ? (
        <section className="glass-panel ci-no-lessons">
          <BookOpen size={28} className="text-primary" aria-hidden="true" />
          <p className="ci-eyebrow mt-5">AI check-in</p>
          <h1 className="ci-heading mt-3">Add a lesson to begin.</h1>
          <p className="ci-subtitle mt-4">
            Check-ins use your saved lessons. Create or import your first lesson in AI Lesson
            Studio, then come back to choose what to practise.
          </p>
          <div className="ci-actions">
            <button className="ci-primary" onClick={onOpenLessons}>
              Open Lesson Studio <ArrowRight size={16} />
            </button>
            <button className="ci-secondary" onClick={onOpenProfile}>
              Open Profile
            </button>
          </div>
          <p className="ci-note mt-5">
            Already have a backup or a synced account? Restore it in Profile → Desk &amp; Account.
            Any past check-ins remain available in your journal below, even if their lessons were
            removed.
          </p>
        </section>
      ) : !active ? (
        <div className="glass-panel ci-folio">
          <section className="ci-left">
            <p className="ci-eyebrow">振り返り · AI check-in</p>
            <h1 className="ci-heading mt-4">
              See what
              <br />
              stays with you.
            </h1>
            <p className="ci-subtitle mt-4">
              A few thoughtful questions, drawn from your own lessons. Your AI asks. You answer.
              Kiroku keeps the story.
            </p>
            <fieldset className="ci-section">
              <legend className="ci-label">Which lessons would you like to revisit?</legend>
              <div className="ci-choices">
                {(
                  [
                    { id: "recent", title: "Latest five", note: "Completed lessons" },
                    { id: "all", title: "All completed", note: "The bigger picture" },
                    { id: "range", title: "Choose a range", note: "By lesson number" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    className="ci-choice"
                    aria-pressed={scope === option.id}
                    onClick={() => {
                      setScope(option.id);
                      setError("");
                    }}
                  >
                    {option.title}
                    <small>{option.note}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            {scope === "range" && (
              <div className="ci-range">
                <label className="ci-label">
                  From lesson
                  <select
                    className="ci-input mt-2"
                    value={from}
                    onChange={(e) => {
                      setFrom(Number(e.target.value));
                      setError("");
                    }}
                  >
                    {lessons.map((l) => (
                      <option key={l.dayNumber} value={l.dayNumber}>
                        Day {l.dayNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ci-label">
                  Through lesson
                  <select
                    className="ci-input mt-2"
                    value={to}
                    onChange={(e) => {
                      setTo(Number(e.target.value));
                      setError("");
                    }}
                  >
                    {lessons.map((l) => (
                      <option key={l.dayNumber} value={l.dayNumber}>
                        Day {l.dayNumber}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="ci-note col-span-2">
                  Lesson numbers, not calendar dates. Includes saved lessons in this range, even if
                  not marked done; missing days are skipped.
                </p>
              </div>
            )}
            <fieldset className="ci-section">
              <legend className="ci-label">How much space do you have today?</legend>
              <div className="ci-length">
                <button
                  className="ci-choice"
                  aria-pressed={count === 5}
                  onClick={() => setCount(5)}
                >
                  5 questions
                </button>
                <button
                  className="ci-choice"
                  aria-pressed={count === 10}
                  onClick={() => setCount(10)}
                >
                  10 questions
                </button>
              </div>
            </fieldset>
            <p className="ci-note mt-5" aria-live="polite">
              {included.length} saved {included.length === 1 ? "lesson" : "lessons"} selected ·{" "}
              {count} questions
            </p>
            <div className="ci-actions">
              <button
                className="ci-primary"
                onClick={start}
                disabled={included.length === 0 || included.length > 20}
              >
                Create check-in <ArrowRight size={16} />
              </button>
            </div>
            <p className="ci-note mt-3">
              No timer. No API key. Nothing is sent to an AI until you paste it there.
            </p>
            {error && (
              <p className="ci-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <aside className="ci-right">
            <div className="ci-ribbon" aria-hidden="true" />
            <p className="ci-eyebrow">Inside this check-in</p>
            <h2 className="font-display text-2xl mt-4">Your lesson folio</h2>
            <p className="ci-note mt-2">
              {included.length} {included.length === 1 ? "lesson" : "lessons"} · {totalItems} source
              items · {count} questions
            </p>
            {included.length ? (
              <div className="ci-lesson-list">
                {included.map((l) => (
                  <div className="ci-lesson" key={l.dayNumber}>
                    <span className="ci-day">{l.dayNumber}</span>
                    <div>
                      <p className="ci-lesson-title">{l.title}</p>
                      <p className="ci-note">
                        {l.grammar.length} grammar · {l.vocab.length} words · {l.kanji.length} kanji
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-8 mb-8">
                <BookOpen className="text-primary mb-4" size={28} />
                <p className="ci-subtitle">
                  {lessons.length
                    ? scope === "range"
                      ? "Choose a starting lesson no later than the ending lesson."
                      : "No completed lessons yet. Mark a lesson done, or choose a range of saved lessons."
                    : "Your saved lessons will appear here. Start with a lesson, then come back when you’re ready."}
                </p>
              </div>
            )}
            {included.length > 20 && (
              <p className="ci-error">
                Choose a range of 20 lessons or fewer to keep the prompt manageable.
              </p>
            )}
            <div className="ci-mix">
              {["Grammar in use", "Word recall", "Kanji", "Natural responses"].map((label) => (
                <span className="ci-chip" key={label}>
                  {label}
                </span>
              ))}
            </div>
            <p className="ci-note mt-5">
              A balanced sample—not a question for every item. Recently repeated vocabulary misses
              may get a little extra attention.
            </p>
          </aside>
        </div>
      ) : active.status === "complete" ? (
        <>
          <div className="ci-journal-head">
            <div>
              <p className="ci-eyebrow">
                Saved{" "}
                {new Date(active.savedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
              <h1 className="font-display text-2xl mt-2">Your check-in, kept.</h1>
            </div>
            <button className="ci-secondary" onClick={() => onSelect(null)}>
              New check-in <ArrowRight size={15} />
            </button>
          </div>
          <CheckinResultView session={active.session} result={active.result} />
          <p className="ci-note mt-4">
            Saved in Progress → Check-in journal, included in backup exports and account sync when
            linked and enabled. Later lesson edits or deletions do not rewrite this record.
          </p>
        </>
      ) : preview ? (
        <>
          <CheckinResultView session={active.session} result={preview} preview />
          <div className="ci-actions">
            <button className="ci-primary" onClick={save}>
              <FileCheck2 size={16} />
              Save to journal
            </button>
            <button className="ci-secondary" onClick={() => setPreview(null)}>
              Back to reply
            </button>
          </div>
          <p className="ci-note mt-3">
            Check that the answers really are yours before saving. Nothing in this preview has been
            added to your journal yet.
          </p>
          {error && (
            <p className="ci-error" role="alert">
              {error}
            </p>
          )}
        </>
      ) : (
        <div className="glass-panel ci-folio">
          <section className="ci-left">
            <p className="ci-eyebrow">
              {lessonRangeLabel(active.session)} · {active.session.questionCount} questions
            </p>
            <h1 className="ci-heading mt-4">
              {step === "copy"
                ? "A conversation,\nnot a countdown."
                : "Bring the learning\nback home."}
            </h1>
            <p className="ci-subtitle mt-4">
              {step === "copy"
                ? "Copy your prompt into a fresh chat with your preferred AI. It will ask the questions first and wait for you."
                : "After you send SUBMIT in a separate message, your AI returns a review and a Kiroku block. Paste the final reply below."}
            </p>
            <div className="ci-actions mb-5">
              <button
                className={step === "copy" ? "ci-primary" : "ci-secondary"}
                onClick={() => {
                  setStep("copy");
                  setError("");
                }}
              >
                Copy prompt
              </button>
              <button
                className={step === "import" ? "ci-primary" : "ci-secondary"}
                onClick={() => {
                  setStep("import");
                  setError("");
                }}
              >
                Paste result
              </button>
            </div>
            {step === "copy" ? (
              <>
                <label className="ci-label" htmlFor="checkin-prompt">
                  Your prompt · {prompt.length.toLocaleString()} characters
                </label>
                <textarea
                  id="checkin-prompt"
                  className="ci-input ci-prompt"
                  value={prompt}
                  readOnly
                  spellCheck={false}
                />
                <div className="ci-actions">
                  <button className="ci-primary" onClick={() => void copy()}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                    {copied ? "Copied to clipboard" : "Copy full prompt"}
                  </button>
                </div>
                <p className="ci-note mt-3" role="status">
                  {copied
                    ? "Open your AI chat and paste. This check-in is saved so you can return later."
                    : "Only Japanese words, kanji, grammar titles and expressions—no readings, meanings, lesson explanations, profile or API key."}
                </p>
              </>
            ) : (
              <>
                <label className="ci-label" htmlFor="checkin-reply">
                  Final AI reply
                </label>
                <textarea
                  id="checkin-reply"
                  className="ci-input ci-reply"
                  placeholder="Paste the final assessment, including the kiroku-checkin block…"
                  value={pasted}
                  maxLength={MAX_CHECKIN_RECORD_CHARS}
                  onChange={(e) => {
                    setPasted(e.target.value);
                    setPreview(null);
                    setError("");
                  }}
                  spellCheck={false}
                />
                <div className="ci-actions">
                  <button className="ci-primary" disabled={!pasted.trim()} onClick={validate}>
                    <FileCheck2 size={16} />
                    Preview result
                  </button>
                </div>
                <p className="ci-note mt-3">
                  The questions alone cannot be imported. Finish the conversation and submit your
                  answers first.
                </p>
              </>
            )}
            {error && (
              <p className="ci-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <aside className="ci-right">
            <div className="ci-ribbon" aria-hidden="true" />
            <p className="ci-eyebrow">The conversation</p>
            <h2 className="font-display text-2xl mt-4">Take your time.</h2>
            <div className="ci-instruction">
              <MessageCircle size={20} />
              <div>
                <strong>Questions first</strong>
                <p>
                  The AI asks all {active.session.questionCount} questions without showing the
                  answers. Use a fresh chat to keep the instructions clear.
                </p>
              </div>
            </div>
            <div className="ci-instruction">
              <NotebookPen size={20} />
              <div>
                <strong>Your own words</strong>
                <p>
                  Reply with question numbers, in one message or several. Before submitting, you can
                  revise an answer; your latest numbered version counts. You can skip an item or ask
                  for a hint. Assisted answers are labelled.
                </p>
              </div>
            </div>
            <div className="ci-instruction">
              <ClipboardPaste size={20} />
              <div>
                <strong>Send SUBMIT when you’re ready</strong>
                <p>
                  Send only SUBMIT in a separate message. The AI then reviews your answers and
                  produces the final block to paste here.
                </p>
              </div>
            </div>
            <div className="ci-section border-t border-border pt-5">
              <p className="ci-note">
                Full credit: 2 points · Partial: 1 · Missed/skipped: 0<br />
                Assisted answers: at most 1 point
              </p>
              <p className="ci-note mt-3">
                This prompt can guide an AI, not guarantee its judgment. If it loses earlier
                messages, paste the original questions and answers when asked, then send SUBMIT
                again. Do not accept a result based on guessed answers.
              </p>
            </div>
            <p className="ci-note mt-5 break-all">Session {active.session.id.slice(3, 11)}</p>
          </aside>
        </div>
      )}
      {active && (
        <div className="ci-actions">
          <button className="ci-back" onClick={() => onSelect(null)}>
            <BookOpen size={15} /> All check-ins
          </button>
          <button
            className="ci-back ml-auto"
            onClick={() => {
              setError("");
              setConfirmDelete(true);
            }}
          >
            <Trash2 size={14} />
            {active.status === "pending" ? "Discard check-in" : "Delete result"}
          </button>
        </div>
      )}
      {!active &&
        (lessons.length > 0 ||
          Object.values(progress.checkins ?? {}).some((record) => record.status !== "deleted")) && (
          <CheckinJournal
            records={progress.checkins ?? {}}
            onOpen={onSelect}
            onNew={() => {
              onSelect(null);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      <CheckinPreferences preferences={preferences} />
      <dialog
        ref={deleteDialog}
        className="ci-delete-dialog"
        aria-labelledby="ci-delete-title"
        onCancel={() => setConfirmDelete(false)}
      >
        <h2 id="ci-delete-title" className="font-display text-xl">
          {active?.status === "pending" ? "Discard this check-in?" : "Delete this result?"}
        </h2>
        <p className="ci-subtitle mt-3">
          This removes the check-in and its answers from your journal and optional account sync.
          Your lessons and quiz progress stay untouched.
        </p>
        {confirmDelete && error && (
          <p className="ci-error" role="alert">
            {error}
          </p>
        )}
        <div className="ci-actions">
          <button className="ci-secondary" autoFocus onClick={() => setConfirmDelete(false)}>
            Keep it
          </button>
          <button className="ci-primary" onClick={remove}>
            Delete check-in
          </button>
        </div>
      </dialog>
    </div>
  );
}

export function CheckinPreferences({ preferences }: { preferences: CheckinPrefsController }) {
  return (
    <div className="checkin ci-settings">
      <div>
        <label>
          <input
            type="checkbox"
            checked={preferences.prefs.enabled}
            disabled={!preferences.loaded}
            onChange={(e) => preferences.setEnabled(e.target.checked)}
          />
          Gentle check-in reminders
        </label>
        <p className="ci-note">
          Suggested in AI Lesson Studio after five more completed lessons. Device-only; no push
          notifications.
        </p>
        {preferences.prefs.enabled && preferences.prefs.snoozedUntil > Date.now() && (
          <p className="ci-note">
            Paused until {new Date(preferences.prefs.snoozedUntil).toLocaleDateString()}.
          </p>
        )}
      </div>
      {preferences.prefs.enabled && (
        <button
          className="ci-back"
          onClick={() =>
            preferences.prefs.snoozedUntil > Date.now()
              ? preferences.setEnabled(true)
              : preferences.snooze()
          }
        >
          {preferences.prefs.snoozedUntil > Date.now() ? "Resume reminders" : "Remind me in a week"}
        </button>
      )}
      {preferences.error && (
        <p className="ci-error" role="alert">
          {preferences.error}
        </p>
      )}
    </div>
  );
}

export function CheckinEntry({
  lessons,
  progress,
  preferences,
  selectedId,
  onOpen,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  preferences: CheckinPrefsController;
  selectedId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const pending = Object.values(progress.checkins ?? {})
    .filter((record) => record.status === "pending")
    .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt));
  const resumable = pending.find((record) => record.session.id === selectedId) ?? pending[0];
  const suggested =
    preferences.loaded &&
    preferences.prefs.enabled &&
    preferences.prefs.snoozedUntil <= Date.now() &&
    checkinSuggestion(lessons, progress) > 0;
  return (
    <button
      type="button"
      className="social-link ci-studio-entry"
      onClick={() => onOpen(resumable?.session.id ?? null)}
    >
      {resumable ? "Resume check-in" : suggested ? "Check-in suggested" : "AI check-in"}
      <ArrowUpRight aria-hidden="true" />
    </button>
  );
}
