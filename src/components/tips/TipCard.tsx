/** Phase 11b — a small dismissible tip. Theme tokens only. `className` sets the width (and any bottom margin) to match the screen it sits on. */
import { Lightbulb } from "lucide-react";
import { TIP_COPY, type TipId } from "./tips";

export function TipCard({
  id,
  onDismiss,
  className = "",
}: {
  id: TipId;
  onDismiss: (id: TipId) => void;
  className?: string;
}) {
  const { title, body } = TIP_COPY[id];
  return (
    <aside
      role="note"
      aria-label={`Tip: ${title}`}
      className={`mx-auto flex w-full items-start gap-3 rounded-md border border-border bg-glass p-3 backdrop-blur-xl ${className}`}
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <button
        onClick={() => onDismiss(id)}
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-accent"
      >
        Got it
      </button>
    </aside>
  );
}
