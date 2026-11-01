/**
 * Writing quests, Phase Q7 — the rank stamp: a small round seal carrying the rank's glyph, drawn beside the rank line
 * (Profile writing card, Write page done step), and the chooser for its look (Profile → Preferences).
 *
 * Three looks, existing colour tokens only (no new token, no hardcoded colour): ink (always), moss (from rank 2) and
 * paper (from rank 4). The choice is device-only (`stamp` in the quest prefs). The stamp is decorative and static: it
 * repeats the glyph the rank line already says in words, so it is `aria-hidden`, and it has no animation or transition.
 * Nothing here reads storage or the clock; the callers pass the carved count and the saved choice. The rules live in
 * `src/lib/quest-prefs.ts` (unlocks, fallback) and `src/lib/rewards.ts` (ranks).
 * `StampedRankLine` wraps the existing `RankLine` instead of changing it, so the Profile card and the done step share one
 * layout.
 */
import { Lock } from "lucide-react";
import { RankLine } from "@/components/profile/BadgeShelf";
import {
  DEFAULT_STAMP,
  STAMPS,
  resolveStamp,
  stampUnlocked,
  type StampId,
} from "@/lib/quest-prefs";
import { RANKS, rankOf } from "@/lib/rewards";

/** The classes of each look (plan 2.3). Theme tokens only; changing a look is a one-line edit here. */
const STAMP_LOOK: Record<StampId, string> = {
  ink: "text-primary border-primary/40",
  moss: "text-success border-success/40 bg-success/10",
  paper: "text-foreground border-foreground/30 bg-foreground/5",
};

/** What the chooser previews while the learner has no rank yet, so no glyph of theirs exists. 印 means "seal". */
const SAMPLE_GLYPH = "印";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The seal: a 40 px circle with the rank glyph in it. A one-character glyph (綴) is drawn larger than a two-character
 * one (一行, 一頁, 一冊, 書棚, 書庫), which would otherwise touch the curved edge. Static, and hidden from assistive
 * technology because the rank line beside it already says the rank.
 */
export function RankStamp({
  glyph,
  stamp = DEFAULT_STAMP,
  className = "",
}: {
  glyph: string;
  stamp?: StampId;
  className?: string;
}) {
  const size = [...glyph].length > 1 ? "text-sm" : "text-lg";
  return (
    <span
      aria-hidden="true"
      lang="ja"
      data-stamp={stamp}
      className={`grid size-10 shrink-0 place-items-center rounded-full border-2 font-display leading-none ${size} ${STAMP_LOOK[stamp]} ${className}`}
    >
      {glyph}
    </span>
  );
}

/**
 * The rank line with the stamp beside it. The stamp is drawn only once there is a rank (nothing to stamp before the
 * first one), in the saved style when that style is unlocked at this rank, otherwise in ink.
 */
export function StampedRankLine({
  carved,
  saved,
  showRule = true,
  className = "",
}: {
  carved: number;
  /** The stored choice (`prefs.stamp`). A locked or unknown value is drawn as ink. */
  saved?: StampId | undefined;
  showRule?: boolean;
  className?: string;
}) {
  const rank = rankOf(carved);
  const stamp = resolveStamp(saved, rank?.level ?? 0);
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      {rank !== null && <RankStamp glyph={rank.glyph} stamp={stamp} />}
      <RankLine carved={carved} showRule={showRule} className="min-w-0 flex-1" />
    </div>
  );
}

/**
 * The Preferences row: one button per look, each previewing the learner's own glyph in that look. A look the rank has
 * not reached is `disabled` (so Tab skips it: it is not a focus stop) and says `Locked at rank {n}.` with the rank's
 * name, because ranks are shown by name elsewhere. The chosen look carries `aria-pressed` and the words "In use".
 * `onChoose` is only ever called for an unlocked look.
 */
export function StampChooser({
  carved,
  saved,
  onChoose,
  className = "",
}: {
  carved: number;
  saved: StampId | undefined;
  onChoose: (stamp: StampId) => void;
  className?: string;
}) {
  const rank = rankOf(carved);
  const level = rank?.level ?? 0;
  const current = resolveStamp(saved, level);
  const glyph = rank?.glyph ?? SAMPLE_GLYPH;
  return (
    <div role="group" aria-labelledby="pref-stamp" className={className}>
      <p id="pref-stamp" className="text-sm">
        Rank stamp
      </p>
      <p className="text-[11px] text-muted-foreground">
        The seal beside your rank. Higher ranks unlock more looks.
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {STAMPS.map((def) => {
          const locked = !stampUnlocked(def.id, level);
          const active = def.id === current;
          const unlocksAt = RANKS.find((r) => r.level === def.level);
          return (
            <li key={def.id}>
              <button
                type="button"
                disabled={locked}
                aria-pressed={active}
                onClick={() => {
                  if (!locked) onChoose(def.id);
                }}
                className={`hit-area flex h-full w-full flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors motion-reduce:transition-none ${focusRing} ${
                  active
                    ? "border-primary/40 bg-primary/10"
                    : locked
                      ? "cursor-not-allowed border-border/60 bg-glass/60"
                      : "border-border/60 bg-glass/60 hover:border-primary/50 hover:bg-accent/50"
                }`}
              >
                <RankStamp
                  glyph={glyph}
                  stamp={def.id}
                  className={locked ? "opacity-40 grayscale" : ""}
                />
                <span className="text-xs font-medium leading-tight text-foreground">
                  {def.name}
                </span>
                {locked ? (
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    <Lock className="mr-1 inline size-3 align-[-0.1em]" aria-hidden />
                    Locked at rank {def.level}.
                    {unlocksAt !== undefined && (
                      <>
                        {" "}
                        <span lang="ja">{unlocksAt.glyph}</span> {unlocksAt.name}
                      </>
                    )}
                  </span>
                ) : (
                  <span aria-hidden className="min-h-4 text-[11px] leading-snug text-primary">
                    {active ? "In use" : ""}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
