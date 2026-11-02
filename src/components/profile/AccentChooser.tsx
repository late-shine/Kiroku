/**
 * Writing quests, Phase Q8 — the accent colour chooser (Profile → Preferences).
 *
 * Four tiles: amber (the default, always open) and three accents that a badge unlocks (sakura, moss, sky; the badge ids
 * live in `ACCENTS` in `src/lib/quest-prefs.ts`). Each tile draws its own colour from a token (`--accent-<id>` in
 * `styles.css`), so there is no hardcoded colour here and a swatch keeps its own colour whichever accent is active.
 * A locked tile is `disabled` (Tab skips it) and says which badge opens it, in words, with how to earn that badge.
 * The chosen tile carries `aria-pressed`, a check mark and the words "In use", so nothing is shown by colour alone.
 *
 * It reads nothing from storage and has no clock: the caller passes the earned badges and the saved choice, and gets
 * `onChoose` for an unlocked tile only. The colour is applied elsewhere (the shell sets `data-accent` on <html>).
 */
import { Check, Lock } from "lucide-react";
import { ACCENTS, accentUnlocked, resolveAccent, type AccentId } from "@/lib/quest-prefs";
import { BADGES } from "@/lib/rewards";

/** Each swatch's fill, from its token. The classes are written out in full so Tailwind can see them. */
const SWATCH: Record<AccentId, string> = {
  amber: "bg-(color:--accent-amber)",
  sakura: "bg-(color:--accent-sakura)",
  moss: "bg-(color:--accent-moss)",
  sky: "bg-(color:--accent-sky)",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AccentChooser({
  badges,
  saved,
  onChoose,
  className = "",
}: {
  /** `progress.badges`: badge id -> the day it was earned. */
  badges: Readonly<Record<string, string>>;
  /** The stored choice (`prefs.accent`). A locked or unknown value is drawn as amber. */
  saved: AccentId | undefined;
  onChoose: (accent: AccentId) => void;
  className?: string;
}) {
  const current = resolveAccent(saved, badges);
  return (
    <div role="group" aria-labelledby="pref-accent" className={className}>
      <p id="pref-accent" className="text-sm">
        Accent colour
      </p>
      <p className="text-[11px] text-muted-foreground">
        Recolours buttons, highlights and the drifting particles on this device. Badges unlock more
        colours.
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {ACCENTS.map((def) => {
          const locked = !accentUnlocked(def.id, badges);
          const active = def.id === current;
          const badge = def.badge === null ? undefined : BADGES.find((b) => b.id === def.badge);
          return (
            <li key={def.id}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={active}
                onClick={() => {
                  if (!locked) onChoose(def.id);
                }}
                className={`hit-area flex h-full w-full items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors motion-reduce:transition-none ${focusRing} ${
                  active
                    ? "border-primary/40 bg-primary/10"
                    : locked
                      ? "cursor-not-allowed border-border/60 bg-glass/60"
                      : "border-border/60 bg-glass/60 hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <span
                  aria-hidden="true"
                  data-accent-swatch={def.id}
                  className={`grid size-8 shrink-0 place-items-center rounded-full border border-foreground/25 ${SWATCH[def.id]} ${
                    locked ? "opacity-40 grayscale" : ""
                  }`}
                >
                  {active && <Check className="size-4 text-primary-foreground" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium leading-tight text-foreground">
                    {def.name}
                  </span>
                  {locked && badge !== undefined ? (
                    <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                      <Lock className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
                      {`Unlocked by "${badge.name}"`}
                      <span className="mt-0.5 block">{badge.how}</span>
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="mt-1 block min-h-4 text-[11px] leading-snug text-primary"
                    >
                      {active ? "In use" : ""}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
