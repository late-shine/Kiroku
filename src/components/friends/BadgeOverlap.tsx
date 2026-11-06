import { BADGES } from "@/lib/rewards";
import { BadgeArt } from "@/components/profile/BadgeArt";

export function BadgeOverlap({
  own,
  other,
  name,
}: {
  own: Readonly<Record<string, string>>;
  other: Readonly<Record<string, string>>;
  name: string;
}) {
  return (
    <section className="glass-panel rounded-xl p-4 md:p-5" aria-label="Badges in both notebooks">
      <h2 className="font-display text-base">Little milestones</h2>
      <ul className="mt-4 grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6">
        {BADGES.map((badge) => {
          const yours = Boolean(own[badge.id]),
            theirs = Boolean(other[badge.id]);
          const label = yours && theirs ? "Both" : yours ? "You" : theirs ? name : "";
          return (
            <li
              key={badge.id}
              className="flex min-w-0 flex-col items-center gap-2 text-center"
              aria-label={`${badge.name}. ${label || "Not yet earned in either notebook"}.`}
            >
              <span aria-hidden="true" className={label ? "" : "opacity-25 grayscale"}>
                <BadgeArt id={badge.id} className="size-11" />
              </span>
              <span
                aria-hidden="true"
                className={`w-full break-words text-[10px] ${yours && theirs ? "font-semibold text-primary" : "text-muted-foreground"}`}
              >
                {label || "\u00a0"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
