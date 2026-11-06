import { useState } from "react";
import {
  comparisonScale,
  sharedStudyDays,
  type AlignedFriendDay,
  type FriendCard,
} from "@/lib/friends";
import { weekdayName } from "@/lib/study-log";
import { friendButton } from "./friends-ui";

export function MirrorBars({
  own,
  other,
  name,
  sameAccent,
  accent,
  togetherFresh,
}: {
  own: readonly AlignedFriendDay[];
  other: readonly AlignedFriendDay[];
  name: string;
  sameAccent: boolean;
  accent: FriendCard["acc"];
  togetherFresh: boolean;
}) {
  const [metric, setMetric] = useState<"answers" | "writing">("answers");
  const ownScale = comparisonScale(own.map((row) => row[metric]));
  const otherScale = comparisonScale(other.map((row) => row[metric]));
  const together = sharedStudyDays(own, other, togetherFresh);
  const label = `${metric === "answers" ? "Quiz answers" : "Writing marks"}, last seven calendar days. Bars are scaled to each person's own best day. ${own.map((row, i) => `${row.day}: you ${row[metric] ?? "no data"}; ${name} ${other[i]?.[metric] ?? "no data"}.`).join(" ")}`;
  return (
    <section aria-label="Weekly rhythm" className="glass-panel rounded-xl p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base">This week</h2>
        <div className="flex gap-2" role="group" aria-label="Rhythm measure">
          {(["answers", "writing"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${friendButton} text-[11px] ${metric === value ? "border-primary/60 bg-primary/10" : ""}`}
              aria-pressed={metric === value}
              onClick={() => setMetric(value)}
            >
              {value === "answers" ? "Quiz answers" : "Writing marks"}
            </button>
          ))}
        </div>
      </div>
      <div role="img" aria-label={label} className="friends-mirror mt-4">
        {own.map((row, i) => {
          const yours = row[metric],
            theirs = other[i]?.[metric] ?? null;
          return (
            <div key={row.day} className="friends-mirror-column" aria-hidden="true">
              <div className="friends-mirror-half friends-mirror-upper">
                {yours === null ? (
                  <span className="friends-no-data friends-bar-unknown" />
                ) : (
                  <span
                    className={`friends-bar friends-bar-up ${yours === 0 ? "friends-bar-zero" : "bg-primary"}`}
                    style={{
                      height: yours === 0 ? "2px" : `${(yours / ownScale) * 100}%`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                )}
              </div>
              <span className="friends-mirror-axis" />
              <div data-card-accent={accent} className="friends-mirror-half friends-mirror-lower">
                {theirs === null ? (
                  <span className="friends-no-data friends-bar-unknown" />
                ) : (
                  <span
                    className={`friends-bar bar-grow-down ${theirs === 0 ? "friends-bar-zero" : sameAccent ? "friends-same-accent" : "bg-primary"}`}
                    style={{
                      height: theirs === 0 ? "2px" : `${(theirs / otherScale) * 100}%`,
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div
        aria-hidden="true"
        className="mt-2 grid grid-cols-7 justify-items-center text-[10px] text-muted-foreground"
      >
        {own.map((row, i) => (
          <span
            key={row.day}
            className={`grid size-5 place-items-center rounded-full ${i === 6 ? "font-semibold text-primary" : ""} ${together?.days[i]?.shared ? "bg-primary/15 ring-1 ring-primary/50" : ""}`}
          >
            {weekdayName(row.day).slice(0, 1)}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        You above · {name} below. Bars are scaled to each person's own best day.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Hatched cells mean no data available.</p>
      {together && (
        <div className="mt-4 border-t border-border pt-3">
          <div className="grid grid-cols-7 justify-items-center" aria-hidden="true">
            {together.days.map((day) => (
              <span
                key={day.day}
                className={`size-2.5 rounded-full ${day.shared === null ? "friends-no-data" : day.shared ? "bg-primary ring-1 ring-primary/60" : "bg-foreground/15"}`}
              />
            ))}
          </div>
          <p className="mt-3 text-xs">
            {together.count === 0
              ? "No shared study days in the available data."
              : together.covered === 7
                ? `You both studied on ${together.count} of the last 7 days.`
                : `You both studied on ${together.count} of ${together.covered} days with shared data.`}
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">
        Dates follow each person’s local day; this is not simultaneous activity. Today’s activity is
        known only up to the shared update.
      </p>
    </section>
  );
}
