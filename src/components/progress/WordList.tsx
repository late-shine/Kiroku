// Phase 19b — the Progress tab's word list: a search box, five filters with counts, and a row per word showing where
// it sits in review (box pips, "Due", "Weak", or "Not in review") next to the star. The state of each word and every
// piece of wording comes from `src/lib/memory-summary.ts` (pure, checked by a script); this file only draws.
import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import type { VocabWord } from "@/types/japanese";
import { TOP_BOX, masteryState, type VocabMemory } from "@/lib/word-memory";
import {
  FILTER_LABELS,
  WORD_FILTERS,
  boxTitle,
  describeWords,
  emptyListMessage,
  filterCounts,
  showingLine,
  visibleWords,
  type WordFilter,
  type WordStatus,
} from "@/lib/memory-summary";

function StatusMarks({ status }: { status: WordStatus }) {
  if (!status.inReview || status.box === null) {
    return <span className="text-[11px] text-muted-foreground/70">Not in review</span>;
  }
  return (
    <>
      <span
        role="img"
        aria-label={`Box ${status.box} of ${TOP_BOX}`}
        title={boxTitle(status.box)}
        className="flex items-center gap-1"
      >
        {Array.from({ length: TOP_BOX }, (_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full ${i < (status.box ?? 0) ? "bg-primary" : "bg-foreground/15"}`}
          />
        ))}
      </span>
      {status.due && (
        <span className="rounded-md border border-primary/40 bg-primary/15 px-1.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          Due
        </span>
      )}
    </>
  );
}

export function WordList({
  words,
  vocabMemory,
  starredIds,
  weakIds,
  today,
  onToggleStar,
}: {
  words: readonly VocabWord[];
  vocabMemory: VocabMemory;
  starredIds: readonly string[];
  weakIds: readonly string[];
  today: string;
  onToggleStar: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WordFilter>("all");
  const entries = useMemo(
    () => describeWords(words, vocabMemory, weakIds, starredIds, today),
    [words, vocabMemory, weakIds, starredIds, today],
  );
  const counts = useMemo(() => filterCounts(entries), [entries]);
  const shown = visibleWords(entries, filter, query);

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Japanese, reading, or meaning..."
          className="w-full rounded-xl border border-border/60 bg-glass/60 py-2.5 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
        />
      </div>
      <div role="group" aria-label="Filter words" className="mt-3 flex flex-wrap gap-1.5">
        {WORD_FILTERS.map((f) => {
          const active = f === filter;
          return (
            <button
              key={f}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(f)}
              className={`hit-area rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? "border-primary/40 bg-primary/20 text-primary shadow-sm"
                  : "border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              {FILTER_LABELS[f]} <span className="tabular-nums opacity-70">{counts[f]}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {showingLine(shown.length, entries.length)}
      </p>
      {shown.length === 0 ? (
        <p className="mt-3 rounded-md border border-border bg-glass p-4 text-sm text-muted-foreground">
          {emptyListMessage(filter, query)}
        </p>
      ) : (
        <div className="mt-2 grid max-h-[520px] gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
          {shown.map(({ word: w, status }) => {
            const mastery = masteryState(w, starredIds, vocabMemory);
            return (
              <div
                key={w.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-glass p-3"
              >
                <div className="min-w-0">
                  <p className="font-display">
                    {w.japanese} <span className="text-xs text-muted-foreground">{w.reading}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{w.meaning}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <StatusMarks status={status} />
                    {status.weak && (
                      <span className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 text-[10px] font-medium uppercase tracking-wider text-destructive">
                        Weak
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleStar(w.id)}
                  aria-pressed={starredIds.includes(w.id)}
                  aria-label={
                    mastery === "earned"
                      ? "Mastered through review. Tap to star it."
                      : "Star: I already know this"
                  }
                  title={mastery === "earned" ? "Mastered through review" : undefined}
                  className={`hit-area ${mastery !== "none" ? "text-primary" : "text-muted-foreground"}`}
                >
                  <Star className={`size-4 ${starredIds.includes(w.id) ? "fill-current" : ""}`} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
