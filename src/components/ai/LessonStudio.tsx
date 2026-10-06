import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import {
  JLPT_LEVELS,
  MODE_HINTS,
  MODE_LABELS,
  STYLE_LABELS,
  TONE_LABELS,
  VOCAB_COUNTS,
  buildLessonPrompt,
  buildRepairPrompt,
  buildSaveOnlyPrompt,
  reviewWordsForPrompt,
  type JlptLevel,
  type LessonStyle,
  type PromptMode,
  type Tone,
  type VocabCount,
} from "@/lib/prompt-builder";
import { detectDayNumber, parseLessonFromText, stripDayPrefix } from "@/lib/lesson-schema";
import { readGeminiRefusal, type GeminiAttempt } from "@/lib/gemini-fallback";
import {
  GEMINI_ATTEMPT_TIMEOUT_MS,
  GEMINI_MODEL_CHAIN,
  rotateChainAfter,
} from "@/lib/gemini-models";
import { relayGemini } from "@/lib/gemini-relay";
import { TipCard } from "@/components/tips/TipCard";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";
import type { DayLesson, UserProgressState } from "@/types/japanese";

const STORAGE_KEY = STORAGE_KEYS.aiStudio;
// BYOK: the user's Gemini key lives only here, in this browser. Kept under its own key (not inside
// the studio-options JSON) so it's never bundled with anything that might get exported or shared.
const GEMINI_KEY_STORAGE = STORAGE_KEYS.geminiKey;

function loadGeminiKey(): string {
  if (typeof window === "undefined") return "";
  migrateLegacyStorage();
  try {
    return localStorage.getItem(GEMINI_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

interface StoredOptions {
  tone: Tone;
  style: LessonStyle;
  level: JlptLevel;
  vocabCount: VocabCount;
  romaji: boolean;
  customFocus: string;
  mode: PromptMode;
}

const DEFAULTS: StoredOptions = {
  tone: "gentle",
  style: "balanced",
  level: "N5",
  vocabCount: 10,
  romaji: false,
  customFocus: "",
  mode: "learn-save",
};

function loadStored(): StoredOptions {
  if (typeof window === "undefined") return DEFAULTS;
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      tone: parsed.tone in TONE_LABELS ? parsed.tone : DEFAULTS.tone,
      style: parsed.style in STYLE_LABELS ? parsed.style : DEFAULTS.style,
      level: JLPT_LEVELS.includes(parsed.level) ? parsed.level : DEFAULTS.level,
      vocabCount: (VOCAB_COUNTS as readonly number[]).includes(parsed.vocabCount)
        ? parsed.vocabCount
        : DEFAULTS.vocabCount,
      romaji: typeof parsed.romaji === "boolean" ? parsed.romaji : DEFAULTS.romaji,
      customFocus:
        typeof parsed.customFocus === "string" ? parsed.customFocus : DEFAULTS.customFocus,
      // Older saved options predate mode (Phase 3b) — falls back to the default for anyone upgrading.
      mode: parsed.mode in MODE_LABELS ? parsed.mode : DEFAULTS.mode,
    };
  } catch {
    return DEFAULTS;
  }
}

type Step = "configure" | "copy" | "import";

const AI_LINKS = [
  { label: "ChatGPT", url: "https://chatgpt.com/" },
  { label: "Claude", url: "https://claude.ai/new" },
  { label: "Gemini", url: "https://gemini.google.com/app" },
];

function OptionGrid<T extends string | number>({
  value,
  options,
  labels,
  onChange,
  cols = 2,
}: {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  cols?: 2 | 3;
}) {
  return (
    <div className={`grid gap-2 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
            value === opt
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export function LessonStudio({
  lessons,
  progress,
  showTip,
  onDismissTip,
  onClose,
  onImport,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  /** Phase 11b: whether to show the "Three steps" tip at the top of Configure, and how to dismiss it. */
  showTip: boolean;
  onDismissTip: () => void;
  onClose: () => void;
  onImport: (lesson: DayLesson) => void;
}) {
  const initial = useRef(loadStored()).current;
  const highestDay = Math.max(...lessons.map((l) => l.dayNumber), 0);

  const [step, setStep] = useState<Step>("configure");
  const [day, setDay] = useState(highestDay + 1);
  const [tone, setTone] = useState<Tone>(initial.tone);
  const [style, setStyle] = useState<LessonStyle>(initial.style);
  const [level, setLevel] = useState<JlptLevel>(initial.level);
  const [vocabCount, setVocabCount] = useState<VocabCount>(initial.vocabCount);
  const [romaji, setRomaji] = useState(initial.romaji);
  const [customFocus, setCustomFocus] = useState(initial.customFocus);
  const [mode, setMode] = useState<PromptMode>(initial.mode);
  const [existingLessonText, setExistingLessonText] = useState("");

  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [importResult, setImportResult] = useState<ReturnType<typeof parseLessonFromText> | null>(
    null,
  );

  // Phase 3c — optional Gemini helpers. Everything here is additive: the manual flow never needs it.
  const [geminiKey, setGeminiKey] = useState(loadGeminiKey);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiTrail, setGeminiTrail] = useState<GeminiAttempt[]>([]);
  const [fromGemini, setFromGemini] = useState(false);
  // Which Gemini action last ran, so "Try another model" knows what to re-run.
  const [lastGeminiAction, setLastGeminiAction] = useState<"fix" | "save" | null>(null);
  // Bumped on every run and on Cancel; a run whose id no longer matches has been cancelled, so its result is dropped.
  const geminiRunId = useRef(0);

  useEffect(() => {
    const toStore: StoredOptions = { tone, style, level, vocabCount, romaji, customFocus, mode };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      /* storage unavailable — ignore */
    }
  }, [tone, style, level, vocabCount, romaji, customFocus, mode]);

  const prompt = useMemo(
    () =>
      buildLessonPrompt({
        day,
        tone,
        style,
        level,
        vocabCount,
        romaji,
        customFocus,
        lessons,
        progress,
        mode,
        existingLessonText,
      }),
    [
      day,
      tone,
      style,
      level,
      vocabCount,
      romaji,
      customFocus,
      lessons,
      progress,
      mode,
      existingLessonText,
    ],
  );

  // Phase 14c: how many due-for-review words this prompt carries (Save only never includes them).
  const reviewInPrompt = useMemo(
    () => (mode === "save-only" ? 0 : reviewWordsForPrompt(day, lessons, progress).length),
    [mode, day, lessons, progress],
  );

  const copyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runExtract = () => {
    setFromGemini(false);
    setImportResult(parseLessonFromText(pasted));
  };

  const saveGeminiKey = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setGeminiKey(trimmed);
    try {
      localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    } catch {
      /* storage unavailable — the key just won't survive a reload */
    }
  };

  const removeGeminiKey = () => {
    setGeminiKey("");
    try {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
      // The migration copied the key and left the old one in place; "Remove key" must clear that copy too.
      localStorage.removeItem(LEGACY_STORAGE_KEYS.geminiKey);
    } catch {
      /* ignore */
    }
  };

  /** Sends one prompt through the relay. Returns Gemini's text, or null after setting an error message (or on cancel). */
  const runGemini = async (geminiPrompt: string, startAfter: string): Promise<string | null> => {
    if (geminiBusy) return null;
    const runId = ++geminiRunId.current;
    setGeminiBusy(true);
    setGeminiError(null);
    setGeminiTrail([]);
    try {
      const res = await relayGemini({
        data: { apiKey: geminiKey, prompt: geminiPrompt, startAfter },
      });
      if (runId !== geminiRunId.current) return null; // cancelled while waiting
      setGeminiTrail(res.attempts);
      if (!res.ok) {
        setGeminiError(res.message);
        return null;
      }
      return res.text;
    } catch {
      if (runId !== geminiRunId.current) return null;
      setGeminiError(
        "Couldn't reach Kiroku's Gemini relay. Check your connection and try again — manual copy/paste still works.",
      );
      return null;
    } finally {
      if (runId === geminiRunId.current) setGeminiBusy(false);
    }
  };

  // Stops waiting and ignores whatever comes back. The request itself can't be recalled from the server,
  // but each model is capped at GEMINI_ATTEMPT_TIMEOUT_MS so it can't run on forever.
  const cancelGemini = () => {
    geminiRunId.current += 1;
    setGeminiBusy(false);
    setGeminiError(null);
    setGeminiTrail([]);
  };

  /** Puts Gemini's reply through the normal parse + preview flow — nothing is ever saved straight from the API. */
  const applyGeminiText = (text: string): boolean => {
    const refusal = readGeminiRefusal(text);
    if (refusal) {
      setGeminiError(`Gemini couldn't build a lesson from that text: ${refusal}`);
      return false;
    }
    setPasted(text);
    setImportResult(parseLessonFromText(text));
    setFromGemini(true);
    return true;
  };

  // Repair the day the pasted text is actually for (so ids stay d{day}-*), falling back to step 1's day.
  const repairDay = detectDayNumber(pasted) ?? day;

  // `startAfter` is "" for a normal run, or the model that just failed for "Try another model".
  const fixWithGemini = async (startAfter = "") => {
    if (!importResult || importResult.success || !pasted.trim()) return;
    setLastGeminiAction("fix");
    const text = await runGemini(
      buildRepairPrompt(repairDay, vocabCount, pasted, importResult.errors),
      startAfter,
    );
    if (text !== null) applyGeminiText(text);
  };

  const saveWithGemini = async (startAfter = "") => {
    if (!existingLessonText.trim()) return;
    setLastGeminiAction("save");
    const text = await runGemini(
      buildSaveOnlyPrompt(day, vocabCount, existingLessonText),
      startAfter,
    );
    if (text !== null && applyGeminiText(text)) setStep("import");
  };

  // Offer "Try another model" when the last attempt failed for a reason a different model could fix
  // (busy, out of quota, model missing, empty/cut-off reply) — not for a bad key, a network failure,
  // or a successful reply that Gemini itself declined to convert.
  const lastAttempt = geminiTrail[geminiTrail.length - 1];
  const canTryAnother =
    Boolean(geminiError) &&
    lastGeminiAction !== null &&
    lastAttempt !== undefined &&
    lastAttempt.outcome !== "ok" &&
    (lastAttempt.status !== null || lastAttempt.outcome === "timed-out") &&
    !(lastAttempt.status !== null && [400, 401, 403].includes(lastAttempt.status));
  const nextModel = lastAttempt
    ? rotateChainAfter(GEMINI_MODEL_CHAIN, lastAttempt.model)[0]
    : undefined;
  const tryAnotherModel = () => {
    if (!lastAttempt) return;
    if (lastGeminiAction === "fix") void fixWithGemini(lastAttempt.model);
    else if (lastGeminiAction === "save") void saveWithGemini(lastAttempt.model);
  };
  const retry: GeminiRetry | null =
    canTryAnother && nextModel
      ? { label: `Try ${nextModel}`, busy: geminiBusy, onClick: tryAnotherModel }
      : null;

  const confirmImport = () => {
    if (!importResult?.success || !importResult.lesson) return;
    const lesson = importResult.lesson;
    const alreadyExists = lessons.some((l) => l.dayNumber === lesson.dayNumber);
    if (alreadyExists && !window.confirm(`Day ${lesson.dayNumber} already exists — replace it?`))
      return;
    onImport(lesson);
  };

  const steps: { id: Step; label: string }[] = [
    { id: "configure", label: "1. Configure" },
    { id: "copy", label: "2. Copy prompt" },
    { id: "import", label: "3. Import" },
  ];

  const dayHint =
    day === 1
      ? "Foundations lesson — no assumed knowledge"
      : day > highestDay
        ? "New lesson"
        : "Existing lesson — rebuilding its prompt";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-md">
      <div className="glass-panel-strong flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between border-b border-border/50 p-5">
          <div>
            <span className="font-display text-xs font-semibold tracking-wider text-primary">
              AI LESSON STUDIO
            </span>
            <h2 className="mt-1 font-display text-xl font-medium text-foreground">
              Build Day {day}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex gap-2 border-b border-border/50 px-5 pt-2.5">
          {steps.map((s) => (
            <button
              key={s.id}
              onClick={() => setStep(s.id)}
              className={`px-3 py-2 text-xs transition-colors ${
                step === s.id
                  ? "border-b-2 border-primary text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {step === "configure" && (
            <div className="space-y-5">
              {showTip && <TipCard id="studio" onDismiss={onDismissTip} />}
              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Target day
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDay((d) => Math.max(1, d - 1))}
                    aria-label="Previous day"
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="w-20 rounded-md border border-border bg-glass px-3 py-1.5 text-center text-sm font-semibold">
                    Day {day}
                  </span>
                  <button
                    onClick={() => setDay((d) => Math.min(highestDay + 1, d + 1))}
                    aria-label="Next day"
                    className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-primary"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <span className="text-xs text-muted-foreground">{dayHint}</span>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                  Save mode
                </label>
                <OptionGrid
                  cols={3}
                  value={mode}
                  options={Object.keys(MODE_LABELS) as PromptMode[]}
                  labels={MODE_LABELS}
                  onChange={setMode}
                />
                <div className="mt-2 space-y-1 rounded-md border border-border bg-glass px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">Learn + Save</span>{" "}
                    (recommended) — {MODE_HINTS["learn-save"]}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Learn only</span> —{" "}
                    {MODE_HINTS["learn-only"]}
                  </p>
                  <p>
                    <span className="font-semibold text-foreground">Save only</span> —{" "}
                    {MODE_HINTS["save-only"]}
                  </p>
                </div>
                {reviewInPrompt > 0 && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {reviewInPrompt} word{reviewInPrompt === 1 ? "" : "s"} due for review will be
                    added to this prompt, so your AI uses {reviewInPrompt === 1 ? "it" : "them"}{" "}
                    again in new sentences.
                  </p>
                )}
              </div>

              {mode === "save-only" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Existing lesson text (optional)
                    </label>
                    <textarea
                      value={existingLessonText}
                      onChange={(e) => setExistingLessonText(e.target.value)}
                      rows={5}
                      placeholder="Paste the lesson you already learned here..."
                      className="w-full resize-none rounded-md border border-border bg-glass p-3 font-mono text-xs outline-none focus:border-primary"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      Leave this blank only if you're pasting the prompt into the <em>same</em> chat
                      that already taught you — it already has the lesson in its own history. Fill
                      it in if you're using a different or fresh AI chat (including the "Open" links
                      below, which always start empty), so nothing gets lost — or invented — in
                      between.
                    </p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Vocab count
                    </label>
                    <OptionGrid
                      cols={3}
                      value={vocabCount}
                      options={VOCAB_COUNTS}
                      labels={
                        Object.fromEntries(VOCAB_COUNTS.map((v) => [v, String(v)])) as Record<
                          VocabCount,
                          string
                        >
                      }
                      onChange={setVocabCount}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      AI sensei tone
                    </label>
                    <OptionGrid
                      value={tone}
                      options={Object.keys(TONE_LABELS) as Tone[]}
                      labels={TONE_LABELS}
                      onChange={setTone}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Lesson style
                    </label>
                    <OptionGrid
                      value={style}
                      options={Object.keys(STYLE_LABELS) as LessonStyle[]}
                      labels={STYLE_LABELS}
                      onChange={setStyle}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                        JLPT level
                      </label>
                      <OptionGrid
                        cols={3}
                        value={level}
                        options={JLPT_LEVELS}
                        labels={
                          Object.fromEntries(JLPT_LEVELS.map((l) => [l, l])) as Record<
                            JlptLevel,
                            string
                          >
                        }
                        onChange={setLevel}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                        Vocab count
                      </label>
                      <OptionGrid
                        cols={3}
                        value={vocabCount}
                        options={VOCAB_COUNTS}
                        labels={
                          Object.fromEntries(VOCAB_COUNTS.map((v) => [v, String(v)])) as Record<
                            VocabCount,
                            string
                          >
                        }
                        onChange={setVocabCount}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-md border border-border bg-glass px-3 py-2.5">
                    <span className="text-xs font-semibold text-foreground">Include romaji</span>
                    <button
                      onClick={() => setRomaji((v) => !v)}
                      aria-pressed={romaji}
                      aria-label="Toggle romaji"
                      className={`h-5 w-9 rounded-full transition-colors ${romaji ? "bg-primary" : "bg-border"}`}
                    >
                      <span
                        className={`block size-4 rounded-full bg-background transition-transform ${romaji ? "translate-x-4" : "translate-x-0.5"}`}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Custom focus (optional)
                    </label>
                    <input
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      placeholder="e.g. ordering food, asking for directions..."
                      className="w-full rounded-md border border-border bg-glass px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                  </div>
                </>
              )}

              <button
                onClick={() => setStep("copy")}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Continue to prompt →
              </button>
            </div>
          )}

          {step === "copy" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This preview updates live as you change options in step 1.
              </p>
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-background/30 p-3 text-[11px] leading-relaxed text-foreground/80">
                {prompt}
              </pre>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyPrompt}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied!" : "Copy prompt"}
                </button>
                {AI_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-primary"
                  >
                    Open {link.label} ↗
                  </a>
                ))}
              </div>

              {mode === "save-only" && (
                <div className="space-y-2 rounded-md border border-border bg-glass p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Or let Gemini do the conversion (optional)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sends the lesson text you pasted in step 1 straight to Gemini and jumps to the
                    preview — no copy/paste round trip.
                  </p>
                  <GeminiKeyPanel
                    hasKey={Boolean(geminiKey)}
                    onSave={saveGeminiKey}
                    onRemove={removeGeminiKey}
                  />
                  <button
                    onClick={() => void saveWithGemini()}
                    disabled={geminiBusy || !geminiKey || !existingLessonText.trim()}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    {geminiBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {geminiBusy ? "Asking Gemini…" : "Save with Gemini"}
                  </button>
                  {geminiBusy && <GeminiWaiting onCancel={cancelGemini} />}
                  {!existingLessonText.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      Paste the lesson text in step 1 first — Gemini has no other way to know what
                      you learned.
                    </p>
                  )}
                  <GeminiStatus error={geminiError} trail={geminiTrail} retry={retry} />
                </div>
              )}

              <button
                onClick={() => setStep("import")}
                className="w-full rounded-md border border-border py-2.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary"
              >
                Continue to import →
              </button>
            </div>
          )}

          {step === "import" && (
            <div className="space-y-3">
              <label className="block text-xs text-muted-foreground">
                Paste the AI's full reply below (the JSON code block can be anywhere in it).
              </label>
              <textarea
                value={pasted}
                onChange={(e) => {
                  setPasted(e.target.value);
                  setImportResult(null);
                  setFromGemini(false);
                }}
                rows={8}
                placeholder="Paste the AI response here..."
                className="w-full resize-none rounded-md border border-border bg-background/30 p-3 font-mono text-xs outline-none focus:border-primary"
              />
              <button
                onClick={runExtract}
                disabled={!pasted.trim()}
                className="w-full rounded-md border border-border py-2.5 text-sm font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-40"
              >
                Extract & preview
              </button>

              {importResult && !importResult.success && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <p className="font-semibold">Couldn't validate this lesson:</p>
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importResult && !importResult.success && (
                <div className="space-y-2 rounded-md border border-border bg-glass p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Stuck? Let Gemini try to fix it (optional)
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sends the text above and the errors to Gemini, using Day {repairDay}
                    {detectDayNumber(pasted)
                      ? " (the day found in your pasted text)"
                      : " (from step 1)"}{" "}
                    and {vocabCount} vocab words from step 1. You still preview the result before
                    anything is saved.
                  </p>
                  <GeminiKeyPanel
                    hasKey={Boolean(geminiKey)}
                    onSave={saveGeminiKey}
                    onRemove={removeGeminiKey}
                  />
                  <button
                    onClick={() => void fixWithGemini()}
                    disabled={geminiBusy || !geminiKey}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-40"
                  >
                    {geminiBusy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5" />
                    )}
                    {geminiBusy ? "Asking Gemini…" : "Fix with Gemini"}
                  </button>
                  {geminiBusy && <GeminiWaiting onCancel={cancelGemini} />}
                </div>
              )}

              <GeminiStatus error={geminiError} trail={geminiTrail} retry={retry} />

              {importResult?.success && importResult.lesson && (
                <ImportPreviewCard
                  lesson={importResult.lesson}
                  alreadyExists={lessons.some(
                    (l) => l.dayNumber === importResult.lesson!.dayNumber,
                  )}
                  fromGemini={fromGemini}
                  onConfirm={confirmImport}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportPreviewCard({
  lesson,
  alreadyExists,
  fromGemini,
  onConfirm,
}: {
  lesson: DayLesson;
  alreadyExists: boolean;
  fromGemini: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="rounded-md border border-primary/40 bg-primary/10 p-3 text-xs">
      <p className="font-display text-sm text-primary">
        Day {lesson.dayNumber}: {stripDayPrefix(lesson.title)}
      </p>
      <p className="mt-1 text-muted-foreground">Grammar: {lesson.grammar.title}</p>
      <p className="text-muted-foreground">
        Kanji: {lesson.kanji.character} ({lesson.kanji.meaning})
      </p>
      <p className="text-muted-foreground">{lesson.vocab.length} vocab words</p>
      {fromGemini && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Built by Gemini — skim it against the original before saving. The box above now holds
          Gemini's version.
        </p>
      )}
      <button
        onClick={onConfirm}
        className="mt-3 w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground"
      >
        {alreadyExists ? `Replace Day ${lesson.dayNumber}` : `Save Day ${lesson.dayNumber}`}
      </button>
    </div>
  );
}

const OUTCOME_LABELS: Record<GeminiAttempt["outcome"], string> = {
  ok: "worked",
  "rate-limited": "rate-limited",
  overloaded: "busy",
  "timed-out": "no answer",
  failed: "failed",
};

/** Shown while a Gemini call is in flight: how long we'll wait per model, plus a way out. */
function GeminiWaiting({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span>
        Waiting on Gemini — each model gets up to {Math.round(GEMINI_ATTEMPT_TIMEOUT_MS / 1000)}s
        before we move to the next.
      </span>
      <button
        onClick={onCancel}
        className="flex shrink-0 items-center gap-1 font-semibold underline hover:text-destructive"
      >
        <X className="size-3" />
        Cancel
      </button>
    </div>
  );
}

interface GeminiRetry {
  label: string;
  busy: boolean;
  onClick: () => void;
}

/** Shows a Gemini error and/or the "tried X, then Y" trail when the fallback chain fell through. */
function GeminiStatus({
  error,
  trail,
  retry,
}: {
  error: string | null;
  trail: GeminiAttempt[];
  retry: GeminiRetry | null;
}) {
  if (!error && trail.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}
      {trail.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Tried: {trail.map((a) => `${a.model} (${OUTCOME_LABELS[a.outcome]})`).join(" → ")}
        </p>
      )}
      {retry && (
        <button
          onClick={retry.onClick}
          disabled={retry.busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2 text-xs font-semibold text-foreground hover:border-primary hover:text-primary disabled:opacity-40"
        >
          {retry.busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          {retry.busy ? "Asking Gemini…" : `Having trouble? ${retry.label}`}
        </button>
      )}
    </div>
  );
}

/** Bring-your-own-key field. The key stays in this browser's localStorage; Kiroku's server only relays it per request. */
function GeminiKeyPanel({
  hasKey,
  onSave,
  onRemove,
}: {
  hasKey: boolean;
  onSave: (key: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");

  if (hasKey) {
    return (
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Gemini key saved in this browser.</span>
        <button
          onClick={onRemove}
          className="font-semibold text-muted-foreground underline hover:text-destructive"
        >
          Remove key
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your Gemini API key"
          className="min-w-0 flex-1 rounded-md border border-border bg-background/30 px-3 py-1.5 font-mono text-xs outline-none focus:border-primary"
        />
        <button
          onClick={() => {
            onSave(draft);
            setDraft("");
          }}
          disabled={!draft.trim()}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Save key
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Stored only in this browser and sent to Google through Kiroku's relay with each request —
        never kept on a server. Everything works without it.
      </p>
    </div>
  );
}
