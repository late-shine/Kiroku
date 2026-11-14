import { resolveAccent, resolveStamp } from "@/lib/quest-prefs";
import { RANKS } from "@/lib/rewards";
import { weekdayName } from "@/lib/study-log";
import {
  alignFriendWeek,
  comparisonWeek,
  friendSnapshotFresh,
  resolveDeco,
  studiedOnDay,
  type FriendCard,
  type FriendCardSource,
  type FriendDecoration,
  type NotebookSummary,
  type FriendRankIncrease,
} from "@/lib/friends";
import type { Avatar } from "@/lib/profile";
import { FriendAvatar } from "./FriendAvatar";
import { MirrorBars } from "./MirrorBars";
import { MasteryRings } from "./MasteryRings";
import { RankLadder } from "./RankLadder";
import { BadgeOverlap } from "./BadgeOverlap";
import { StudyThread } from "./StudyThread";
import type { StudyThreadRun } from "@/lib/comparison-motion";

export function SideBySide({
  source,
  previousAnswers,
  ownName,
  ownDecoration,
  ownAvatar,
  card,
  today,
  now,
  cached,
  photo,
  threadRun,
  rankChange,
}: {
  source: FriendCardSource;
  previousAnswers: number;
  ownName: string;
  ownDecoration: FriendDecoration | null;
  ownAvatar: Avatar;
  card: FriendCard;
  today: string;
  now: number;
  cached: boolean;
  photo: string | null;
  threadRun: StudyThreadRun;
  rankChange: FriendRankIncrease | null;
}) {
  const stats = source.stats;
  const ownDeco = resolveDeco(ownDecoration, source.badges);
  const otherDeco = resolveDeco(card, card.bd ?? {});
  const own: NotebookSummary = {
    n: ownName,
    g: source.g,
    r: stats.rankId,
    c: stats.carved,
    s: stats.streak,
    m: stats.mastered,
    l: stats.lessons,
    k: stats.kanji,
    vc: stats.vocab,
    bd: source.badges,
    acc: source.acc,
    st: source.st,
    fr: ownDeco.fr,
  };
  const other: NotebookSummary = {
    ...card,
    bd: card.bd ?? {},
    fr: otherDeco.fr,
    st: resolveStamp(card.st, card.r),
    acc: resolveAccent(card.acc, card.bd ?? {}),
  };
  const ownWeek = comparisonWeek(source.day, stats.answers7, stats.writing7, today);
  const aligned = alignFriendWeek(card, today);
  const otherWeek =
    aligned ?? ownWeek?.map((day) => ({ day: day.day, answers: null, writing: null })) ?? [];
  const fresh = !cached && friendSnapshotFresh(card, now);
  const hasCoverage = otherWeek.some((day) => day.answers !== null && day.writing !== null);
  const fullCoverage =
    aligned?.every((day) => day.answers !== null && day.writing !== null) ?? false;
  const bothToday = fresh && studiedOnDay(ownWeek, today) && studiedOnDay(aligned, today);
  const quiet =
    fresh && fullCoverage && otherWeek.every((day) => day.answers === 0 && day.writing === 0);
  const ownRank = RANKS.find((rank) => rank.level === own.r);
  const otherRank = RANKS.find((rank) => rank.level === other.r);
  const reachedRank =
    fresh &&
    hasCoverage &&
    ownWeek &&
    rankChange &&
    rankChange.from < card.r &&
    rankChange.to === card.r &&
    rankChange.publishedAt === card.t
      ? otherRank
      : null;
  const delta = stats.answersThisWeek - previousAnswers;
  const ownWeekSentence =
    delta > 0
      ? `Your week: ${stats.answersThisWeek} answers, ${delta} more than last week.`
      : delta === 0
        ? `Your week: ${stats.answersThisWeek} answers, the same as last week.`
        : `Your week: ${stats.answersThisWeek} answers. Last week: ${previousAnswers} answers.`;
  const peerWeekTotal = card.a.split(",").reduce((sum, n) => sum + Number(n), 0);
  return (
    <div className="friends-comparison-content" data-card-accent={own.acc}>
      <header className="circle-journal-heading">
        <div>
          <p className="circle-eyebrow">YOU & {card.n.toLocaleUpperCase("en")}</p>
          <h2>
            Two notebooks.
            <br />
            <em>One shared journey.</em>
          </h2>
          <p>{ownWeekSentence}</p>
        </div>
        {fresh && hasCoverage && (
          <StudyThread
            run={threadRun}
            active={bothToday}
            ownAvatar={
              <FriendAvatar
                name={own.n}
                glyph={own.g}
                frame={own.fr}
                size={48}
                avatar={ownAvatar}
              />
            }
            friendAvatar={
              <span data-card-accent={other.acc}>
                <FriendAvatar
                  name={other.n}
                  glyph={other.g}
                  frame={other.fr}
                  size={48}
                  photo={photo}
                />
              </span>
            }
          />
        )}
      </header>
      {reachedRank && (
        <p className="circle-data-note">
          {card.n} reached a new rank: {reachedRank.name}.
        </p>
      )}
      {quiet && (
        <p className="circle-data-note">
          A quiet week in {card.n}’s notebook. A little encouragement is always welcome.
        </p>
      )}
      {(!fullCoverage || !fresh) && (
        <p className="circle-data-note">
          {cached ? "Saved snapshot" : "Last shared update"} · {card.n}’s activity is recorded
          through {weekdayName(card.d)} ({card.d}). Unrecorded dates stay blank.
        </p>
      )}
      {(!aligned || !hasCoverage) && (
        <p className="circle-data-note">
          No shared weekly data for these dates. Missing activity is never counted as zero.
        </p>
      )}
      <div className="circle-charts">
        {ownWeek ? (
          <MirrorBars
            own={ownWeek}
            other={otherWeek}
            name={card.n}
            togetherFresh={fresh && aligned !== null}
          />
        ) : (
          <p className="circle-panel circle-data-note">
            Your weekly activity is not available for these dates yet.
          </p>
        )}
        <MasteryRings own={own} other={other} />
      </div>
      <RankLadder own={own} other={other} />
      <BadgeOverlap own={source.badges} other={card.bd ?? {}} name={card.n} />
      {ownWeek && (
        <div className="sr-only">
          <table>
            <caption>
              You and {card.n}, last seven days. Both chart lines use the same scale; no data means
              an unknown date.
            </caption>
            <thead>
              <tr>
                <th scope="col">Measure or date</th>
                <th scope="col">You</th>
                <th scope="col">{card.n}</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Rank", ownRank?.name ?? "Just starting", otherRank?.name ?? "Just starting"],
                ["Carved kanji", own.c, other.c],
                ["Study streak", own.s, other.s],
                ["Words mastered", own.m, other.m],
                ["Lessons", own.l, other.l],
                [
                  "Answers in 7 days",
                  stats.answersThisWeek,
                  `${peerWeekTotal} in saved week through ${card.d}`,
                ],
                [
                  "Writing marks in 7 days",
                  stats.writing7.reduce((a, b) => a + b, 0),
                  `${card.w.split(",").reduce((a, b) => a + Number(b), 0)} in saved week through ${card.d}`,
                ],
              ].map(([label, a, b]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{a}</td>
                  <td>{b}</td>
                </tr>
              ))}
              {ownWeek.map((day, i) => {
                const peer = otherWeek[i];
                return (
                  <tr key={day.day}>
                    <th scope="row">
                      {weekdayName(day.day)}, {day.day}. Studied on {day.day}
                    </th>
                    <td>
                      {day.answers} quiz answers, {day.writing} writing marks;{" "}
                      {studiedOnDay(ownWeek, day.day) ? "studied" : "no activity recorded"}.
                    </td>
                    <td>
                      {peer?.answers === null ||
                      peer?.answers === undefined ||
                      peer.writing === null
                        ? "No data available."
                        : `${peer.answers} quiz answers, ${peer.writing} writing marks; ${studiedOnDay(otherWeek, day.day) ? "studied" : "no activity recorded"}.`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
