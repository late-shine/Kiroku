import { RankStamp } from "@/components/write/RankStamp";
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
} from "@/lib/friends";
import type { Avatar } from "@/lib/profile";
import { FriendAvatar } from "./FriendAvatar";
import { MirrorBars } from "./MirrorBars";
import { MasteryRings } from "./MasteryRings";
import { RankLadder } from "./RankLadder";
import { BadgeOverlap } from "./BadgeOverlap";

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
  const delta = stats.answersThisWeek - previousAnswers;
  const ownWeekSentence =
    delta > 0
      ? `Your week: ${stats.answersThisWeek} answers, ${delta} more than last week.`
      : delta === 0
        ? `Your week: ${stats.answersThisWeek} answers, the same as last week.`
        : `Your week: ${stats.answersThisWeek} answers. Last week: ${previousAnswers} answers.`;
  const peerWeekTotal = card.a.split(",").reduce((sum, n) => sum + Number(n), 0);
  return (
    <div className="min-w-0 space-y-4" data-card-accent={own.acc}>
      {Math.abs(own.r - other.r) >= 2 || Math.abs(own.l - other.l) >= 15 ? (
        <p className="glass-panel rounded-xl p-4 text-sm text-muted-foreground">
          Your notebooks are at different stages. The weekly view shows each person’s rhythm.
        </p>
      ) : null}
      {fresh && hasCoverage && (
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center gap-4" aria-hidden="true">
            <FriendAvatar name={own.n} glyph={own.g} frame={own.fr} size={48} avatar={ownAvatar} />
            <span
              className={`friends-thread h-px flex-1 ${bothToday ? "friends-thread-shared bg-primary" : "bg-border"}`}
            />
            <span data-card-accent={other.acc}>
              <FriendAvatar
                name={other.n}
                glyph={other.g}
                frame={other.fr}
                size={48}
                photo={photo}
              />
            </span>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {bothToday
              ? "You both studied today, as of the shared update."
              : "Two notebooks, one week."}
          </p>
        </div>
      )}
      {quiet && <p className="text-sm text-muted-foreground">Quiet this week.</p>}
      {(!fullCoverage || !fresh) && (
        <p className="text-xs text-muted-foreground">
          {card.n}’s card was updated {weekdayName(card.d)} ({card.d}).
        </p>
      )}
      {(!aligned || !hasCoverage) && (
        <p className="glass-panel rounded-xl p-4 text-sm text-muted-foreground">
          This desk’s weekly data isn’t available for these dates. Nothing missing is counted as
          zero.
        </p>
      )}
      {ownWeek && (
        <MirrorBars
          own={ownWeek}
          other={otherWeek}
          name={card.n}
          sameAccent={own.acc === other.acc}
          accent={other.acc}
          togetherFresh={fresh && aligned !== null}
        />
      )}
      <section
        className="glass-panel space-y-5 rounded-xl p-4 md:p-5"
        aria-label="Inside each notebook"
      >
        <div>
          <div className="flex items-center gap-3">
            {ownRank && (
              <RankStamp glyph={ownRank.glyph} stamp={own.st} className="size-7 text-xs" />
            )}
            <h2 className="font-display text-base">
              Your notebook · {ownRank?.name ?? "Just starting"}
            </h2>
          </div>
          <p className="mt-3 text-sm">
            Streak: {own.s} days. Words mastered: {own.m}.
          </p>
          <p className="mt-1 text-sm">
            Lessons: {own.l}, kanji taught: {own.k}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{ownWeekSentence}</p>
        </div>
        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3">
            {otherRank && (
              <RankStamp glyph={otherRank.glyph} stamp={other.st} className="size-7 text-xs" />
            )}
            <h2 className="font-display text-base">
              {other.n}’s notebook · {otherRank?.name ?? "Just starting"}
            </h2>
          </div>
          <p className="mt-3 text-sm">
            Streak: {other.s} days. Words mastered: {other.m}.
          </p>
          <p className="mt-1 text-sm">
            Lessons: {other.l}, kanji taught: {other.k}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {peerWeekTotal} answers in this notebook’s saved week through {card.d}.
          </p>
        </div>
      </section>
      <MasteryRings own={own} other={other} />
      <RankLadder own={own} other={other} />
      <BadgeOverlap own={source.badges} other={card.bd ?? {}} name={card.n} />
      {ownWeek && (
        <table className="sr-only">
          <caption>
            You and {card.n}, last seven days. Bars use independent scales; no data means an unknown
            date.
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
                    {peer?.answers === null || peer?.answers === undefined || peer.writing === null
                      ? "No data available."
                      : `${peer.answers} quiz answers, ${peer.writing} writing marks; ${studiedOnDay(otherWeek, day.day) ? "studied" : "no activity recorded"}.`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
