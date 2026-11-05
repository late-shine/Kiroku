/**
 * Writing quests, Phases Q6 and Q6b — the rank line and the badge shelf. Both are plain text first (nothing is carried
 * by colour alone): a rank is words, a badge is a name plus "Earned <date>" or what earns it, and "New" and "Not earned
 * yet" are words, not just a tint. The medallion art (Q6b, `BadgeArt.tsx`) is decorative and `aria-hidden`.
 * `RankLine` is shared by the Profile writing card and the Write page's done step. It owns no state and reads nothing
 * from storage; the caller passes the numbers (the rules live in `src/lib/rewards.ts`).
 */
import { Lock } from "lucide-react";
import { BadgeArt, BadgeArtDefs } from "@/components/profile/BadgeArt";
import { BADGES, RANK_RULE, isNewBadge, nextRank, rankOf, type BadgeDef } from "@/lib/rewards";

/**
 * A stored day ("2026-10-31") as a short date in the reader's own language ("Oct 31"); the year is added only when it
 * is not the current one. Anything unreadable is shown as it is.
 */
export function formatDay(day: string, today: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) return day;
  const sameYear = y === Number(today.slice(0, 4));
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * `Rank 一行 First line · 5 more carved kanji to 一頁 One page`, with the one sentence that says what moves it. The glyphs
 * carry `lang="ja"`; below the first rank the line reads `No rank yet · 3 more carved kanji to 一行 First line`.
 */
export function RankLine({
  carved,
  showRule = true,
  className = "",
}: {
  carved: number;
  showRule?: boolean;
  className?: string;
}) {
  const rank = rankOf(carved);
  const next = nextRank(carved);
  const left = next === null ? 0 : Math.max(0, next.carved - carved);
  return (
    <div className={className}>
      <p className="text-sm text-foreground">
        {rank === null ? (
          <span className="text-muted-foreground">No rank yet</span>
        ) : (
          <>
            Rank{" "}
            <span lang="ja" className="font-display text-lg text-primary">
              {rank.glyph}
            </span>{" "}
            <span className="font-display text-base">{rank.name}</span>
          </>
        )}
        {next !== null && (
          <span className="text-muted-foreground">
            {" "}
            · {left} more carved kanji to{" "}
            <span lang="ja" className="text-foreground">
              {next.glyph}
            </span>{" "}
            {next.name}
          </span>
        )}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {carved} kanji carved.{showRule ? ` ${RANK_RULE}` : ""}
      </p>
    </div>
  );
}

/** One slot on the shelf: the medallion in full colour once earned, dimmed (with a lock) until then. */
function Tile({ def, day, today }: { def: BadgeDef; day: string | undefined; today: string }) {
  const earned = day !== undefined;
  const fresh = earned && isNewBadge(day, today);
  return (
    <li
      className={`relative flex flex-col items-center rounded-xl border px-2 pb-3 pt-3 text-center ${
        earned ? "border-primary/40 bg-primary/10" : "border-border/60 bg-glass/60"
      }`}
    >
      <div className="relative">
        <BadgeArt
          id={def.id}
          className={`size-[4.75rem] sm:size-24 ${earned ? "drop-shadow-md" : "opacity-40 grayscale"}`}
        />
        {!earned && (
          <span className="absolute bottom-0 right-0 grid size-5 place-items-center rounded-full border border-border/60 bg-background/90 text-muted-foreground">
            <Lock className="size-3" aria-hidden />
          </span>
        )}
      </div>
      {fresh && (
        <span className="absolute right-1.5 top-1.5 rounded-full border border-primary/50 bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
          New
        </span>
      )}
      <p
        className={`mt-2 text-xs font-medium leading-tight ${earned ? "text-foreground" : "text-foreground/80"}`}
      >
        {def.name}
      </p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {earned ? (
          `Earned ${formatDay(day, today)}`
        ) : (
          <>
            <span className="sr-only">Not earned yet. </span>
            {def.how}
          </>
        )}
      </p>
    </li>
  );
}

/**
 * Every badge in a fixed order as a three-column grid, so each one has its own place and lights up where it stands: the
 * ones earned in full colour with `Earned <date>` (and a "New" word for today or yesterday), the rest dimmed with a lock
 * and what earns them. The caller decides whether to show the shelf at all (only after a first badge or while writing
 * practice is on), so a fresh app never shows an empty trophy case. Ids this build does not know are ignored.
 */
export function BadgeShelf({
  badges,
  today,
  className = "",
  includeDefs = true,
}: {
  badges: Readonly<Record<string, string>>;
  today: string;
  className?: string;
  includeDefs?: boolean;
}) {
  const earnedCount = BADGES.filter((def) => badges[def.id] !== undefined).length;
  return (
    <div className={className}>
      {includeDefs && <BadgeArtDefs />}
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Badges · {earnedCount} of {BADGES.length}
      </p>
      <ul className="mt-2 grid grid-cols-3 gap-2">
        {BADGES.map((def) => (
          <Tile key={def.id} def={def} day={badges[def.id]} today={today} />
        ))}
      </ul>
    </div>
  );
}
