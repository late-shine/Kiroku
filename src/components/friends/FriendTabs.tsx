import { RANKS } from "@/lib/rewards";
import {
  alignFriendWeek,
  friendSnapshotFresh,
  resolveDeco,
  studiedOnDay,
  type FriendPeer,
  type FriendCardState,
} from "@/lib/friends";
import { FriendAvatar } from "./FriendAvatar";
import { focusRing } from "./friends-ui";

export function FriendTabs({
  peers,
  cards,
  selected,
  onSelect,
  prefix,
  today,
  now,
  activityKnown,
  unread,
  cheersStale,
}: {
  peers: readonly FriendPeer[];
  cards: Readonly<Record<string, FriendCardState>>;
  selected: string | null;
  onSelect: (uid: string) => void;
  prefix: string;
  today: string;
  now: number;
  activityKnown: boolean;
  unread: Readonly<Record<string, boolean>>;
  cheersStale: boolean;
}) {
  const select = (index: number) => {
    const peer = peers[(index + peers.length) % peers.length];
    if (!peer) return;
    onSelect(peer.uid);
    const tab = document.getElementById(`${prefix}-tab-${peer.uid}`);
    tab?.focus();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  return (
    <div
      className="min-w-0 overflow-x-auto py-2"
      role="tablist"
      aria-label="Friends"
      aria-orientation="horizontal"
    >
      <div className="flex w-max gap-2 px-1">
        {peers.map((peer, index) => {
          const entry = cards[peer.uid];
          const card = peer.state === "final" && entry?.kind === "published" ? entry.card : null;
          const deco = resolveDeco(card, card?.bd ?? {});
          const studied = Boolean(
            activityKnown &&
            card &&
            !entry?.cached &&
            friendSnapshotFresh(card, now) &&
            studiedOnDay(alignFriendWeek(card, today), today),
          );
          return (
            <button
              key={peer.uid}
              type="button"
              role="tab"
              id={`${prefix}-tab-${peer.uid}`}
              aria-controls={`${prefix}-panel-${peer.uid}`}
              aria-selected={peer.uid === selected}
              tabIndex={peer.uid === selected ? 0 : -1}
              className={`flex min-h-11 max-w-64 shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${focusRing} ${peer.uid === selected ? "border-primary/60 bg-primary/10" : "border-border"}`}
              onClick={() => onSelect(peer.uid)}
              onKeyDown={(event) => {
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? peers.length - 1
                      : ["ArrowRight", "ArrowDown"].includes(event.key)
                        ? index + 1
                        : ["ArrowLeft", "ArrowUp"].includes(event.key)
                          ? index - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  select(next);
                }
              }}
            >
              <FriendAvatar
                name={card?.n ?? peer.name}
                glyph={card?.g ?? peer.glyph}
                frame={deco.fr}
              />
              <span className="truncate">{card?.n ?? peer.name}</span>
              {card && (
                <span
                  aria-label={RANKS.find((rank) => rank.level === card.r)?.name ?? "Just starting"}
                >
                  {RANKS.find((rank) => rank.level === card.r)?.glyph}
                </span>
              )}
              {(studied || unread[peer.uid]) && (
                <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
              )}
              {studied && (
                <span className="sr-only">Studied today, as of the last shared update</span>
              )}
              {unread[peer.uid] && (
                <span className="sr-only">
                  {cheersStale ? "Last-known new cheer; status not refreshed" : "1 new cheer"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
