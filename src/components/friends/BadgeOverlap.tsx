import { useState } from "react";
import { Check } from "lucide-react";
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
  const [sharedOnly, setSharedOnly] = useState(false);
  const shared = BADGES.filter((badge) => own[badge.id] && other[badge.id]);
  const visible = sharedOnly ? shared : BADGES;
  return (
    <section className="circle-panel milestone-cabinet" aria-label="Badges in both notebooks">
      <header className="circle-panel-heading">
        <div>
          <p className="circle-eyebrow">
            <span lang="ja">記念</span> / MILESTONES
          </p>
          <h2>Small things worth keeping.</h2>
          <p className="milestone-intro">
            {shared.length
              ? `${shared.length} milestones in both your notebooks.`
              : "The first answer. A week of showing up. Every milestone has a story."}
          </p>
        </div>
        <div className="rhythm-measures" role="group" aria-label="Milestones to show">
          <button type="button" aria-pressed={!sharedOnly} onClick={() => setSharedOnly(false)}>
            All
          </button>
          <button type="button" aria-pressed={sharedOnly} onClick={() => setSharedOnly(true)}>
            Shared <span>{shared.length}</span>
          </button>
        </div>
      </header>
      {visible.length ? (
        <ul className="milestone-grid">
          {visible.map((badge) => {
            const yours = Boolean(own[badge.id]),
              theirs = Boolean(other[badge.id]);
            return (
              <li key={badge.id} data-collected={yours || theirs} data-shared={yours && theirs}>
                <span className="milestone-art" aria-hidden="true">
                  <BadgeArt id={badge.id} className="size-14" />
                </span>
                <h3>{badge.name}</h3>
                <p>{badge.how}</p>
                <div className="milestone-owners">
                  <span data-ink="self" data-earned={yours}>
                    <Check aria-hidden="true" /> You
                    <span className="sr-only">
                      : {yours ? `earned ${own[badge.id]}` : "not yet earned"}
                    </span>
                  </span>
                  <span data-ink="peer" data-earned={theirs}>
                    <Check aria-hidden="true" />{" "}
                    <span className="milestone-owner-name">{name}</span>
                    <span className="sr-only">
                      : {theirs ? `earned ${other[badge.id]}` : "not yet earned"}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="milestone-empty">
          <span lang="ja" aria-hidden="true">
            芽
          </span>
          <h3>Your shared collection starts here.</h3>
          <p>
            No milestones in common yet. Explore all milestones to find a small goal to work toward.
          </p>
          <button type="button" className="studio-text-button" onClick={() => setSharedOnly(false)}>
            Explore milestones
          </button>
        </div>
      )}
    </section>
  );
}
