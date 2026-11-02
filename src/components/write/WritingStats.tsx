// Writing quests, Phase Q9 — the "Your writing" section at the bottom of the Write page: seven hand-built bars (today
// last), the marked-by-you versus checked-by-photo split, and the totals line. All numbers and wording come from
// `src/lib/writing-stats.ts` (pure, checked by a script); this file only draws them.
//
// Nothing here reveals a kanji, so it is safe to show beside a page that is still being written. It shows nothing until
// the first page has been saved, makes no network call, writes nothing, and uses no animation. The bars are drawn with
// theme tokens only (`bg-primary` for right marks, `bg-foreground/15` for the rest), so they follow the accent colour.
// Colour is never the only carrier: every bar has its numbers under it, and a screen reader gets one sentence for the
// week plus a plain table (the bars themselves are `role="img"`, which hides their children).
import { useId, useMemo } from "react";
import {
  dayCount,
  hasWritingHistory,
  totalsParts,
  weekAria,
  weekLabel,
  weeklyWriting,
  writingScale,
  writingTotals,
} from "@/lib/writing-stats";
import { weekdayName } from "@/lib/study-log";
import type { WritingDay } from "@/types/japanese";

export function WritingStats({
  writingLog,
  today,
}: {
  writingLog: Record<string, WritingDay>;
  /** The local day from `useToday()`; null before the client has read the clock (nothing is drawn). */
  today: string | null;
}) {
  const headingId = useId();
  const week = useMemo(
    () => (today === null ? [] : weeklyWriting(writingLog, today)),
    [writingLog, today],
  );
  const totals = useMemo(() => writingTotals(writingLog, today ?? undefined), [writingLog, today]);
  const scale = writingScale(week);
  const parts = totalsParts(totals);

  if (today === null || week.length === 0 || !hasWritingHistory(writingLog, today)) return null;

  // The split bar needs right marks to split; with none there is nothing to show but the zeroes in the line.
  const splitShown = totals.ok > 0;
  const photoShare = splitShown ? (totals.p / totals.ok) * 100 : 0;

  return (
    <section aria-labelledby={headingId} className="mt-8 border-t border-border/60 pt-5">
      <h2 id={headingId} className="font-display text-xl text-foreground">
        Your writing
      </h2>

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>7-day marks</span>
        <span className="font-semibold text-primary">{weekLabel(week)}</span>
      </div>

      <div role="img" aria-label={weekAria(week)} className="mt-3 grid h-16 grid-cols-7 gap-1.5">
        {week.map((d) => (
          <div key={d.day} className="flex h-full flex-col justify-end">
            {d.n === 0 ? (
              <div className="mx-auto h-0.5 w-3/5 max-w-6 rounded-full bg-foreground/15" />
            ) : (
              <div
                style={{ height: `${(d.n / scale) * 100}%` }}
                className="mx-auto flex min-h-1 w-3/5 max-w-6 flex-col overflow-hidden rounded-sm"
              >
                <div style={{ flexGrow: d.n - d.ok }} className="bg-foreground/15" />
                <div style={{ flexGrow: d.ok }} className="bg-primary" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-1.5 grid grid-cols-7 gap-1.5 text-center text-[10px] text-muted-foreground"
      >
        {week.map((d, i) => (
          <span key={d.day} className={i === week.length - 1 ? "font-semibold text-primary" : ""}>
            {weekdayName(d.day)}
          </span>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="mt-0.5 grid grid-cols-7 gap-1.5 text-center text-[11px] tabular-nums text-foreground"
      >
        {week.map((d) => (
          <span key={d.day} className={d.n === 0 ? "text-muted-foreground" : ""}>
            {dayCount(d)}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>Writing marks, last {week.length} days</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">Marks saved</th>
            <th scope="col">Written right</th>
            <th scope="col">Checked by photo</th>
          </tr>
        </thead>
        <tbody>
          {week.map((d) => (
            <tr key={d.day}>
              <th scope="row">{weekdayName(d.day, true)}</th>
              <td>{d.n}</td>
              <td>{d.ok}</td>
              <td>{d.p}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {splitShown && (
        <div
          aria-hidden="true"
          className="mt-4 flex h-1.5 overflow-hidden rounded-full bg-foreground/10"
        >
          <div style={{ width: `${photoShare}%` }} className="bg-success" />
          <div style={{ width: `${100 - photoShare}%` }} className="bg-foreground/30" />
        </div>
      )}
      <p className={`${splitShown ? "mt-2" : "mt-4"} text-xs text-muted-foreground`}>
        {parts.right} ·{" "}
        {splitShown && (
          <span aria-hidden="true" className="mr-1 inline-block size-1.5 rounded-full bg-success" />
        )}
        {parts.photo} ·{" "}
        {splitShown && (
          <span
            aria-hidden="true"
            className="mr-1 inline-block size-1.5 rounded-full bg-foreground/30"
          />
        )}
        {parts.byYou} {parts.window}
      </p>
    </section>
  );
}
