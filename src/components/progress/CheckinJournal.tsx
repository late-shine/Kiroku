import { useId } from "react";
import { ArrowRight, BookOpen, ChevronRight, Clock3 } from "lucide-react";
import {
  checkinScore,
  lessonRangeLabel,
  recordId,
  type CheckinRecord,
  type CheckinSession,
  type CheckinResult,
} from "@/lib/checkin";
import "@/components/ai/checkin.css";

const checkinDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const kindLabel = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  expression: "Natural response",
};

export function CheckinJournal({
  records,
  onOpen,
  onNew,
}: {
  records: Record<string, CheckinRecord>;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const headingId = useId();
  const entries = Object.values(records)
    .filter((r) => r.status !== "deleted")
    .sort((a, b) => b.session.createdAt.localeCompare(a.session.createdAt));
  return (
    <section className="checkin ci-journal" aria-labelledby={headingId}>
      <div className="ci-journal-head">
        <div>
          <p className="ci-eyebrow">A record of what stays</p>
          <h2 id={headingId} className="ci-journal-title mt-2">
            Your check-in journal
          </h2>
        </div>
        <button className="ci-secondary" onClick={onNew}>
          New check-in <ArrowRight size={15} />
        </button>
      </div>
      {entries.length === 0 ? (
        <div className="glass-panel ci-empty">
          <span className="ci-seal" aria-hidden="true">
            記
          </span>
          <div>
            <h3 className="font-display text-base">A little evidence of your learning.</h3>
            <p className="ci-subtitle mt-2">
              Take a check-in with your AI, then bring the result here. Your answers, corrections,
              and next steps stay together.
            </p>
          </div>
        </div>
      ) : (
        <div className="ci-journal-grid">
          {entries.map((entry) => (
            <button
              key={recordId(entry)}
              className="glass-panel ci-entry"
              onClick={() => onOpen(recordId(entry))}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="ci-eyebrow">
                  {entry.status === "pending" ? "In progress" : "AI-assessed"}
                </span>
                {entry.status === "pending" ? (
                  <Clock3 size={15} className="text-primary" />
                ) : (
                  <BookOpen size={15} className="text-primary" />
                )}
              </div>
              <h3>{lessonRangeLabel(entry.session)}</h3>
              <p>
                {entry.status === "pending"
                  ? "Your prompt is ready. Return with the AI’s final assessment when you’re done."
                  : entry.result.summary.slice(0, 160) +
                    (entry.result.summary.length > 160 ? "…" : "")}
              </p>
              <div className="ci-entry-foot">
                <span>
                  {checkinDate(
                    entry.status === "complete" ? entry.savedAt : entry.session.createdAt,
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {entry.status === "complete"
                    ? `${checkinScore(entry.result).earned} / ${checkinScore(entry.result).possible}`
                    : "Continue"}
                  <ArrowRight size={14} />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      <p className="ci-note mt-4">
        Saved on this device in Progress → Check-in journal. Backup exports preserve pending
        check-ins, answers, scores and feedback; account sync includes them when linked and enabled.
        Backup files contain readable answers. Never published to Friends.
      </p>
    </section>
  );
}

export function CheckinResultView({
  session,
  result,
  preview = false,
}: {
  session: CheckinSession;
  result: CheckinResult;
  preview?: boolean;
}) {
  const score = checkinScore(result);
  return (
    <div className="glass-panel ci-result">
      <div className="ci-result-head">
        <div>
          <p className="ci-eyebrow">
            {preview ? "Review before saving" : "A page in your journal"} · AI-assessed
          </p>
          <h2 className="ci-heading mt-3">{lessonRangeLabel(session)}</h2>
          <p className="ci-subtitle mt-3">{result.summary}</p>
        </div>
        <div className="ci-score" aria-label={`${score.earned} out of ${score.possible} points`}>
          <strong>
            {score.earned}
            <span className="text-base"> / {score.possible}</span>
          </strong>
          <small>{session.questionCount} questions</small>
        </div>
      </div>
      <div className="ci-findings">
        <section>
          <h3>What’s taking root</h3>
          <ul>
            {result.strengths.length ? (
              result.strengths.map((s, i) => <li key={i}>{s}</li>)
            ) : (
              <li>No specific strength recorded in this attempt.</li>
            )}
          </ul>
        </section>
        <section>
          <h3>A little more practice</h3>
          <ul>
            {result.revisit.length ? (
              result.revisit.map((s, i) => <li key={i}>{s}</li>)
            ) : (
              <li>No specific follow-up suggested.</li>
            )}
          </ul>
        </section>
      </div>
      <h3 className="ci-eyebrow mb-4">Your answers, in detail</h3>
      {result.questions.map((q) => (
        <details key={q.id} className="ci-question">
          <summary>
            <ChevronRight size={15} />
            <span className="min-w-0 flex-1">
              <span className="ci-note">
                {q.id.toUpperCase()} · {kindLabel[q.kind]} · Day{" "}
                {session.sources.find((s) => s.id === q.sourceId)?.day}
              </span>
              <span className="block break-words">{q.prompt}</span>
            </span>
            <span className="ci-chip shrink-0">{q.score} / 2</span>
          </summary>
          <div className="ci-question-body">
            <div className="ci-answer-grid">
              <div>
                <small>
                  Your answer
                  {q.status === "assisted"
                    ? " · assisted"
                    : q.status === "skipped"
                      ? " · skipped"
                      : ""}
                </small>
                <p>{q.answer || "Not answered"}</p>
              </div>
              <div>
                <small>A valid answer</small>
                <p>{q.expectedAnswer}</p>
              </div>
            </div>
            <p className="text-muted-foreground">{q.feedback}</p>
          </div>
        </details>
      ))}
      <p className="ci-note mt-5">
        A small sample, not a proficiency certificate. AI grading can be wrong; this result does not
        change your review boxes, mastery, or quiz statistics.
      </p>
    </div>
  );
}
