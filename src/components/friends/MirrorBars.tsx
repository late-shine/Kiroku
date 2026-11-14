import { useId, useState } from "react";
import { BookOpen, PenLine } from "lucide-react";
import { comparisonScale, sharedStudyDays, type AlignedFriendDay } from "@/lib/friends";
import { weekdayName } from "@/lib/study-log";

type Point = { x: number; y: number };
function segments(values: readonly (number | null)[], maximum: number): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push({ x: 48 + index * 104, y: 194 - (value / maximum) * 156 });
  });
  if (run.length) runs.push(run);
  return runs;
}

export function MirrorBars({
  own,
  other,
  name,
  togetherFresh,
}: {
  own: readonly AlignedFriendDay[];
  other: readonly AlignedFriendDay[];
  name: string;
  togetherFresh: boolean;
}) {
  const id = useId();
  const [metric, setMetric] = useState<"answers" | "writing">("answers");
  const [selected, setSelected] = useState(6);
  const theirs = own.map((row) => other.find((peer) => peer.day === row.day)?.[metric] ?? null);
  const yours = own.map((row) => row[metric]);
  const maximum = Math.ceil(comparisonScale([...yours, ...theirs]) / 4) * 4;
  const together = sharedStudyDays(own, other, togetherFresh);
  const measure = metric === "answers" ? "quiz answers" : "writing marks";
  const day = own[selected];
  const label = `${measure}, last seven calendar days. Both lines use the same scale, zero to ${maximum}. ${own.map((row, index) => `${row.day}: you ${yours[index] ?? "no data"}; ${name} ${theirs[index] ?? "no data"}.`).join(" ")}`;
  const people = [
    { label: "You", values: yours, ink: "self" },
    { label: name, values: theirs, ink: "peer" },
  ];
  return (
    <section className="circle-panel rhythm-panel" aria-label="Weekly rhythm">
      <header className="circle-panel-heading">
        <div>
          <p className="circle-eyebrow">
            <span lang="ja">七日</span> / WEEKLY RHYTHM
          </p>
          <h2>A week, written together.</h2>
        </div>
        <div className="rhythm-measures" role="group" aria-label="Rhythm measure">
          <button
            type="button"
            aria-pressed={metric === "answers"}
            onClick={() => setMetric("answers")}
          >
            <BookOpen aria-hidden="true" /> Quiz
          </button>
          <button
            type="button"
            aria-pressed={metric === "writing"}
            onClick={() => setMetric("writing")}
          >
            <PenLine aria-hidden="true" /> Writing
          </button>
        </div>
      </header>
      <div className="rhythm-totals">
        {people.map((person) => {
          const known = person.values.filter((value): value is number => value !== null);
          return (
            <div key={person.ink} data-ink={person.ink}>
              <span className="rhythm-person">
                <i aria-hidden="true" />
                {person.label}
              </span>
              <p>
                <strong>
                  {known.length
                    ? known.reduce((sum, value) => sum + value, 0).toLocaleString("en")
                    : "—"}
                </strong>{" "}
                <span>{measure}</span>
              </p>
              <small>
                {known.length === 7
                  ? "Over the last seven days"
                  : `${known.length} of 7 days recorded`}
              </small>
            </div>
          );
        })}
      </div>
      <div className="rhythm-plot">
        <svg viewBox="0 0 720 220" role="img" aria-label={label}>
          <defs>
            {people.map((person) => (
              <linearGradient
                key={person.ink}
                id={`${id}-${person.ink}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={`var(--circle-${person.ink})`} stopOpacity=".2" />
                <stop offset="100%" stopColor={`var(--circle-${person.ink})`} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction} className="rhythm-gridline">
              <line x1="48" x2="672" y1={194 - fraction * 156} y2={194 - fraction * 156} />
              <text x="33" y={198 - fraction * 156} textAnchor="end">
                {(maximum * fraction).toLocaleString("en")}
              </text>
            </g>
          ))}
          <rect
            className="rhythm-selected-column"
            x={24 + selected * 104}
            y="22"
            width="48"
            height="180"
            rx="12"
          />
          {people.map((person) => (
            <g key={person.ink} data-ink={person.ink}>
              {segments(person.values, maximum).map((run, index) => (
                <g key={index}>
                  {run.length > 1 && (
                    <path
                      d={`M${run.map((point) => `${point.x},${point.y}`).join(" L")} L${run[run.length - 1]!.x},194 L${run[0]!.x},194 Z`}
                      fill={`url(#${id}-${person.ink})`}
                    />
                  )}
                  <polyline
                    className="rhythm-line"
                    points={run.map((point) => `${point.x},${point.y}`).join(" ")}
                  />
                </g>
              ))}
              {person.values.map((value, index) =>
                value === null ? null : person.ink === "self" ? (
                  <circle
                    key={index}
                    className="rhythm-point"
                    cx={48 + index * 104}
                    cy={194 - (value / maximum) * 156}
                    r={selected === index ? 5 : 3.5}
                  />
                ) : (
                  <rect
                    key={index}
                    className="rhythm-point"
                    x={44 + index * 104}
                    y={190 - (value / maximum) * 156}
                    width="8"
                    height="8"
                    rx="1"
                    transform={`rotate(45 ${48 + index * 104} ${194 - (value / maximum) * 156})`}
                  />
                ),
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="rhythm-days" role="group" aria-label="Inspect a day">
        {own.map((row, index) => (
          <button
            key={row.day}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            aria-label={`${weekdayName(row.day)}, ${row.day}${together?.days[index]?.shared ? ", both studied" : ""}`}
          >
            <span>{weekdayName(row.day).slice(0, 3)}</span>
            <strong>{Number(row.day.slice(-2))}</strong>
            <i
              aria-hidden="true"
              data-shared={together?.days[index]?.shared === true}
              data-unknown={yours[index] === null || theirs[index] === null}
            />
          </button>
        ))}
      </div>
      <div className="rhythm-readout" aria-live="polite" aria-atomic="true">
        <span>{day ? `${weekdayName(day.day)} · ${day.day}` : "Choose a day"}</span>
        <span data-ink="self">
          You <b>{yours[selected] ?? "No data"}</b>
        </span>
        <span data-ink="peer">
          {name} <b>{theirs[selected] ?? "No data"}</b>
        </span>
        <span className="sr-only">{measure}</span>
      </div>
      {together && (
        <p className="rhythm-together">
          <span aria-hidden="true">↔</span>{" "}
          {together.count
            ? `You both made time to study on ${together.count} of ${together.covered} recorded days.`
            : "No shared study days in the available dates yet."}
        </p>
      )}
      <p className="circle-footnote">
        One scale for both people. Gaps mean no data, not zero. Each date follows your own local
        day; today is recorded up to the shared update.
      </p>
    </section>
  );
}
