import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  CircleHelp,
  Image,
  Music2,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Upload,
  Volume2,
} from "lucide-react";
// Phase 11a: the 13 sample days are no longer loaded. `src/data/initialLessons.ts` is kept on
// disk as an archive but is deliberately imported nowhere — new visitors start empty.
import type { DayLesson, UserProgressState } from "../types/japanese";
import { MusicPanel } from "@/components/music/MusicPanel";
import { LessonStudio } from "@/components/ai/LessonStudio";
import cats from "@/assets/images/cats-fog.jpg";
import castle from "@/assets/images/neusch-mist.jpg";
import autumn from "@/assets/images/autumn-castle.jpg";
import flowers from "@/assets/images/night-flowers.jpg";
import { STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";
import { speak } from "@/lib/voice";
import { VoicePicker } from "@/components/voice/VoicePicker";
import { WelcomePanel } from "@/components/welcome/WelcomePanel";
import { buildBackup, parseBackup, type ParsedBackup } from "@/lib/backup";
import { HelpCard } from "@/components/tips/HelpCard";
import { TipCard } from "@/components/tips/TipCard";
import { useTips } from "@/components/tips/useTips";
import { QuizView } from "@/components/quiz/QuizView";
import {
  badgeText,
  countMastered,
  dueWords,
  localDay,
  masteryState,
  parseStoredMemory,
  pruneMemory,
} from "@/lib/word-memory";
import { VocabList } from "@/components/lesson/VocabList";
import { AccountCard } from "@/components/account/AccountCard";
import { HeaderAccount } from "@/components/account/HeaderAccount";
import { AccountSyncProvider } from "@/components/account/AccountSyncProvider";
import { useAccountSync } from "@/components/account/AccountSyncContext";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kiroku — Japanese Study Desk" },
      {
        name: "description",
        content: "A focused Japanese learning desk for lessons, vocabulary, quizzes, and progress.",
      },
      { property: "og:title", content: "Kiroku — Japanese Study Desk" },
      {
        property: "og:description",
        content: "A focused Japanese learning desk for lessons, vocabulary, quizzes, and progress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JapaneseDesk,
});

type MainTab = "lesson" | "quiz" | "progress" | "atmosphere";
type LessonTab = "overview" | "grammar" | "kanji" | "vocab";
const backgrounds = [
  { name: "Misty companions", url: cats },
  { name: "Castle in fog", url: castle },
  { name: "Autumn château", url: autumn },
  { name: "Night flowers", url: flowers },
];
const THEME_CYCLE_MS = 24_000;
// One empty shape used for both the first-load default and "reset everything" (Phase 11a merged
// the old seeded `initialProgress` into this). `loadProgress()` spreads saved values over it, so
// existing users' stored progress still wins.
const emptyProgress: UserProgressState = {
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

function loadProgress() {
  if (typeof window === "undefined") return emptyProgress;
  migrateLegacyStorage();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) ?? "{}");
    return { ...emptyProgress, ...saved, vocabMemory: parseStoredMemory(saved?.vocabMemory) };
  } catch {
    return emptyProgress;
  }
}

// Lessons persist (added in Phase 3d). Since Phase 11a the fallback is an empty curriculum, not
// the 13 sample days.
function loadLessons(): DayLesson[] {
  if (typeof window === "undefined") return [];
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.lessons);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function JapaneseDesk() {
  const [lessons, setLessons] = useState<DayLesson[]>([]);
  const [progress, setProgress] = useState<UserProgressState>(emptyProgress);
  const [day, setDay] = useState(1);
  // `mounted` gates the welcome/empty screens and client storage restoration: the server render
  // always sees zero lessons, so client hydration starts with matching empty state and loads on mount.
  const [mounted, setMounted] = useState(false);
  // The welcome is not remembered anywhere: it shows whenever there are zero lessons. "Skip intro"
  // only hides it for this visit (plain state, never saved), so a refresh brings it back.
  const [welcomeSkipped, setWelcomeSkipped] = useState(false);
  useEffect(() => {
    const loadedLessons = loadLessons();
    const loadedProgress = loadProgress();
    setLessons(loadedLessons);
    setProgress(loadedProgress);
    if (
      loadedProgress.currentDay &&
      loadedLessons.some((l) => l.dayNumber === loadedProgress.currentDay)
    ) {
      setDay(loadedProgress.currentDay);
    } else if (loadedLessons[0]?.dayNumber) {
      setDay(loadedLessons[0].dayNumber);
    }
    setMounted(true);
  }, []);
  const [tab, setTab] = useState<MainTab>("lesson");
  const [lessonTab, setLessonTab] = useState<LessonTab>("overview");
  const [aiOpen, setAiOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  // Phase 11b: the header "?" help card and the dismissible per-screen tips.
  const [helpOpen, setHelpOpen] = useState(false);
  const tips = useTips();
  const [sceneDarkness, setSceneDarkness] = useState(0.34);
  const [cycleThemes, setCycleThemes] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("kiroku_cycle_themes_v1") === "true") {
        setCycleThemes(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const handleToggleCycleThemes = (enabled: boolean) => {
    setCycleThemes(enabled);
    try {
      localStorage.setItem("kiroku_cycle_themes_v1", enabled ? "true" : "false");
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    if (!mounted || !cycleThemes) return;
    const interval = setInterval(() => {
      setProgress((p) => ({
        ...p,
        backgroundIndex: (p.backgroundIndex + 1) % backgrounds.length,
      }));
    }, THEME_CYCLE_MS);
    return () => clearInterval(interval);
  }, [mounted, cycleThemes]);

  const lesson = lessons.find((item) => item.dayNumber === day) ?? lessons[0] ?? null;
  const completion =
    lessons.length > 0 ? Math.round((progress.completedDays.length / lessons.length) * 100) : 0;
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
  }, [progress, mounted]);
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEYS.lessons, JSON.stringify(lessons));
  }, [lessons, mounted]);
  // Having lessons clears the skip, so after a reset (or deleting the last day) the welcome returns.
  useEffect(() => {
    if (lessons.length > 0) setWelcomeSkipped(false);
  }, [lessons.length]);
  // Phase 14b: words due for review today (client-only, so the server render and first client render agree).
  const quizDue = mounted
    ? dueWords(
        lessons.flatMap((l) => l.vocab),
        progress.vocabMemory,
        localDay(),
      ).length
    : 0;
  const selectDay = (value: number) => setDay(Math.max(1, Math.min(lessons.length, value)));
  const complete = () =>
    setProgress((p) => ({
      ...p,
      completedDays: p.completedDays.includes(day)
        ? p.completedDays.filter((d) => d !== day)
        : [...p.completedDays, day],
    }));
  // No confirmation here — CurriculumList shows an in-app ConfirmDialog before calling this,
  // for both a single delete and a multi-select bulk delete (previously this used
  // window.confirm, which some setups can leave stuck behind the page focus-wise).
  const deleteDays = (dayNumbers: number[]) => {
    const toDelete = new Set(dayNumbers);
    setLessons((old) => old.filter((l) => !toDelete.has(l.dayNumber)));
    setProgress((p) => ({
      ...p,
      completedDays: p.completedDays.filter((d) => !toDelete.has(d)),
      masteredVocabIds: p.masteredVocabIds.filter(
        (id) => !dayNumbers.some((d) => id.startsWith(`d${d}-`)),
      ),
      weakVocabIds: p.weakVocabIds.filter((id) => !dayNumbers.some((d) => id.startsWith(`d${d}-`))),
      vocabMemory: pruneMemory(
        p.vocabMemory,
        (id) => !dayNumbers.some((d) => id.startsWith(`d${d}-`)),
      ),
    }));
    if (toDelete.has(day)) {
      const remaining = lessons.map((l) => l.dayNumber).filter((n) => !toDelete.has(n));
      if (remaining.length === 0) {
        setDay(1);
      } else {
        const higher = remaining.filter((n) => n > day).sort((a, b) => a - b)[0];
        const lower = remaining.filter((n) => n < day).sort((a, b) => b - a)[0];
        setDay(higher ?? lower ?? remaining[0]!);
      }
    }
  };
  const resetAll = () => {
    setLessons([]);
    setProgress(emptyProgress);
    setDay(1);
  };
  return (
    // Phase 9b: one shared account + sync state for the header button and the Progress card. `onApplied` keeps `day` on a real day after a sync replaced the lessons.
    <AccountSyncProvider
      lessons={lessons}
      progress={progress}
      setLessons={setLessons}
      setProgress={setProgress}
      onApplied={(applied) =>
        setTimeout(
          () =>
            setDay((d) =>
              applied.some((l) => l.dayNumber === d) ? d : (applied[0]?.dayNumber ?? 1),
            ),
          0,
        )
      }
      onClearDevice={resetAll}
    >
      <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
        {backgrounds.map((bg, index) => (
          <img
            key={`${bg.name}-${cycleThemes ? "cycling" : "static"}`}
            src={bg.url}
            alt=""
            className={`scene-drift fixed inset-0 size-full object-cover transition-opacity duration-[2800ms] ease-in-out ${index === progress.backgroundIndex % backgrounds.length ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        <div
          className="fixed inset-0 bg-background transition-opacity duration-700"
          style={{ opacity: sceneDarkness }}
        />
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,var(--background)_95%)] opacity-70" />
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(90deg,var(--background)_0%,transparent_35%,transparent_65%,var(--background)_100%)] opacity-35" />

        <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1520px] flex-col p-3 md:p-5">
          <Header
            tab={tab}
            setTab={setTab}
            day={day}
            selectDay={selectDay}
            maxDay={lessons.length}
            quizDue={quizDue}
            onAI={() => setAiOpen(true)}
            onSound={() => setSoundOpen((v) => !v)}
            onHelp={() => setHelpOpen(true)}
          />
          <main className="flex-1 overflow-y-auto py-5 md:py-7">
            {mounted &&
              tab === "lesson" &&
              (lesson ? (
                <LessonWorkspace
                  lesson={lesson}
                  lessons={lessons}
                  progress={progress}
                  completion={completion}
                  lessonTab={lessonTab}
                  setLessonTab={setLessonTab}
                  selectDay={selectDay}
                  complete={complete}
                  setProgress={setProgress}
                  onQuiz={() => setTab("quiz")}
                  onDeleteDays={deleteDays}
                />
              ) : welcomeSkipped ? (
                <EmptyLessons onAI={() => setAiOpen(true)} onRestore={() => setTab("progress")} />
              ) : (
                <WelcomePanel
                  onAI={() => setAiOpen(true)}
                  onRestore={() => setTab("progress")}
                  onSkip={() => setWelcomeSkipped(true)}
                />
              ))}
            {mounted && tab === "quiz" && (
              <>
                {tips.isVisible("quiz") && (
                  <TipCard id="quiz" onDismiss={tips.dismiss} className="mb-4 max-w-3xl" />
                )}
                <QuizView
                  lessons={lessons}
                  day={day}
                  memory={progress.vocabMemory}
                  setProgress={setProgress}
                  onBack={() => setTab("lesson")}
                />
              </>
            )}
            {mounted && tab === "progress" && (
              <>
                {tips.isVisible("progress") && (
                  <TipCard id="progress" onDismiss={tips.dismiss} className="mb-4 max-w-5xl" />
                )}
                <ProgressView
                  lessons={lessons}
                  progress={progress}
                  setProgress={setProgress}
                  setLessons={setLessons}
                  onResetAll={resetAll}
                  onRestored={setDay}
                />
              </>
            )}
            {mounted && tab === "atmosphere" && (
              <>
                {tips.isVisible("atmosphere") && (
                  <TipCard id="atmosphere" onDismiss={tips.dismiss} className="mb-4 max-w-4xl" />
                )}
                <AtmosphereView
                  backgrounds={backgrounds}
                  active={progress.backgroundIndex}
                  setActive={(backgroundIndex) => setProgress((p) => ({ ...p, backgroundIndex }))}
                  darkness={sceneDarkness}
                  setDarkness={setSceneDarkness}
                  cycle={cycleThemes}
                  onToggleCycle={handleToggleCycleThemes}
                />
              </>
            )}
          </main>
        </div>
        {helpOpen && (
          <HelpCard
            onOpenStudio={() => {
              setHelpOpen(false);
              setAiOpen(true);
            }}
            onShowTipsAgain={tips.showAgain}
            onClose={() => setHelpOpen(false)}
          />
        )}
        <MusicPanel expanded={soundOpen} onToggleExpanded={() => setSoundOpen((v) => !v)} />
        {aiOpen && (
          <LessonStudio
            lessons={lessons}
            progress={progress}
            showTip={tips.isVisible("studio")}
            onDismissTip={() => tips.dismiss("studio")}
            onClose={() => setAiOpen(false)}
            onImport={(newLesson) => {
              setLessons((old) =>
                [...old.filter((l) => l.dayNumber !== newLesson.dayNumber), newLesson].sort(
                  (a, b) => a.dayNumber - b.dayNumber,
                ),
              );
              setDay(newLesson.dayNumber);
              setAiOpen(false);
            }}
          />
        )}
      </div>
    </AccountSyncProvider>
  );
}

function Header({
  tab,
  setTab,
  day,
  selectDay,
  maxDay,
  quizDue,
  onAI,
  onSound,
  onHelp,
}: {
  quizDue: number;
  tab: MainTab;
  setTab: (v: MainTab) => void;
  day: number;
  selectDay: (v: number) => void;
  maxDay: number;
  onAI: () => void;
  onSound: () => void;
  onHelp: () => void;
}) {
  const nav: { id: MainTab; label: string; icon: typeof BookOpen }[] = [
    { id: "lesson", label: "Lessons", icon: BookOpen },
    { id: "quiz", label: "Quiz", icon: Sparkles },
    { id: "progress", label: "Progress", icon: Trophy },
    { id: "atmosphere", label: "Atmosphere", icon: Image },
  ];
  return (
    <header className="glass-panel grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-3.5 py-2.5 lg:grid-cols-[1fr_auto_1fr]">
      <div className="flex items-center gap-2.5">
        <span className="font-display text-base font-semibold tracking-wider text-foreground">
          記録
        </span>
        <span className="hidden h-3 w-[1px] bg-border/80 sm:inline" />
        <span className="hidden text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:inline">
          kiroku study desk
        </span>
      </div>
      <nav className="order-3 col-span-2 flex items-center justify-center gap-1 rounded-full border border-border/60 bg-glass/60 p-1 backdrop-blur-md lg:order-none lg:col-span-1">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              tab === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5" />
            <span className="hidden sm:inline">{label}</span>
            {id === "quiz" && quizDue > 0 && (
              <span
                aria-label={`${quizDue} words due today`}
                title={`${quizDue} words due today`}
                className={`rounded-full px-1.5 text-[9px] font-bold leading-3.5 ${
                  tab === id
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-primary/25 text-primary"
                }`}
              >
                {badgeText(quizDue)}
              </span>
            )}
          </button>
        ))}
      </nav>
      <div className="flex items-center justify-end gap-1.5">
        <div className="hidden items-center rounded-full border border-border/70 bg-glass/50 px-1 py-0.5 sm:flex">
          <button
            onClick={() => selectDay(day - 1)}
            aria-label="Previous day"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span className="px-2 font-display text-[11px] font-medium tracking-wide text-primary">
            Day {day}
          </span>
          <button
            onClick={() => selectDay(Math.min(maxDay, day + 1))}
            aria-label="Next day"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        <HeaderAccount />
        <button
          onClick={onAI}
          aria-label="AI lesson import"
          title="AI lesson import"
          className="rounded-lg border border-border/80 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Bot className="size-3.5" />
        </button>
        <button
          onClick={onSound}
          aria-label="Music player"
          title="Music player"
          className="rounded-lg border border-border/80 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Music2 className="size-3.5" />
        </button>
        <button
          onClick={onHelp}
          aria-label="Help"
          title="Help"
          className="rounded-lg border border-border/80 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </div>
    </header>
  );
}

function GlassPane({
  children,
  className = "",
  tilt = "0deg",
  delay = "0ms",
}: {
  children: ReactNode;
  className?: string;
  tilt?: string;
  delay?: string;
}) {
  return (
    <section
      className={`glass-panel pane-in rounded-xl p-5 md:p-6 ${className}`}
      style={{ "--tilt": tilt, animationDelay: delay } as React.CSSProperties}
    >
      {children}
    </section>
  );
}

function LessonWorkspace({
  lesson,
  lessons,
  progress,
  completion,
  lessonTab,
  setLessonTab,
  selectDay,
  complete,
  setProgress,
  onQuiz,
  onDeleteDays,
}: {
  lesson: DayLesson;
  lessons: DayLesson[];
  progress: UserProgressState;
  completion: number;
  lessonTab: LessonTab;
  setLessonTab: (v: LessonTab) => void;
  selectDay: (v: number) => void;
  complete: () => void;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  onQuiz: () => void;
  onDeleteDays: (dayNumbers: number[]) => void;
}) {
  const done = progress.completedDays.includes(lesson.dayNumber);
  return (
    <div className="grid items-start gap-5 lg:grid-cols-12">
      <GlassPane className="lg:col-span-5 lg:ml-2" tilt="-0.5deg">
        <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-2">
            <span className="font-display text-sm font-semibold tracking-wide text-primary">
              文法
            </span>
            <span className="text-muted-foreground/60">·</span>
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Day {lesson.dayNumber}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setProgress((p) => ({ ...p, showFurigana: !p.showFurigana }))}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                progress.showFurigana
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              Furigana {progress.showFurigana ? "on" : "off"}
            </button>
            <button
              onClick={complete}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                done
                  ? "border-success/40 bg-success/15 text-success"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {done && <Check className="size-3" />}
              {done ? "Completed" : "Mark done"}
            </button>
          </div>
        </div>
        <h1
          className="mt-4 font-display text-2xl font-medium leading-snug tracking-tight text-foreground md:text-3xl"
          style={{ textWrap: "balance" }}
        >
          {lesson.grammar.title}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground/90">
          {lesson.grammar.summary}
        </p>
        <div className="mt-5 flex gap-1 border-b border-border/50 pb-2.5">
          {(["overview", "grammar", "kanji", "vocab"] as LessonTab[]).map((id) => (
            <button
              key={id}
              onClick={() => setLessonTab(id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                lessonTab === id
                  ? "bg-primary/20 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
        <div className="mt-5 min-h-[320px]">
          {lessonTab === "overview" && (
            <Overview lesson={lesson} showReading={progress.showFurigana} />
          )}
          {lessonTab === "grammar" && (
            <Grammar lesson={lesson} showReading={progress.showFurigana} />
          )}
          {lessonTab === "kanji" && <Kanji lesson={lesson} showReading={progress.showFurigana} />}
          {lessonTab === "vocab" && (
            <VocabList
              lesson={lesson}
              progress={progress}
              setProgress={setProgress}
              showReading={progress.showFurigana}
            />
          )}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-border/50 pt-4">
          <div className="flex gap-1.5">
            <button
              onClick={() => selectDay(lesson.dayNumber - 1)}
              aria-label="Previous lesson"
              className="rounded-lg border border-border/70 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => selectDay(lesson.dayNumber + 1)}
              aria-label="Next lesson"
              className="rounded-lg border border-border/70 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button
            onClick={onQuiz}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-105 active:scale-[0.98]"
          >
            <Sparkles className="size-4" />
            Quiz this day
          </button>
        </div>
      </GlassPane>
      <GlassPane className="lg:col-span-4 lg:mt-4" delay="120ms">
        <div className="flex items-center justify-between">
          <span className="font-display text-xs font-semibold tracking-wider text-primary">
            学習 · PROGRESS
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Momentum
          </span>
        </div>
        <div className="relative mx-auto mt-6 grid size-44 place-items-center">
          <svg viewBox="0 0 100 100" className="size-44 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              className="text-foreground/10"
              strokeWidth="4"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="currentColor"
              className="text-primary transition-all duration-1000 ease-out"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray="251"
              strokeDashoffset={251 - (251 * completion) / 100}
            />
          </svg>
          <div className="absolute text-center">
            <p className="font-display text-3xl font-medium tracking-tight text-foreground">
              {completion}%
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              complete
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-3 border-t border-border/50 pt-4 text-center">
          <Metric value={progress.completedDays.length} label="days" />
          <Metric value={lessons.length} label="kanji" />
          <Metric
            value={countMastered(
              lessons.flatMap((l) => l.vocab),
              progress.masteredVocabIds,
              progress.vocabMemory,
            )}
            label="mastered"
          />
        </div>
        <MomentumGraph />
      </GlassPane>
      <GlassPane className="lg:col-span-3 lg:mt-8" tilt="0.5deg" delay="240ms">
        <CurriculumList
          lessons={lessons}
          currentDay={lesson.dayNumber}
          completedDays={progress.completedDays}
          selectDay={selectDay}
          onDeleteDays={onDeleteDays}
        />
      </GlassPane>
    </div>
  );
}

// The curriculum list owns its own select-mode/checkbox state — it's a pure UI concern local to
// this list. Deletion itself (state mutation) lives in JapaneseDesk and comes in via onDeleteDays.
function CurriculumList({
  lessons,
  currentDay,
  completedDays,
  selectDay,
  onDeleteDays,
}: {
  lessons: DayLesson[];
  currentDay: number;
  completedDays: number[];
  selectDay: (v: number) => void;
  onDeleteDays: (dayNumbers: number[]) => void;
}) {
  const { sync } = useAccountSync(); // Phase 9c: a day deleted here must also leave the account, and stay gone on other devices
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirmDays, setConfirmDays] = useState<number[] | null>(null);
  const toggle = (d: number) =>
    setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
  const exitSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };
  return (
    <>
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <span className="font-display text-xs font-semibold tracking-wider text-primary">
          今日 · CURRICULUM
        </span>
        <button
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
        >
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>
      <div className="mt-3.5 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        {lessons.map((item) => {
          const isSelected = selected.includes(item.dayNumber);
          const isCurrent = item.dayNumber === currentDay && !selectMode;
          return (
            <div
              key={item.dayNumber}
              className={`group flex items-center gap-1.5 rounded-lg border border-border/30 px-2.5 py-2 transition-all ${
                isCurrent
                  ? "border-primary/40 bg-primary/15 shadow-sm"
                  : isSelected
                    ? "border-primary/30 bg-primary/10"
                    : "bg-glass/30 hover:border-border/60 hover:bg-accent/40"
              }`}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(item.dayNumber)}
                  aria-label={`Select Day ${item.dayNumber}`}
                  className="size-3.5 shrink-0 accent-primary"
                />
              )}
              <button
                onClick={() => (selectMode ? toggle(item.dayNumber) : selectDay(item.dayNumber))}
                className={`flex min-w-0 flex-1 items-center gap-3 text-left ${
                  isCurrent ? "text-primary font-medium" : "text-foreground/80"
                }`}
              >
                <span className="font-display text-lg drop-shadow-sm">{item.kanji.character}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{item.title}</span>
                  <span className="block text-[10px] text-muted-foreground/80">
                    Day {item.dayNumber}
                  </span>
                </span>
                {completedDays.includes(item.dayNumber) && (
                  <Check className="size-3.5 text-success" />
                )}
              </button>
              {!selectMode && (
                <button
                  onClick={() => setConfirmDays([item.dayNumber])}
                  aria-label={`Delete Day ${item.dayNumber}`}
                  title="Delete this day"
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {selectMode && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
          <span className="text-[11px] text-muted-foreground">{selected.length} selected</span>
          <button
            disabled={selected.length === 0}
            onClick={() => setConfirmDays(selected)}
            className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1.5 text-xs text-destructive transition-colors disabled:opacity-40"
          >
            <Trash2 className="size-3" />
            Delete{selected.length > 0 ? ` ${selected.length}` : ""}
          </button>
        </div>
      )}
      {confirmDays && (
        <ConfirmDialog
          title={
            confirmDays.length === 1
              ? `Delete Day ${confirmDays[0]}?`
              : `Delete ${confirmDays.length} days?`
          }
          body="This can't be undone."
          confirmLabel="Delete"
          onConfirm={() => {
            onDeleteDays(confirmDays);
            sync.noteDeleted(confirmDays);
            setConfirmDays(null);
            exitSelect();
          }}
          onCancel={() => setConfirmDays(null)}
        />
      )}
    </>
  );
}

// A page-level, styled dialog rather than window.confirm — guaranteed to render inside the page
// itself (no native dialog that can end up behind the window or lose focus), and it can show a
// count for a bulk delete, which window.confirm's fixed wording can't do cleanly.
function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Portaled to <body>: the curriculum pane has backdrop-blur + a rotate transform, and either one makes
  // a `fixed` child position relative to the pane instead of the viewport (dialog would be squashed inside it).
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong w-full max-w-sm rounded-xl p-5"
      >
        <h2 className="font-display text-lg font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Shown when every day has been deleted or reset — the old code returned null here (a blank
// screen with no way back in), which was never exercised until Phase 3d made zero lessons reachable.
function EmptyLessons({ onAI, onRestore }: { onAI: () => void; onRestore: () => void }) {
  return (
    <div className="mx-auto max-w-xl">
      <GlassPane>
        <span className="font-display text-xs font-semibold tracking-wider text-primary">
          文法 · NO LESSONS
        </span>
        <h1 className="mt-4 font-display text-2xl font-medium text-foreground">
          Your curriculum is empty
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Build a day with AI Lesson Studio, or restore a backup from the Progress tab.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            onClick={onAI}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-105"
          >
            <Bot className="size-4" />
            Build a lesson
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="size-4" />
            Restore backup
          </button>
        </div>
      </GlassPane>
    </div>
  );
}

function Overview({ lesson, showReading }: { lesson: DayLesson; showReading: boolean }) {
  const ex = lesson.grammar.examples[0];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Pattern & Structure
        </p>
        <div className="mt-2 rounded-lg border border-primary/25 bg-primary/10 p-3.5 font-display text-base tracking-wide text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
          {lesson.grammar.structure}
        </div>
      </div>
      <div className="rounded-lg border border-border/50 bg-glass/40 p-3.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
          Example in context
        </p>
        <p className="font-display text-lg tracking-wide text-foreground">{ex?.japanese}</p>
        {showReading && (
          <p className="mt-1 text-xs font-mono text-primary/80 tracking-wide">{ex?.reading}</p>
        )}
        <p className="mt-1.5 text-sm text-foreground/80">{ex?.english}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 border-t border-border/50 pt-3.5">
        <div className="rounded-lg border border-border/40 bg-glass/30 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Kanji spotlight
          </p>
          <p className="mt-1 font-display text-4xl font-medium text-primary">
            {lesson.kanji.character}
          </p>
          <p className="mt-1 text-xs font-medium text-foreground">{lesson.kanji.meaning}</p>
          <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
            {lesson.kanji.onyomi.join(" · ")}
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-glass/30 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Natural phrase
          </p>
          <p className="mt-1 font-display text-base tracking-wide text-foreground">
            {lesson.naturalPhrase.phrase}
          </p>
          {showReading && (
            <p className="mt-0.5 text-[11px] font-mono text-primary/80">
              {lesson.naturalPhrase.reading}
            </p>
          )}
          <p className="mt-1 text-xs text-foreground/75 leading-relaxed">
            {lesson.naturalPhrase.meaning}
          </p>
        </div>
      </div>
    </div>
  );
}
function Grammar({ lesson, showReading }: { lesson: DayLesson; showReading: boolean }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg border border-border/40 bg-glass/30 p-3.5 leading-relaxed text-foreground/85">
        {lesson.grammar.explanation}
      </div>
      <div className="space-y-2.5 pt-1">
        {lesson.grammar.examples.map((ex, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/40 border-l-2 border-l-primary bg-background/20 p-3"
          >
            <p className="font-display text-base tracking-wide text-foreground">{ex.japanese}</p>
            {showReading && (
              <p className="mt-0.5 text-xs font-mono text-primary/80">{ex.reading}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{ex.english}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function Kanji({ lesson, showReading }: { lesson: DayLesson; showReading: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <span className="font-display text-6xl font-medium text-primary drop-shadow-sm">
          {lesson.kanji.character}
        </span>
        <div>
          <h2 className="font-display text-xl font-medium text-foreground">
            {lesson.kanji.meaning}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lesson.kanji.strokes} strokes · Radical {lesson.kanji.radical}
          </p>
          {showReading && (
            <div className="mt-1 text-xs text-foreground/90">
              <span className="text-muted-foreground">On: </span>
              {lesson.kanji.onyomi.join(" / ") || "—"}
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">Kun: </span>
              {lesson.kanji.kunyomi.join(" / ") || "—"}
            </div>
          )}
          <button
            onClick={() => speak(lesson.kanji.character)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Volume2 className="size-3.5" />
            Listen
          </button>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Compounds
        </p>
        <div className="space-y-1.5">
          {lesson.kanji.compounds.map((c) => (
            <div
              key={c.word}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-glass/30 px-3 py-2 text-sm"
            >
              <span className="font-display tracking-wide text-foreground">
                {c.word}{" "}
                {showReading && (
                  <span className="ml-2 font-mono text-xs text-primary/80">{c.reading}</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{c.meaning}</span>
            </div>
          ))}
        </div>
      </div>
      {(lesson.kanji.memoryTip || lesson.kanji.rendakuNote) && (
        <div className="space-y-2 border-t border-border/50 pt-3.5 text-xs text-muted-foreground">
          {lesson.kanji.memoryTip && (
            <p className="rounded-lg border border-border/40 bg-background/20 p-2.5 leading-relaxed">
              <span className="font-semibold text-primary">Memory tip: </span>
              {lesson.kanji.memoryTip}
            </p>
          )}
          {lesson.kanji.rendakuNote && (
            <p className="rounded-lg border border-border/40 bg-background/20 p-2.5 leading-relaxed">
              <span className="font-semibold text-primary">Sound notes: </span>
              {lesson.kanji.rendakuNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-medium tracking-tight text-primary tabular-nums">
        {value}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
function MomentumGraph() {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>7-day rhythm</span>
        <span className="text-primary font-semibold">steady</span>
      </div>
      <svg viewBox="0 0 280 72" className="mt-2 w-full">
        <path
          d="M2 60 C35 58,38 32,70 40 S115 54,140 31 S185 12,210 26 S250 45,278 12"
          fill="none"
          stroke="currentColor"
          className="graph-draw text-primary drop-shadow-[0_0_6px_rgba(230,195,120,0.3)]"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="500"
        />
        <path d="M2 66H278" stroke="currentColor" className="text-foreground/10" strokeWidth="1" />
      </svg>
    </div>
  );
}

function ProgressView({
  lessons,
  progress,
  setProgress,
  setLessons,
  onResetAll,
  onRestored,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  setLessons: React.Dispatch<React.SetStateAction<DayLesson[]>>;
  onResetAll: () => void;
  onRestored: (firstDay: number) => void;
}) {
  const [query, setQuery] = useState("");
  const vocab = lessons
    .flatMap((l) => l.vocab)
    .filter((w) =>
      `${w.japanese} ${w.reading} ${w.meaning}`.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
      <GlassPane>
        <span className="font-display text-xs font-semibold tracking-wider text-primary">
          学習 · ARCHIVE
        </span>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <Metric value={progress.completedDays.length} label="days" />
          <Metric
            value={countMastered(
              lessons.flatMap((l) => l.vocab),
              progress.masteredVocabIds,
              progress.vocabMemory,
            )}
            label="mastered"
          />
          <Metric value={progress.totalQuizzesTaken} label="quizzes" />
          <Metric value={lessons.reduce((n, l) => n + l.vocab.length, 0)} label="words" />
        </div>
        <MomentumGraph />
        <BackupControls
          lessons={lessons}
          progress={progress}
          setLessons={setLessons}
          setProgress={setProgress}
          onRestored={onRestored}
        />
        <AccountCard />
        <div className="mt-4 border-t border-border/50 pt-3">
          <ResetControl onReset={onResetAll} />
        </div>
      </GlassPane>
      <GlassPane className="lg:col-span-2 lg:mt-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Japanese, reading, or meaning..."
            className="w-full rounded-xl border border-border/60 bg-glass/60 py-2.5 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>
        <div className="mt-4 grid max-h-[520px] gap-2 overflow-y-auto sm:grid-cols-2 pr-1">
          {vocab.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-md border border-border bg-glass p-3"
            >
              <div>
                <p className="font-display">
                  {w.japanese} <span className="text-xs text-muted-foreground">{w.reading}</span>
                </p>
                <p className="text-xs text-muted-foreground">{w.meaning}</p>
              </div>
              <button
                onClick={() =>
                  setProgress((p) => ({
                    ...p,
                    masteredVocabIds: p.masteredVocabIds.includes(w.id)
                      ? p.masteredVocabIds.filter((id) => id !== w.id)
                      : [...p.masteredVocabIds, w.id],
                  }))
                }
                title={
                  masteryState(w, progress.masteredVocabIds, progress.vocabMemory) === "earned"
                    ? "Mastered through review"
                    : undefined
                }
                className={
                  masteryState(w, progress.masteredVocabIds, progress.vocabMemory) !== "none"
                    ? "text-primary"
                    : "text-muted-foreground"
                }
              >
                <Star
                  className={`size-4 ${progress.masteredVocabIds.includes(w.id) ? "fill-current" : ""}`}
                />
              </button>
            </div>
          ))}
        </div>
      </GlassPane>
    </div>
  );
}

// Phase 13 — Export + validated Restore. All the checking lives in `src/lib/backup.ts`; this only
// shows the result. A bad file never touches state: it becomes an in-app message, and a good one
// waits behind a ConfirmDialog that shows day counts before anything is replaced.
function BackupControls({
  lessons,
  progress,
  setLessons,
  setProgress,
  onRestored,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setLessons: React.Dispatch<React.SetStateAction<DayLesson[]>>;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  onRestored: (firstDay: number) => void;
}) {
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const { sync } = useAccountSync();
  const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  const exportData = () => {
    setNotice(null);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(buildBackup(lessons, progress), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "kiroku-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const chooseFile = async (file?: File) => {
    if (!file) return;
    setNotice(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ kind: "error", text: "Couldn't read that file, so nothing was restored." });
      return;
    }
    const result = parseBackup(text, emptyProgress);
    if (!result.ok) {
      setNotice({ kind: "error", text: result.message });
      return;
    }
    setPending(result.data);
  };

  const madeOn = pending?.exportedAt
    ? ` It was exported on ${new Date(pending.exportedAt).toLocaleDateString()}.`
    : "";
  return (
    <div className="mt-5">
      <div className="flex gap-2">
        <button
          onClick={exportData}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
        >
          <Download className="size-3" />
          Export
        </button>
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
          <Upload className="size-3" />
          Restore
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              void chooseFile(file);
            }}
          />
        </label>
      </div>
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${notice.kind === "error" ? "text-destructive" : "text-success"}`}
        >
          {notice.text}
        </p>
      )}
      {pending && (
        <ConfirmDialog
          title="Replace your data with this backup?"
          body={`${lessons.length === 0 ? `Restore the backup's ${days(pending.lessons.length)}?` : `Replace your ${days(lessons.length)} with the backup's ${days(pending.lessons.length)}?`}${madeOn} Your current lessons and progress will be overwritten — export first if you want to keep them.${sync.linked ? " You're signed in with sync, so the restored days will be ADDED to your account on the next sync; nothing in your account is deleted, and days your account has that this backup doesn't will come back to this device." : ""}`}
          confirmLabel="Replace"
          onConfirm={() => {
            setLessons(pending.lessons);
            setProgress(pending.progress);
            // Phase 11b: point the shell at the first restored day (lessons come back sorted), so the header can't read D1 for a backup that starts at Day 5. An empty backup leaves `day` alone.
            const firstRestored = pending.lessons[0];
            if (firstRestored) onRestored(firstRestored.dayNumber);
            setNotice({
              kind: "success",
              text: `Restored ${days(pending.lessons.length)} from the backup.`,
            });
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}

// A stronger confirmation than the curriculum list's ConfirmDialog, since this clears every
// lesson and all progress at once. Requires typing "reset" rather than a single click.
function ResetControl({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // Phase 9c: signed in and synced → a second question about the account's copy (default: leave it alone).
  const { sync } = useAccountSync();
  const [alsoCloud, setAlsoCloud] = useState(false);
  const askCloud = sync.linked && sync.canDeleteCloud;
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-2 text-xs text-destructive"
      >
        <RotateCcw className="size-3" />
        Reset all progress
      </button>
    );
  }
  const canConfirm = text.trim().toLowerCase() === "reset";
  return (
    <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-xs text-muted-foreground">
        This deletes every lesson and all progress — back it up first if you're not sure. Type{" "}
        <span className="font-semibold text-foreground">reset</span> to confirm.
      </p>
      {askCloud && (
        <label className="flex cursor-pointer items-start gap-2 text-xs">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={alsoCloud}
            onChange={(e) => setAlsoCloud(e.target.checked)}
          />
          <span>
            Also delete the copy in my account
            <span className="block text-muted-foreground">
              {alsoCloud
                ? "Your account's copy is erased too. Your other devices keep theirs and may upload it again."
                : "Left off: your account keeps its copy, and automatic sync is switched off on this device so it doesn't bring everything straight back. Sync now brings it back whenever you want."}
            </span>
          </span>
        </label>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="reset"
          className="min-w-0 flex-1 rounded-md border border-border bg-glass px-2 py-1.5 text-xs outline-none focus:border-destructive"
        />
        <button
          disabled={!canConfirm}
          onClick={() => {
            onReset();
            if (askCloud) {
              if (alsoCloud) void sync.deleteCloudData();
              else sync.setAuto(false);
            }
            setOpen(false);
            setText("");
            setAlsoCloud(false);
          }}
          className="shrink-0 rounded-md bg-destructive px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setText("");
          }}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function AtmosphereView({
  backgrounds,
  active,
  setActive,
  darkness,
  setDarkness,
  cycle,
  onToggleCycle,
}: {
  backgrounds: { name: string; url: string }[];
  active: number;
  setActive: (v: number) => void;
  darkness: number;
  setDarkness: (v: number) => void;
  cycle: boolean;
  onToggleCycle: (v: boolean) => void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <GlassPane>
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <span className="font-display text-xs font-semibold tracking-wider text-primary">
            景色 · ATMOSPHERE
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Scenic View
          </span>
        </div>
        <h1 className="mt-4 font-display text-2xl font-medium text-foreground md:text-3xl">
          Choose the view beyond your desk
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an ethereal backdrop to accompany your Japanese study sessions.
        </p>

        {/* Ethereal Theme Cycle Toggle */}
        <div className="mt-5 rounded-xl border border-border/60 bg-glass/60 p-4 transition-colors">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`grid size-9 shrink-0 place-items-center rounded-lg border transition-colors ${
                  cycle
                    ? "border-primary/50 bg-primary/20 text-primary"
                    : "border-border/60 bg-glass/60 text-muted-foreground"
                }`}
              >
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-semibold text-foreground">
                    Ethereal Theme Cycle
                  </span>
                  {cycle && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                      Cycling active
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Gently and seamlessly dissolves between scenic themes every 24 seconds, or turn
                  off to keep a static view.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cycle}
              aria-label="Toggle ethereal theme cycle"
              onClick={() => onToggleCycle(!cycle)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                cycle ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block size-5 transform rounded-full bg-background shadow-md ring-0 transition duration-200 ease-in-out ${
                  cycle ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {backgrounds.map((bg, i) => (
            <button
              key={bg.name}
              onClick={() => setActive(i)}
              className={`group relative aspect-video overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                active === i
                  ? "border-primary shadow-lg ring-2 ring-primary/20 scale-[1.01]"
                  : "border-border/60 hover:border-border hover:shadow-md"
              }`}
            >
              <img
                src={bg.url}
                alt={bg.name}
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-left">
                <span className="font-display text-xs font-medium text-white tracking-wide">
                  {bg.name}
                </span>
                {active === i && (
                  <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                    {cycle ? "Current" : "Active"}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-6 border-t border-border/40 pt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Reading contrast</span>
            <span className="font-mono text-primary font-semibold tabular-nums">
              {Math.round(darkness * 100)}%
            </span>
          </div>
          <input
            className="mt-2 w-full accent-primary"
            type="range"
            min="0.15"
            max="0.7"
            step="0.01"
            value={darkness}
            onChange={(e) => setDarkness(Number(e.target.value))}
          />
        </div>
      </GlassPane>
      <GlassPane>
        <VoicePicker />
      </GlassPane>
      <p className="text-center text-xs text-muted-foreground">
        Also by me —{" "}
        <a
          href="https://astra-kanji-tutor.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 transition-colors hover:brightness-110"
        >
          Learn with Astra-chan
        </a>
        , another Japanese-learning app.
      </p>
    </div>
  );
}
