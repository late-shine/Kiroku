/**
 * Phase 11a — first-run welcome.
 *
 * Shown whenever there are no saved lessons, except after "Skip intro" in the current visit
 * (see `index.tsx`). Nothing is stored; this file is presentation only.
 *
 * The screenshot is a plain file in `src/assets/images/welcome-lesson.webp` on purpose:
 * swap that one file (same name) to change what the panel shows — no code change needed.
 *
 * Tokens only, no new dependencies, no hardcoded colours.
 */
import { Bot, Upload } from "lucide-react";
import welcomeShot from "@/assets/images/welcome-lesson.webp";

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "1", title: "Build a prompt", body: "Pick a day in the AI Lesson Studio." },
  {
    n: "2",
    title: "Paste it into your AI",
    body: "Learn as usual — ChatGPT, Claude, Gemini, whichever you like.",
  },
  { n: "3", title: "Paste the reply back", body: "Kiroku saves the lesson and quizzes you on it." },
];

export function WelcomePanel({
  onAI,
  onRestore,
  onSkip,
}: {
  onAI: () => void;
  onRestore: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <section className="glass-panel pane-in grid gap-6 rounded-2xl p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <div>
          <span className="font-display text-xs font-semibold tracking-wider text-primary">
            記録 · WELCOME
          </span>
          <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-foreground md:text-4xl">
            Welcome to Kiroku
          </h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground/90">
            Kiroku is a quiet notebook for your Japanese. It doesn&apos;t teach — you learn from any
            AI you like, and Kiroku remembers what you&apos;ve learned so your next lesson never
            repeats or skips ahead.
          </p>

          <ol className="mt-6 space-y-3">
            {STEPS.map((step) => (
              <li
                key={step.n}
                className="flex gap-3.5 rounded-xl border border-border/40 bg-glass/40 p-3.5 transition-colors hover:border-border/60"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 font-display text-xs font-semibold text-primary">
                  {step.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{step.title}</span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-5 max-w-prose text-xs leading-relaxed text-muted-foreground">
            Free, no account, no key needed. (Optional: add your own Gemini key to speed up saving —
            it stays in your browser.) Everything is stored in this browser only, so export a backup
            from the Progress tab now and then.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={onAI}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Bot className="size-4" />
              Build my first lesson
            </button>
            <button
              onClick={onRestore}
              className="flex items-center gap-2 rounded-xl border border-border/70 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <Upload className="size-4" />
              Restore a backup
            </button>
            <button
              onClick={onSkip}
              className="px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip intro
            </button>
          </div>
        </div>

        <figure className="m-0 self-center">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-background/30 p-2 shadow-2xl">
            <img
              src={welcomeShot}
              alt="A saved Kiroku lesson: grammar point, progress ring and the curriculum list"
              className="w-full rounded-lg"
            />
          </div>
          <figcaption className="mt-2.5 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            What a saved lesson looks like
          </figcaption>
        </figure>
      </section>
    </div>
  );
}
