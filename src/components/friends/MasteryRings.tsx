import { masteryFraction, type NotebookSummary } from "@/lib/friends";

export function MasteryRings({ own, other }: { own: NotebookSummary; other: NotebookSummary }) {
  return (
    <section className="circle-panel mastery-panel" aria-label="Words mastered in each notebook">
      <header className="circle-panel-heading">
        <div>
          <p className="circle-eyebrow">
            <span lang="ja">言葉</span> / VOCABULARY
          </p>
          <h2>Words taking root.</h2>
        </div>
      </header>
      <div className="mastery-pair">
        {[
          { person: own, name: "You", ink: "self" },
          { person: other, name: other.n, ink: "peer" },
        ].map(({ person, name, ink }) => {
          const fraction = masteryFraction(person.m, person.vc);
          return (
            <div key={ink} className="mastery-person" data-ink={ink}>
              <div className="mastery-dial">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle className="mastery-track" cx="60" cy="60" r="49" />
                  {fraction !== null && (
                    <circle
                      className="mastery-value"
                      cx="60"
                      cy="60"
                      r="49"
                      pathLength="100"
                      strokeDasharray={`${fraction * 100} 100`}
                      transform="rotate(-90 60 60)"
                    />
                  )}
                </svg>
                <div>
                  <strong>
                    {fraction === null ? "—" : Math.round(fraction * 100)}
                    {fraction !== null && <small>%</small>}
                  </strong>
                  <span>mastered</span>
                </div>
              </div>
              <h3>{name}</h3>
              <p>
                {person.m.toLocaleString("en")}{" "}
                <span>of {person.vc.toLocaleString("en")} words</span>
              </p>
              {fraction === null && <small>No vocabulary total yet</small>}
            </div>
          );
        })}
      </div>
      <div className="mastery-notebook-totals">
        {[
          ["Lessons saved", own.l, other.l],
          ["Kanji learned", own.k, other.k],
          ["Day streak", own.s, other.s],
        ].map(([label, yours, theirs]) => (
          <div key={label}>
            <span>{label}</span>
            <b data-ink="self">
              <span className="sr-only">You: </span>
              {yours}
            </b>
            <b data-ink="peer">
              <span className="sr-only">{other.n}: </span>
              {theirs}
            </b>
          </div>
        ))}
      </div>
      <p className="circle-footnote">
        Mastery is earned through reviews. Each ring measures its own notebook, not a race between
        the two.
      </p>
    </section>
  );
}
