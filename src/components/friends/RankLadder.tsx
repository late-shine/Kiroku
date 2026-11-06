import { useEffect, useState } from "react";
import { RANKS } from "@/lib/rewards";
import { rankLadderPosition, type NotebookSummary } from "@/lib/friends";
import { FriendAvatar } from "./FriendAvatar";

export function RankLadder({ own, other }: { own: NotebookSummary; other: NotebookSummary }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    setEntered(true);
  }, []);
  const ownRank = RANKS.find((rank) => rank.level === own.r)?.name ?? "Just starting";
  const otherRank = RANKS.find((rank) => rank.level === other.r)?.name ?? "Just starting";
  return (
    <section
      className="glass-panel rounded-xl p-4 md:p-5"
      role="img"
      aria-label={`Rank ladder. You: ${ownRank}. ${other.n}: ${otherRank}.`}
    >
      <h2 className="font-display text-base">Places in your notebooks</h2>
      <div className="friends-ladder" aria-hidden="true" data-entered={entered}>
        <div className="friends-ladder-track">
          {RANKS.map((rank, i) => (
            <span key={rank.level} className="friends-ladder-rung" style={{ left: `${i * 20}%` }}>
              {rank.glyph}
            </span>
          ))}
          <span
            className="friends-ladder-marker friends-ladder-yours"
            style={{ left: `${(rankLadderPosition(own.c) / 5) * 100}%` }}
          >
            <FriendAvatar name={own.n} glyph={own.g} frame={own.fr} />
          </span>
          <span
            className="friends-ladder-marker friends-ladder-theirs"
            style={{ left: `${(rankLadderPosition(other.c) / 5) * 100}%` }}
          >
            <FriendAvatar name={other.n} glyph={other.g} frame={other.fr} />
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        You: {ownRank}. {other.n}: {otherRank}.
      </p>
    </section>
  );
}
