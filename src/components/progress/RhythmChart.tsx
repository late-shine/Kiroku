// Phase 18b — the real 7-day chart (replaces the old hardcoded `MomentumGraph` curve). Seven bars, today last, from
// `progress.studyLog` (Phase 18a). Each bar is stacked: right answers in `primary`, wrong ones in a lighter `primary/35`.
// The full version (Progress tab) has a caption and tap / hover details; the compact one (lesson workspace) is the bars,
// the weekday letters and the label. All numbers and wording come from `src/lib/study-log.ts` (pure, checked by a script).
import { useState, useSyncExternalStore } from "react";
import { localDay } from "@/lib/word-memory";
import {
  chartScale,
  dayCaption,
  hasStudyHistory,
  lastNDays,
  rhythmLabel,
  weekAriaLabel,
  weekCaption,
  weekdayName,
  type DayActivity,
  type StudyLog,
} from "@/lib/study-log";

const DAYS_SHOWN = 7;

// "Today" is read from the device clock, so it is client-only: the server render and the first client render get
// `null` (an empty placeholder), then it is filled in. It is read again when the tab comes back, so a tab left open
// past midnight moves on.
const subscribeToday = (onChange: () => void) => {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
};
const useToday = (): string | null =>
  useSyncExternalStore(
    subscribeToday,
    () => localDay(),
    () => null,
  );

const PLACEHOLDER_DAYS: DayActivity[] = Array.from({ length: DAYS_SHOWN }, () => ({
  day: "",
  answered: 0,
  correct: 0,
}));

export function RhythmChart({
  studyLog,
  compact = false,
}: {
  studyLog: StudyLog;
  compact?: boolean;
}) {
  const today = useToday();
  // A tapped bar stays selected until it is tapped again; a hovered bar (mouse only) shows its numbers while the
  // pointer is over it. Touch has no hover, so a tap is the only way there.
  const [pinned, setPinned] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const days = today ? lastNDays(studyLog, DAYS_SHOWN, today) : PLACEHOLDER_DAYS;
  const hasHistory = hasStudyHistory(studyLog);
  const scale = chartScale(days);
  const shown = compact ? null : (hover ?? pinned);
  const shownDay = shown === null ? undefined : days[shown];

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>7-day rhythm</span>
        <span className="font-semibold text-primary">{rhythmLabel(days, hasHistory)}</span>
      </div>
      <div
        role="img"
        aria-label={weekAriaLabel(days, hasHistory)}
        className={`mt-3 grid grid-cols-7 gap-1.5 ${compact ? "h-10" : "h-16"}`}
      >
        {days.map((d, i) => {
          const wrong = d.answered - d.correct;
          const active = shown === i;
          return (
            <div
              key={d.day || i}
              onPointerEnter={(e) => !compact && e.pointerType === "mouse" && setHover(i)}
              onPointerLeave={() => setHover(null)}
              onClick={() => !compact && setPinned((p) => (p === i ? null : i))}
              className={`flex h-full flex-col justify-end ${compact ? "" : "cursor-pointer"}`}
            >
              {d.answered === 0 ? (
                <div className="mx-auto h-0.5 w-3/5 max-w-6 rounded-full bg-foreground/15" />
              ) : (
                <div
                  style={{
                    height: `${(d.answered / scale) * 100}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                  className={`bar-grow mx-auto flex min-h-1 w-3/5 max-w-6 flex-col overflow-hidden rounded-sm transition-opacity ${
                    shown !== null && !active ? "opacity-50" : ""
                  }`}
                >
                  <div style={{ flexGrow: wrong }} className="bg-primary/35" />
                  <div style={{ flexGrow: d.correct }} className="bg-primary" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground"
      >
        {days.map((d, i) => (
          <span
            key={d.day || i}
            className={i === DAYS_SHOWN - 1 && today ? "font-semibold text-primary" : ""}
          >
            {weekdayName(d.day).slice(0, 1) || " "}
          </span>
        ))}
      </div>
      {!compact && (
        <p className="mt-2 min-h-4 text-xs text-muted-foreground" aria-live="polite">
          {shownDay
            ? dayCaption(shownDay)
            : hasHistory
              ? weekCaption(days)
              : "Answer a few quiz questions and your week shows up here."}
        </p>
      )}
    </div>
  );
}
