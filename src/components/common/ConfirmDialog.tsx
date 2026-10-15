// A page-level, styled dialog rather than window.confirm — guaranteed to render inside the page
// itself (no native dialog that can end up behind the window or lose focus), and it can show a
// count for a bulk delete, which window.confirm's fixed wording can't do cleanly.
// Phase 19a: moved here, unchanged, from `routes/index.tsx` because the Profile page's Restore needs it too
// (and a component can't import from the route file without a circular import). The curriculum list still uses it.
import { createPortal } from "react-dom";
import { useScrollLock } from "@/hooks/use-scroll-lock";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useScrollLock();
  // Portaled to <body>: the curriculum pane has backdrop-blur + a rotate transform, and either one makes
  // a `fixed` child position relative to the pane instead of the viewport (dialog would be squashed inside it).
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel-strong w-full max-w-sm rounded-xl p-5"
      >
        <h2 className="font-display text-lg font-medium text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
