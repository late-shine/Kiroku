/**
 * Phase 11b — the header "?" help card: a short guide to the AI Lesson Studio flow.
 * Portaled to <body> for the same reason as `ConfirmDialog` in `routes/index.tsx`: the glass panes use
 * backdrop-blur and transforms, which would trap a `fixed` child inside the pane instead of the viewport.
 * It reads no stored state, so it works on every tab, with or without lessons.
 */
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function HelpCard({
  onOpenStudio,
  onShowTipsAgain,
  onClose,
}: {
  onOpenStudio: () => void;
  onShowTipsAgain: () => void;
  onClose: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-card-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-glass-strong p-5 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="help-card-title" className="font-display text-lg">
            How Kiroku works
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Kiroku is a notebook, not a tutor. You learn from any AI you like, and Kiroku remembers
          what you&apos;ve been taught so the next lesson never repeats or skips ahead.
        </p>
        <p className="mt-4 text-sm font-semibold">In the AI Lesson Studio (the robot button):</p>
        <ol className="mt-2 list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="font-semibold text-foreground">Configure</span> — pick the day and
            options, and one of three modes:
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>
                <span className="font-semibold text-foreground">Learn + Save</span> (recommended):
                your AI teaches the lesson, then adds a small block at the end. Paste the whole
                reply back in step 3.
              </li>
              <li>
                <span className="font-semibold text-foreground">Learn only</span>: just the lesson,
                no block. Good for follow-up questions first.
              </li>
              <li>
                <span className="font-semibold text-foreground">Save only</span>: for a lesson you
                already learned. Paste its text into the optional box first, because a fresh AI chat
                can&apos;t remember it.
              </li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-foreground">Copy prompt</span> — paste it into any
            AI.
          </li>
          <li>
            <span className="font-semibold text-foreground">Import</span> — paste the AI&apos;s
            reply back; you&apos;ll see a preview before anything is saved.
          </li>
        </ol>
        <p className="mt-4 text-sm text-muted-foreground">
          AIs sometimes ignore parts of a prompt, for example by replying with only the data block
          and no lesson. If that happens, send the same prompt again. Turning on thinking
          (reasoning) mode, if your AI has one, often helps.
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          No account and no key needed. Optionally, a Gemini key can fix a failed import or save
          from pasted text; it stays in this browser.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            onClick={onShowTipsAgain}
            className="rounded-md border border-border px-3 py-1.5 text-xs"
          >
            Show tips again
          </button>
          <button
            onClick={onOpenStudio}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            Open AI Lesson Studio
          </button>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs">
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
