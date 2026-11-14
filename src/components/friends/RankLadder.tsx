import { RANKS, nextRank, rankOf } from "@/lib/rewards";
import type { NotebookSummary } from "@/lib/friends";

export function RankLadder({ own, other }: { own: NotebookSummary; other: NotebookSummary }) {
  return (
    <section className="circle-panel rank-journey" aria-label="Your writing milestones">
      <header className="circle-panel-heading">
        <div>
          <p className="circle-eyebrow">
            <span lang="ja">一歩ずつ</span> / THE LONG VIEW
          </p>
          <h2>From a first line to an archive.</h2>
        </div>
        <p className="circle-panel-aside">
          Different chapters.
          <br />
          The same love of learning.
        </p>
      </header>
      <ol className="rank-books">
        {RANKS.map((rank) => (
          <li key={rank.level} data-reached={own.c >= rank.carved || other.c >= rank.carved}>
            <span className="rank-book-glyph" lang="ja" aria-hidden="true">
              {rank.glyph}
            </span>
            <h3>{rank.name}</h3>
            <span className="rank-book-threshold">{rank.carved} carved</span>
            <span className="rank-book-readers">
              <i
                role="img"
                data-ink="self"
                data-reached={own.c >= rank.carved}
                aria-label={`You: ${own.c >= rank.carved ? "reached" : "not yet reached"}`}
              />
              <i
                role="img"
                data-ink="peer"
                data-reached={other.c >= rank.carved}
                aria-label={`${other.n}: ${other.c >= rank.carved ? "reached" : "not yet reached"}`}
              />
            </span>
          </li>
        ))}
      </ol>
      <div className="rank-next-pair">
        {[
          { person: own, name: "You", ink: "self" },
          { person: other, name: other.n, ink: "peer" },
        ].map(({ person, name, ink }) => {
          const rank = rankOf(person.c);
          const next = nextRank(person.c);
          const base = rank?.carved ?? 0;
          const fraction = next
            ? Math.max(0, Math.min(1, (person.c - base) / (next.carved - base)))
            : 1;
          return (
            <div key={ink} data-ink={ink}>
              <div className="rank-next-heading">
                <h3>{name}</h3>
                <span>{person.c} carved kanji</span>
              </div>
              <div
                className="rank-next-track"
                role="progressbar"
                aria-label={`${name}, progress to ${next?.name ?? "Archive"}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(fraction * 100)}
              >
                <span style={{ width: `${fraction * 100}%` }} />
              </div>
              <p>
                {next ? (
                  <>
                    <strong>{next.carved - person.c} more</strong> to {next.name}
                  </>
                ) : (
                  "All six writing ranks reached."
                )}
              </p>
            </div>
          );
        })}
      </div>
      <p className="circle-footnote">
        A kanji is carved when written correctly from memory on two different days. Each person
        moves at their own pace.
      </p>
    </section>
  );
}
