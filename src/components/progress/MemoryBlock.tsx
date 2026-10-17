// Phase 19b — the Memory block on the Progress tab: how many words sit in each Leitner box, and when the words in
// review come due. Pure drawing: every number and every piece of wording comes from `src/lib/memory-summary.ts`
// (checked by a script). It reads the same records the Quiz does, so "Due today" here is the Quiz's "Due today".
import { TOP_BOX } from "@/lib/word-memory";
import {
  DUE_BUCKETS,
  DUE_ROW_LABELS,
  MEMORY_EMPTY,
  boxTitle,
  memoryAriaLabel,
  reviewLine,
  type MemorySummary,
} from "@/lib/memory-summary";

export function MemoryBlock({ summary }: { summary: MemorySummary }) {
  const tallest = Math.max(1, ...summary.boxes);
  return (
    <section aria-label="Memory" className="mt-6">
      <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <span>Memory</span>
        {summary.inReview > 0 && (
          <span className="font-semibold text-primary">{reviewLine(summary)}</span>
        )}
      </div>
      {summary.inReview === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{MEMORY_EMPTY}</p>
      ) : (
        <>
          <div role="img" aria-label={memoryAriaLabel(summary)}>
            <div className="mt-3 grid h-14 grid-cols-5 gap-1.5">
              {summary.boxes.map((n, i) => (
                <div
                  key={i}
                  title={boxTitle(i + 1)}
                  className="flex h-full flex-col items-center justify-end gap-1"
                >
                  <span className="text-[10px] tabular-nums text-muted-foreground">{n}</span>
                  {n === 0 ? (
                    <div className="h-0.5 w-3/5 max-w-6 rounded-full bg-foreground/15" />
                  ) : (
                    <div
                      style={{ height: `${(n / tallest) * 70}%`, animationDelay: `${i * 60}ms` }}
                      className={`bar-grow min-h-1 w-3/5 max-w-6 rounded-sm ${
                        i + 1 === TOP_BOX ? "bg-primary" : "bg-primary/45"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div
              aria-hidden="true"
              className="mt-1.5 grid grid-cols-5 gap-1.5 text-center text-[10px] text-muted-foreground"
            >
              {summary.boxes.map((_, i) => (
                <span key={i} className={i + 1 === TOP_BOX ? "font-semibold text-primary" : ""}>
                  {i + 1 === TOP_BOX ? "5 ★" : i + 1}
                </span>
              ))}
            </div>
          </div>
          <dl className="mt-4 grid gap-1.5 text-sm">
            {DUE_BUCKETS.map((b) => (
              <div key={b} className="flex items-baseline justify-between">
                <dt className="text-muted-foreground">{DUE_ROW_LABELS[b]}</dt>
                <dd
                  className={`font-display tabular-nums ${
                    b === "today" && summary.due[b] > 0 ? "text-primary" : "text-foreground"
                  }`}
                >
                  {summary.due[b]}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
