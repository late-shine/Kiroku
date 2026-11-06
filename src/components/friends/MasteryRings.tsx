import { masteryFraction, type NotebookSummary } from "@/lib/friends";

export function MasteryRings({ own, other }: { own: NotebookSummary; other: NotebookSummary }) {
  const yours = masteryFraction(own.m, own.vc),
    theirs = masteryFraction(other.m, other.vc);
  const sentence = (name: string, person: NotebookSummary, fraction: number | null) =>
    fraction === null
      ? `${name}: ${person.m} words mastered. No vocabulary total is available for a percentage.`
      : `${name}: ${Math.round(fraction * 100)}% of ${name === "You" ? "your" : "their"} words mastered (${person.m} of ${person.vc}).`;
  return (
    <section
      className="glass-panel flex flex-wrap items-center gap-5 rounded-xl p-4 md:p-5"
      aria-label="Words mastered in each notebook"
    >
      {yours !== null && theirs !== null && (
        <svg aria-hidden="true" viewBox="0 0 120 120" className="size-28 shrink-0 -rotate-90">
          {[48, 34].map((radius) => (
            <circle
              key={radius}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="8"
            />
          ))}
          <circle
            className="friends-mastery-circle"
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 48}
            style={
              {
                "--ring-length": 2 * Math.PI * 48,
                "--ring-end": 2 * Math.PI * 48 * (1 - yours),
                strokeDashoffset: 2 * Math.PI * 48 * (1 - yours),
              } as React.CSSProperties
            }
          />
          <circle
            data-card-accent={other.acc}
            className="friends-mastery-circle"
            cx="60"
            cy="60"
            r="34"
            fill="none"
            stroke={own.acc === other.acc ? "var(--foreground)" : "var(--primary)"}
            strokeOpacity={own.acc === other.acc ? 0.55 : 1}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 34}
            style={
              {
                "--ring-length": 2 * Math.PI * 34,
                "--ring-end": 2 * Math.PI * 34 * (1 - theirs),
                strokeDashoffset: 2 * Math.PI * 34 * (1 - theirs),
              } as React.CSSProperties
            }
          />
        </svg>
      )}
      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <h2 className="font-display text-base">Words taking root</h2>
        <p>{sentence("You", own, yours)}</p>
        <p>{sentence(other.n, other, theirs)}</p>
      </div>
    </section>
  );
}
