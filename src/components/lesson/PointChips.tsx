/**
 * Phase 17 — the chip row for days that teach several kanji or grammar points. One point is shown at a time (keeps the
 * phone screen short); tapping a chip picks which. Renders nothing for a single point, so one-point days look exactly as
 * they did before.
 */
export function PointChips({
  labels,
  active,
  onSelect,
  ariaLabel,
  large = false,
}: {
  labels: string[];
  active: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
  /** Bigger display type, for single kanji characters. */
  large?: boolean;
}) {
  if (labels.length < 2) return null;
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {labels.map((label, i) => {
        const selected = i === active;
        return (
          <button
            key={`${i}-${label}`}
            type="button"
            role="tab"
            aria-selected={selected}
            title={label}
            onClick={() => onSelect(i)}
            // `hit-area` draws an ::after, so truncation lives on the inner span (a clipping button would cut the tap area).
            className={`hit-area rounded-lg border px-3 py-1.5 transition-all ${
              selected
                ? "border-primary/40 bg-primary/20 text-primary shadow-sm"
                : "border-border/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <span
              className={`block max-w-[11rem] truncate ${large ? "font-display text-lg leading-tight" : "text-xs font-medium"}`}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
