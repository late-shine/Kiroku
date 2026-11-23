import { useState } from "react";

interface BacklogSpreadControlProps {
  dueNow: number;
  keepToday: number;
  onSpread: (days: 7 | 14) => void;
  centered?: boolean;
}

export function BacklogSpreadControl({
  dueNow,
  keepToday,
  onSpread,
  centered = false,
}: BacklogSpreadControlProps) {
  const [open, setOpen] = useState(false);
  const excess = Math.max(0, dueNow - keepToday);
  if (excess <= 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
      >
        Spread out backlog
      </button>
    );
  }

  return (
    <div
      className={`mt-2 rounded-xl border border-border/60 bg-glass/60 p-3 text-xs text-muted-foreground ${
        centered ? "mx-auto max-w-md text-left" : ""
      }`}
    >
      <p className="text-foreground/90">
        {keepToday > 0
          ? `Keep ${keepToday} due today and space the other ${excess} evenly without losing your box progress:`
          : `Space the remaining ${excess} overdue words evenly starting tomorrow without losing your box progress:`}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onSpread(7);
            setOpen(false);
          }}
          className="hit-area rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25"
        >
          Spread over 7 days
        </button>
        <button
          type="button"
          onClick={() => {
            onSpread(14);
            setOpen(false);
          }}
          className="hit-area rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/25"
        >
          Spread over 14 days
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="hit-area rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
