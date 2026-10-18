import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Image,
  Music2,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Volume2,
} from "lucide-react";
// Phase 11a: the 13 sample days are no longer loaded. The old sample course is kept as an archive in
// `handoffs/fixtures/initialLessons.legacy.ts` (moved out of `src/` in Phase 17) and is imported nowhere in the app.
import type { DayLesson, UserProgressState } from "../types/japanese";
import { MusicPanel } from "@/components/music/MusicPanel";
import { SceneBackdrop } from "@/components/atmosphere/SceneBackdrop";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { useSpeechSupported } from "@/hooks/use-speech-supported";
import { speakableReading } from "@/lib/speak-text";
import { LessonStudio } from "@/components/ai/LessonStudio";
import cats from "@/assets/images/cats-fog.jpg";
import castle from "@/assets/images/neusch-mist.jpg";
import autumn from "@/assets/images/autumn-castle.jpg";
import flowers from "@/assets/images/night-flowers.jpg";
import { STORAGE_KEYS, migrateLegacyStorage } from "@/lib/storage";
import {
  DARKNESS_MAX,
  DARKNESS_MIN,
  DEFAULT_ATMOSPHERE,
  loadAtmosphere,
  saveAtmosphere,
  type AtmospherePrefs,
  type ParticleDensity,
} from "@/lib/atmosphere-prefs";
import { speak } from "@/lib/voice";
import { VoicePicker } from "@/components/voice/VoicePicker";
import { WelcomePanel } from "@/components/welcome/WelcomePanel";
import { HelpCard } from "@/components/tips/HelpCard";
import { TipCard } from "@/components/tips/TipCard";
import { useTips } from "@/components/tips/useTips";
import { QuizView } from "@/components/quiz/QuizView";
import {
  badgeText,
  countMastered,
  dueWords,
  localDay,
  parseStoredMemory,
  pruneMemory,
} from "@/lib/word-memory";
import { parseStoredStudyLog } from "@/lib/study-log";
import { RhythmChart } from "@/components/progress/RhythmChart";
import { MemoryBlock } from "@/components/progress/MemoryBlock";
import { WordList } from "@/components/progress/WordList";
import { useToday } from "@/hooks/use-today";
import { memorySummary } from "@/lib/memory-summary";
import { VocabList } from "@/components/lesson/VocabList";
import { PointChips } from "@/components/lesson/PointChips";
import { normalizeLessonShape } from "@/lib/lesson-schema";
import {
  dayAfterDelete,
  dayPositionLabel,
  deleteDaysConfirm,
  lessonPosition,
  resolveDay,
  stepDay,
} from "@/lib/day-nav";
import { clearDayWordState, isReplacement, upsertLesson } from "@/lib/day-replace";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ProfilePage } from "@/components/profile/ProfilePage";
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

// Phase 20: "studio" is a shell mode like the others — the AI Lesson Studio is a page, not an overlay.
type MainTab = "lesson" | "quiz" | "progress" | "atmosphere" | "profile" | "studio";
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
  studyLog: {},
  backgroundIndex: 0,
  bgZoomSpeed: "slow",
  showFurigana: true,
};

function loadProgress() {
  if (typeof window === "undefined") return emptyProgress;
  migrateLegacyStorage();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) ?? "{}");
    return {
      ...emptyProgress,
      ...saved,
      vocabMemory: parseStoredMemory(saved?.vocabMemory),
      // Phase 18a: saves from before the study log have none; anything malformed is dropped.
      studyLog: parseStoredStudyLog(saved?.studyLog),
    };
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
    // Phase 17: lessons saved before this phase hold ONE kanji / grammar object; wrap them into arrays on read.
    // (Saved back as arrays by the persist effect. No other validation, as before.)
    return Array.isArray(parsed) ? parsed.map((l: DayLesson) => normalizeLessonShape(l)) : [];
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
    // Phase 16d: this device's scene cycling + reading contrast (device-only; migrates the old cycle key).
    setAtmosphere(loadAtmosphere(localStorage, STORAGE_KEYS.atmosphere));
    // A saved day that was deleted since (or a backup that never had it) opens on the nearest
    // remaining day — not on lessons[0] while the shell still remembers the missing number.
    const restored = resolveDay(
      loadedLessons.map((l) => l.dayNumber),
      loadedProgress.currentDay,
    );
    if (restored !== null) setDay(restored);
    setMounted(true);
  }, []);
  const [tab, setTab] = useState<MainTab>("lesson");
  const [lessonTab, setLessonTab] = useState<LessonTab>("overview");
  // Phase 20: the Studio is the "studio" mode. Once opened it stays MOUNTED (hidden while another
  // mode shows) so a pasted AI reply, the chosen step and an in-flight Gemini call survive a trip
  // to Lessons and back. `studioReturnRef` remembers the last non-studio mode, so Back (and the
  // header bot button, which toggles) returns to wherever the user came from.
  const [studioVisited, setStudioVisited] = useState(false);
  const studioReturnRef = useRef<MainTab>("lesson");
  useEffect(() => {
    if (tab === "studio") setStudioVisited(true);
    else studioReturnRef.current = tab;
    // A mode switch is a page change, so start each mode at the top. The window is the scroller
    // (the content column grows with its content; see the comment on <main> below).
    window.scrollTo({ top: 0 });
  }, [tab]);
  const openStudio = () => setTab("studio");
  const closeStudio = () => setTab(studioReturnRef.current);
  const [soundOpen, setSoundOpen] = useState(false);
  // Phase 11b: the header "?" help card and the dismissible per-screen tips.
  const [helpOpen, setHelpOpen] = useState(false);
  const tips = useTips();
  // Phase 16d: cycling + reading contrast are device-only prefs (kiroku_atmosphere_v1). Loaded in the mount effect
  // above, saved here once `mounted` (so the first render's defaults never overwrite what is stored).
  const [atmosphere, setAtmosphere] = useState<AtmospherePrefs>(DEFAULT_ATMOSPHERE);
  useEffect(() => {
    if (!mounted) return;
    saveAtmosphere(localStorage, STORAGE_KEYS.atmosphere, atmosphere);
  }, [atmosphere, mounted]);

  // Phase 16d: WHILE CYCLING, the scene on screen lives in this state and never in `progress`. The scene index in
  // `progress` is a synced pref (it is in the sync fingerprint), so writing it on every tick meant a cloud write
  // every 24 s and two devices overwriting each other. `progress.backgroundIndex` now stays the scene the person
  // picked; turning cycling off commits the visible scene once. `null` = nothing has ticked yet, show the picked one.
  const [cycleIndex, setCycleIndex] = useState<number | null>(null);
  const pickedIndexRef = useRef(progress.backgroundIndex);
  useEffect(() => {
    const changedOutsideCycle = pickedIndexRef.current !== progress.backgroundIndex;
    pickedIndexRef.current = progress.backgroundIndex;
    // Phase 16d fix: a restored backup can replace the saved scene while cycling still has a
    // transient display index. Drop that transient value so the restored scene appears now,
    // rather than staying hidden until the next 24-second cycle tick. A normal scene pick is
    // also safe: it writes the same value to both places, so clearing the transient value does
    // not change what is visible.
    if (atmosphere.cycle && changedOutsideCycle) setCycleIndex(null);
  }, [atmosphere.cycle, progress.backgroundIndex]);
  const visibleIndex = (atmosphere.cycle ? cycleIndex : null) ?? progress.backgroundIndex;

  const handleToggleCycleThemes = (enabled: boolean) => {
    if (!enabled && cycleIndex !== null && cycleIndex !== progress.backgroundIndex) {
      const shown = cycleIndex;
      setProgress((p) => ({ ...p, backgroundIndex: shown }));
    }
    setCycleIndex(null);
    setAtmosphere((a) => ({ ...a, cycle: enabled }));
  };
  const handleChooseScene = (backgroundIndex: number) => {
    setProgress((p) => ({ ...p, backgroundIndex }));
    if (atmosphere.cycle) setCycleIndex(backgroundIndex);
  };

  useEffect(() => {
    if (!mounted || !atmosphere.cycle) return;
    const interval = setInterval(() => {
      // Phase 21: a hidden tab keeps its scene. Ticking there would only churn (and load) scene
      // images nobody sees; the scenes simply continue from where the tab was left.
      if (document.visibilityState === "hidden") return;
      setCycleIndex((i) => ((i ?? pickedIndexRef.current) + 1) % backgrounds.length);
    }, THEME_CYCLE_MS);
    return () => clearInterval(interval);
  }, [mounted, atmosphere.cycle]);

  const lessonDays = lessons.map((l) => l.dayNumber);
  // Only an existing day is shown. A hole (Day 14 deleted, state still 14) resolves to the
  // next remaining day, never to lessons[0], so completion cannot be written under a phantom day.
  const activeDay = resolveDay(lessonDays, day);
  const lesson =
    activeDay === null ? null : (lessons.find((item) => item.dayNumber === activeDay) ?? null);
  const position = activeDay === null ? null : lessonPosition(lessonDays, activeDay);
  const prevDay = activeDay === null ? null : stepDay(lessonDays, activeDay, -1);
  const nextDay = activeDay === null ? null : stepDay(lessonDays, activeDay, 1);
  useEffect(() => {
    if (!mounted || activeDay === null || activeDay === day) return;
    setDay(activeDay);
  }, [mounted, activeDay, day]);
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
  const selectDay = (value: number) => {
    if (lessonDays.includes(value)) setDay(value);
  };
  const complete = () => {
    if (!lesson) return;
    const target = lesson.dayNumber;
    setProgress((p) => ({
      ...p,
      completedDays: p.completedDays.includes(target)
        ? p.completedDays.filter((d) => d !== target)
        : [...p.completedDays, target],
    }));
  };
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
    const lookingAt = activeDay ?? day;
    const next = dayAfterDelete(lessonDays, lookingAt, dayNumbers);
    if (next === null) setDay(1);
    else if (next !== day) setDay(next);
  };
  const resetAll = () => {
    setLessons([]);
    setProgress(emptyProgress);
    setCycleIndex(null);
    setDay(1);
  };
  return (
    // Phase 9b: one shared account + sync state for the header button and the Progress card.
    // After a sync replaces the lessons, stay on the same day if it is still there; otherwise
    // the nearest remaining day (never a missing number, and never an unrelated first lesson).
    <AccountSyncProvider
      lessons={lessons}
      progress={progress}
      setLessons={setLessons}
      setProgress={setProgress}
      onApplied={(applied) =>
        setTimeout(
          () =>
            setDay(
              (d) =>
                resolveDay(
                  applied.map((l) => l.dayNumber),
                  d,
                ) ?? 1,
            ),
          0,
        )
      }
      onClearDevice={resetAll}
    >
      {/* Phase 20: `overflow-clip`, not `overflow-hidden` — `hidden` makes this div a scroll
          container, and a scroll container in the ancestor chain captures `position: sticky`
          (the Studio's step row), silently breaking it. `clip` keeps the same clipping without
          becoming a scroll container. Nothing ever scrolled this div programmatically. */}
      <div className="relative min-h-dvh overflow-clip bg-background text-foreground">
        <SceneBackdrop
          backgrounds={backgrounds}
          activeIndex={visibleIndex}
          cycling={atmosphere.cycle}
          darkness={atmosphere.darkness}
          motion={progress.bgZoomSpeed}
          particles={atmosphere.particles}
        />

        <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1520px] flex-col p-3 pb-22 md:p-5 md:pb-22">
          <Header
            tab={tab}
            setTab={setTab}
            positionLabel={
              activeDay !== null && position !== null
                ? dayPositionLabel(activeDay, position, lessons.length)
                : null
            }
            onPrev={() => {
              if (prevDay !== null) setDay(prevDay);
            }}
            onNext={() => {
              if (nextDay !== null) setDay(nextDay);
            }}
            canPrev={prevDay !== null}
            canNext={nextDay !== null}
            quizDue={quizDue}
            onAI={() => (tab === "studio" ? closeStudio() : openStudio())}
            onSound={() => setSoundOpen((v) => !v)}
            onHelp={() => setHelpOpen(true)}
            onProfile={() => setTab("profile")}
          />
          {/* Phase 20: no `overflow-y-auto` here. This column grows with its content
              (`min-h-dvh`), so main never scrolled itself — the window does. The declaration only
              made main a scroll container, which would capture the Studio's sticky step row. */}
          <main className="flex-1 py-5 md:py-7">
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
                <EmptyLessons onAI={openStudio} onRestore={() => setTab("profile")} />
              ) : (
                <WelcomePanel
                  onAI={openStudio}
                  onRestore={() => setTab("profile")}
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
                  day={activeDay ?? day}
                  memory={progress.vocabMemory}
                  setProgress={setProgress}
                  onBack={() => setTab("lesson")}
                  onOpenStudio={openStudio}
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
                  onAI={openStudio}
                  onRestore={() => setTab("profile")}
                />
              </>
            )}
            {mounted && tab === "profile" && (
              <>
                {tips.isVisible("profile") && (
                  <TipCard id="profile" onDismiss={tips.dismiss} className="mb-4 max-w-5xl" />
                )}
                <ProfilePage
                  lessons={lessons}
                  progress={progress}
                  setLessons={setLessons}
                  setProgress={setProgress}
                  emptyProgress={emptyProgress}
                  onRestored={setDay}
                  onResetAll={resetAll}
                  due={quizDue}
                  mastered={countMastered(
                    lessons.flatMap((l) => l.vocab),
                    progress.masteredVocabIds,
                    progress.vocabMemory,
                  )}
                  onOpenProgress={() => setTab("progress")}
                  onOpenQuiz={() => setTab("quiz")}
                  onOpenAtmosphere={() => setTab("atmosphere")}
                  onShowTipsAgain={tips.showAgain}
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
                  active={visibleIndex}
                  setActive={handleChooseScene}
                  darkness={atmosphere.darkness}
                  setDarkness={(darkness) => setAtmosphere((a) => ({ ...a, darkness }))}
                  cycle={atmosphere.cycle}
                  onToggleCycle={handleToggleCycleThemes}
                  motion={progress.bgZoomSpeed}
                  setMotion={(bgZoomSpeed) => setProgress((p) => ({ ...p, bgZoomSpeed }))}
                  particles={atmosphere.particles}
                  setParticles={(particles) => setAtmosphere((a) => ({ ...a, particles }))}
                />
              </>
            )}
            {/* Phase 20: the Studio is a mode like the others. Once opened it stays mounted and is
                only hidden, so the pasted reply, the step and an in-flight Gemini call survive a
                trip to another mode and back. `studioVisited` keeps it out of the DOM until the
                first open. The `studio` tip card stays inside Configure, as before. */}
            {mounted && studioVisited && (
              <div className={tab === "studio" ? "" : "hidden"}>
                <LessonStudio
                  lessons={lessons}
                  progress={progress}
                  showTip={tips.isVisible("studio")}
                  onDismissTip={() => tips.dismiss("studio")}
                  onClose={closeStudio}
                  onImport={(newLesson) => {
                    // The Studio has already asked before a replacement. A replaced day starts over: its old word
                    // records, starred/weak ids and "done" mark go, so they cannot attach to new words at the same ids.
                    const replacing = isReplacement(lessons, newLesson.dayNumber);
                    setLessons((old) => upsertLesson(old, newLesson));
                    if (replacing) setProgress((p) => clearDayWordState(p, newLesson.dayNumber));
                    setDay(newLesson.dayNumber);
                    setTab("lesson");
                  }}
                />
              </div>
            )}
          </main>
        </div>
        {helpOpen && (
          <HelpCard
            onOpenStudio={() => {
              setHelpOpen(false);
              openStudio();
            }}
            onShowTipsAgain={tips.showAgain}
            onClose={() => setHelpOpen(false)}
          />
        )}
        <MusicPanel expanded={soundOpen} onToggleExpanded={() => setSoundOpen((v) => !v)} />
      </div>
    </AccountSyncProvider>
  );
}

function Header({
  tab,
  setTab,
  positionLabel,
  onPrev,
  onNext,
  canPrev,
  canNext,
  quizDue,
  onAI,
  onSound,
  onHelp,
  onProfile,
}: {
  quizDue: number;
  tab: MainTab;
  setTab: (v: MainTab) => void;
  positionLabel: string | null;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  onAI: () => void;
  onSound: () => void;
  onHelp: () => void;
  onProfile: () => void;
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
            className={`hit-area flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
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
        {positionLabel && (
          <div className="hidden items-center rounded-full border border-border/70 bg-glass/50 px-1 py-0.5 sm:flex">
            <button
              type="button"
              onClick={onPrev}
              disabled={!canPrev}
              aria-label="Previous day"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="whitespace-nowrap px-2 font-display text-[11px] font-medium tracking-wide text-primary">
              {positionLabel}
            </span>
            <button
              type="button"
              onClick={onNext}
              disabled={!canNext}
              aria-label="Next day"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
        <HeaderAccount onOpen={onProfile} active={tab === "profile"} />
        {/* Phase 20: this button now toggles the Studio MODE (a page), so it shows an active
            state while the Studio is the current mode. */}
        <button
          onClick={onAI}
          aria-label="AI Lesson Studio"
          aria-pressed={tab === "studio"}
          title="AI Lesson Studio"
          className={`hit-area rounded-lg border p-2 transition-colors ${
            tab === "studio"
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border/80 text-muted-foreground hover:bg-accent hover:text-primary"
          }`}
        >
          <Bot className="size-3.5" />
        </button>
        <button
          onClick={onSound}
          aria-label="Music player"
          title="Music player"
          className="hit-area rounded-lg border border-border/80 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <Music2 className="size-3.5" />
        </button>
        <button
          onClick={onHelp}
          aria-label="Help"
          title="Help"
          className="hit-area rounded-lg border border-border/80 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
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
  const lessonDays = lessons.map((l) => l.dayNumber);
  const place = lessonPosition(lessonDays, lesson.dayNumber);
  const prev = stepDay(lessonDays, lesson.dayNumber, -1);
  const next = stepDay(lessonDays, lesson.dayNumber, 1);
  const placeLabel =
    place === null
      ? `Day ${lesson.dayNumber}`
      : dayPositionLabel(lesson.dayNumber, place, lessons.length);
  return (
    <>
      {/* Phase 16e: on a phone the header's day stepper is hidden, so this row is the quick way to change day (the
          bottom arrows and the curriculum list stay). Arrows walk the remaining days, not day ± 1. */}
      <div className="mx-auto mb-4 flex w-fit max-w-full items-center rounded-full border border-border/70 bg-glass/50 px-1 py-0.5 sm:hidden">
        <button
          type="button"
          onClick={() => {
            if (prev !== null) selectDay(prev);
          }}
          disabled={prev === null}
          aria-label="Previous day"
          className="hit-area rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="whitespace-nowrap px-3 font-display text-xs font-medium tracking-wide text-primary">
          {placeLabel}
        </span>
        <button
          type="button"
          onClick={() => {
            if (next !== null) selectDay(next);
          }}
          disabled={next === null}
          aria-label="Next day"
          className="hit-area rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-12">
        <GlassPane className="lg:col-span-5 lg:ml-2" tilt="-0.5deg">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border/40 pb-3">
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
                className={`hit-area whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  progress.showFurigana
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                Furigana {progress.showFurigana ? "on" : "off"}
              </button>
              <button
                onClick={complete}
                className={`hit-area flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
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
            {lesson.grammar[0]?.title}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground/90">
            {lesson.grammar[0]?.summary}
          </p>
          {lesson.grammar.length > 1 && (
            <p className="mt-1.5 text-xs text-primary/80">
              Also today:{" "}
              {lesson.grammar
                .slice(1)
                .map((g) => g.title)
                .join(" · ")}
            </p>
          )}
          <div className="mt-5 flex gap-1 border-b border-border/50 pb-2.5">
            {(["overview", "grammar", "kanji", "vocab"] as LessonTab[]).map((id) => (
              <button
                key={id}
                onClick={() => setLessonTab(id)}
                className={`hit-area rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
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
              <Grammar key={lesson.dayNumber} lesson={lesson} showReading={progress.showFurigana} />
            )}
            {lessonTab === "kanji" && (
              <Kanji key={lesson.dayNumber} lesson={lesson} showReading={progress.showFurigana} />
            )}
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
                type="button"
                onClick={() => {
                  if (prev !== null) selectDay(prev);
                }}
                disabled={prev === null}
                aria-label="Previous lesson"
                className="hit-area rounded-lg border border-border/70 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (next !== null) selectDay(next);
                }}
                disabled={next === null}
                aria-label="Next lesson"
                className="hit-area rounded-lg border border-border/70 p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
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
          <RhythmChart studyLog={progress.studyLog} compact />
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
    </>
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
                <span className="font-display text-lg drop-shadow-sm">
                  {item.kanji[0]?.character}
                  {item.kanji.length > 1 && (
                    <sup className="ml-0.5 font-sans text-[9px] text-muted-foreground">
                      +{item.kanji.length - 1}
                    </sup>
                  )}
                </span>
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
          title={deleteDaysConfirm(confirmDays).title}
          body={deleteDaysConfirm(confirmDays).body}
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
          Build a day with AI Lesson Studio, or restore a backup from your Profile.
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
  // Phase 17: a day can hold several grammar points / kanji; the Overview shows the first of each and points to the tabs.
  const grammar = lesson.grammar[0];
  const kanji = lesson.kanji[0];
  const moreGrammar = lesson.grammar.length - 1;
  const moreKanji = lesson.kanji.length - 1;
  const ex = grammar?.examples[0];
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Pattern & Structure
        </p>
        <div className="mt-2 rounded-lg border border-primary/25 bg-primary/10 p-3.5 font-display text-base tracking-wide text-primary shadow-[inset_0_1px_0_0_var(--highlight)]">
          {grammar?.structure}
        </div>
        {moreGrammar > 0 && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            +{moreGrammar} more grammar {moreGrammar === 1 ? "point" : "points"} in the Grammar tab
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border/50 bg-glass/40 p-3.5">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
          Example in context
        </p>
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg tracking-wide text-foreground">{ex?.japanese}</p>
          {ex?.japanese && <SpeakButton text={ex.japanese} label={ex.japanese} />}
        </div>
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
          <p className="mt-1 font-display text-4xl font-medium text-primary">{kanji?.character}</p>
          <p className="mt-1 text-xs font-medium text-foreground">{kanji?.meaning}</p>
          <p className="mt-0.5 text-[11px] font-mono text-muted-foreground">
            {kanji?.onyomi.join(" · ")}
          </p>
          {moreKanji > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              +{moreKanji} more in the Kanji tab
            </p>
          )}
        </div>
        <div className="rounded-lg border border-border/40 bg-glass/30 p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Natural phrase
          </p>
          <div className="mt-1 flex items-start justify-between gap-2">
            <p className="font-display text-base tracking-wide text-foreground">
              {lesson.naturalPhrase.phrase}
            </p>
            <SpeakButton text={lesson.naturalPhrase.phrase} label={lesson.naturalPhrase.phrase} />
          </div>
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
  // Phase 17: with several grammar points a chip row picks one; a one-point day renders exactly as before.
  const [picked, setPicked] = useState(0);
  const points = lesson.grammar;
  const point = points[Math.min(picked, points.length - 1)];
  if (!point) return null;
  const many = points.length > 1;
  return (
    <div className="space-y-4 text-sm">
      {many && (
        <>
          <PointChips
            labels={points.map((g) => g.title)}
            active={Math.min(picked, points.length - 1)}
            onSelect={setPicked}
            ariaLabel="Grammar points"
          />
          <div>
            <h2 className="font-display text-lg font-medium leading-snug text-foreground">
              {point.title}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{point.summary}</p>
            <div className="mt-2 rounded-lg border border-primary/25 bg-primary/10 p-3 font-display text-sm tracking-wide text-primary">
              {point.structure}
            </div>
          </div>
        </>
      )}
      <div className="rounded-lg border border-border/40 bg-glass/30 p-3.5 leading-relaxed text-foreground/85">
        {point.explanation}
      </div>
      <div className="space-y-2.5 pt-1">
        {point.examples.map((ex, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/40 border-l-2 border-l-primary bg-background/20 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-display text-base tracking-wide text-foreground">{ex.japanese}</p>
              <SpeakButton text={ex.japanese} label={ex.japanese} />
            </div>
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
  const canSpeak = useSpeechSupported();
  // Phase 17: with several kanji a chip row picks one; a one-kanji day renders exactly as before.
  const [picked, setPicked] = useState(0);
  const all = lesson.kanji;
  const current = Math.min(picked, all.length - 1);
  const kanji = all[current];
  if (!kanji) return null;
  return (
    <div className="space-y-4">
      <PointChips
        labels={all.map((k) => k.character)}
        active={current}
        onSelect={setPicked}
        ariaLabel="Kanji of the day"
        large
      />
      <div className="flex items-center gap-5 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <span className="font-display text-6xl font-medium text-primary drop-shadow-sm">
          {kanji.character}
        </span>
        <div>
          <h2 className="font-display text-xl font-medium text-foreground">{kanji.meaning}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {kanji.strokes} strokes · Radical {kanji.radical}
          </p>
          {showReading && (
            <div className="mt-1 text-xs text-foreground/90">
              <span className="text-muted-foreground">On: </span>
              {kanji.onyomi.join(" / ") || "—"}
              <span className="mx-2 text-border">|</span>
              <span className="text-muted-foreground">Kun: </span>
              {kanji.kunyomi.join(" / ") || "—"}
            </div>
          )}
          {canSpeak && (
            <button
              onClick={() => speak(speakableReading(kanji))}
              className="hit-area mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Volume2 className="size-3.5" />
              Listen
            </button>
          )}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2">
          Compounds
        </p>
        <div className="space-y-1.5">
          {kanji.compounds.map((c) => (
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
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{c.meaning}</span>
                <SpeakButton text={c.reading || c.word} label={c.word} className="-my-1" />
              </span>
            </div>
          ))}
        </div>
      </div>
      {(kanji.memoryTip || kanji.rendakuNote) && (
        <div className="space-y-2 border-t border-border/50 pt-3.5 text-xs text-muted-foreground">
          {kanji.memoryTip && (
            <p className="rounded-lg border border-border/40 bg-background/20 p-2.5 leading-relaxed">
              <span className="font-semibold text-primary">Memory tip: </span>
              {kanji.memoryTip}
            </p>
          )}
          {kanji.rendakuNote && (
            <p className="rounded-lg border border-border/40 bg-background/20 p-2.5 leading-relaxed">
              <span className="font-semibold text-primary">Sound notes: </span>
              {kanji.rendakuNote}
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
function ProgressView({
  lessons,
  progress,
  setProgress,
  onAI,
  onRestore,
}: {
  lessons: DayLesson[];
  progress: UserProgressState;
  setProgress: React.Dispatch<React.SetStateAction<UserProgressState>>;
  onAI: () => void;
  /** Phase 19a: Export / Restore / Reset live on the Profile page now, so this opens it. */
  onRestore: () => void;
}) {
  // Client-only (the shell mounts this tab after hydration), and re-read when the tab comes back, so the numbers
  // here use the same "today" as the Quiz.
  const today = useToday() ?? localDay();
  const allWords = useMemo(() => lessons.flatMap((l) => l.vocab), [lessons]);
  const summary = useMemo(
    () => memorySummary(allWords, progress.vocabMemory, today),
    [allWords, progress.vocabMemory, today],
  );
  const toggleStar = (id: string) =>
    setProgress((p) => ({
      ...p,
      masteredVocabIds: p.masteredVocabIds.includes(id)
        ? p.masteredVocabIds.filter((x) => x !== id)
        : [...p.masteredVocabIds, id],
    }));
  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-3">
      <GlassPane>
        <span className="font-display text-xs font-semibold tracking-wider text-primary">
          学習 · ARCHIVE
        </span>
        <div className="mt-6 grid grid-cols-2 gap-5">
          <Metric value={progress.completedDays.length} label="days" />
          <Metric
            value={countMastered(allWords, progress.masteredVocabIds, progress.vocabMemory)}
            label="mastered"
          />
          <Metric value={progress.totalQuizzesTaken} label="answered" />
          <Metric value={lessons.reduce((n, l) => n + l.vocab.length, 0)} label="words" />
        </div>
        <RhythmChart studyLog={progress.studyLog} />
        {lessons.length > 0 && <MemoryBlock summary={summary} />}
      </GlassPane>
      <GlassPane className="lg:col-span-2 lg:mt-4">
        {lessons.length === 0 ? (
          <div className="py-6">
            <h2 className="font-display text-xl font-medium text-foreground">No lessons yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Build a day with AI Lesson Studio, or restore a backup. Your words will show up here.
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onAI}
                className="hit-area flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-105"
              >
                <Bot className="size-4" />
                Build your first lesson
              </button>
              <button
                type="button"
                onClick={onRestore}
                className="hit-area flex items-center gap-2 rounded-lg border border-border/70 px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <Upload className="size-4" />
                Restore a backup
              </button>
            </div>
          </div>
        ) : (
          <WordList
            words={allWords}
            vocabMemory={progress.vocabMemory}
            starredIds={progress.masteredVocabIds}
            weakIds={progress.weakVocabIds}
            today={today}
            onToggleStar={toggleStar}
          />
        )}
      </GlassPane>
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
  motion,
  setMotion,
  particles,
  setParticles,
}: {
  backgrounds: { name: string; url: string }[];
  active: number;
  setActive: (v: number) => void;
  darkness: number;
  setDarkness: (v: number) => void;
  cycle: boolean;
  onToggleCycle: (v: boolean) => void;
  motion: UserProgressState["bgZoomSpeed"];
  setMotion: (v: UserProgressState["bgZoomSpeed"]) => void;
  particles: ParticleDensity;
  setParticles: (v: ParticleDensity) => void;
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
                loading="lazy"
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-scrim/85 via-scrim/40 to-transparent p-3 text-left">
                <span className="font-display text-xs font-medium text-foreground tracking-wide">
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
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Scene motion</span>
            <div
              role="radiogroup"
              aria-label="Scene motion"
              className="inline-flex rounded-lg border border-border/60 bg-glass/40 p-0.5"
            >
              {(["slow", "medium", "still"] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  role="radio"
                  aria-checked={motion === speed}
                  onClick={() => setMotion(speed)}
                  className={`hit-area rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    motion === speed
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {speed}
                </button>
              ))}
            </div>
          </div>
          {/* Phase 21: the scene's particle effect. Same segmented control as Scene motion;
              device-only like the rest of kiroku_atmosphere_v1. */}
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Particles</span>
            <div
              role="radiogroup"
              aria-label="Particles"
              className="inline-flex rounded-lg border border-border/60 bg-glass/40 p-0.5"
            >
              {(["off", "subtle", "lively"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="radio"
                  aria-checked={particles === level}
                  onClick={() => setParticles(level)}
                  className={`hit-area rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    particles === level
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Reading contrast</span>
            <span className="font-mono text-primary font-semibold tabular-nums">
              {Math.round(darkness * 100)}%
            </span>
          </div>
          <input
            className="mt-2 w-full accent-primary"
            type="range"
            min={DARKNESS_MIN}
            max={DARKNESS_MAX}
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
