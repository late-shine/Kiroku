import { useId, useState } from "react";
import { Avatar } from "./Avatar";
import { BadgeArt, BadgeArtDefs } from "./BadgeArt";
import { BadgeShelf } from "./BadgeShelf";
import { Frame } from "./Frame";
import { RankStamp } from "@/components/write/RankStamp";
import { BADGES, RANKS } from "@/lib/rewards";
import { resolveAccent, resolveStamp } from "@/lib/quest-prefs";
import {
  PROFILE_GLYPHS,
  initialOf,
  isAvatarDataUrl,
  type Avatar as AvatarData,
} from "@/lib/profile";
import {
  FRIEND_STATUS_LABELS,
  FRIEND_TAG_LABELS,
  friendCardAge,
  resolveDeco,
  type CardScene,
  type FriendCard,
  type FriendPhoto,
  type PublicIdentity,
} from "@/lib/friends";

type SharedProps = {
  data: FriendCard | null;
  cover: PublicIdentity;
  scenes: readonly CardScene[];
  draft?: boolean;
  sharing?: boolean;
  renderDefs?: boolean;
};
type Props = SharedProps &
  (
    | {
        mode: "self";
        privateAvatar: AvatarData;
        onEdit?: () => void;
        onStat?: (metric: "streak" | "carved" | "mastered") => void;
      }
    | { mode: "friend"; photo?: FriendPhoto | null; onRemove?: () => void; onBlock?: () => void }
  );
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function publicAvatar(
  name: string,
  glyph: string,
  photo: FriendPhoto | null,
  card: FriendCard | null,
): AvatarData {
  if (card?.ph && photo?.rev === card.rev && isAvatarDataUrl(photo.data))
    return { kind: "photo", url: photo.data };
  const symbol = PROFILE_GLYPHS.find((item) => item.id === glyph);
  return symbol
    ? { kind: "glyph", char: symbol.char, id: symbol.id }
    : { kind: "initial", char: initialOf(name) };
}
function sharingDay(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : day;
}

/** Shared self/draft/published renderer. A closed cover never renders numeric content. */
export function ProfileCard(props: Props) {
  const heading = useId();
  const [shelfOpen, setShelfOpen] = useState(false);
  const data = props.data;
  const name = data?.n ?? props.cover.n;
  const badges = data?.bd ?? {};
  const deco = resolveDeco(data, badges);
  const accent = resolveAccent(data?.acc, badges);
  const avatar =
    props.mode === "self"
      ? props.privateAvatar
      : publicAvatar(name, data?.g ?? props.cover.g, props.photo ?? null, data);
  const scene = deco.bk === undefined ? undefined : props.scenes[deco.bk];
  const pins = (deco.pin?.split(",") ?? []).filter((id) => badges[id]);
  const earned = BADGES.filter((badge) => badges[badge.id]);
  const extra = earned.length - pins.length;
  const rank = data ? RANKS.find((item) => item.level === data.r) : undefined;
  const onStat = props.mode === "self" ? props.onStat : undefined;
  const active =
    data !== null &&
    (props.mode === "friend" || earned.length > 0 || data.s > 0 || data.c > 0 || data.m > 0);
  const menu =
    props.mode === "friend" && (props.onRemove || props.onBlock) ? (
      <details className="absolute right-3 top-3 z-10">
        <summary
          aria-label={`Actions for ${name}`}
          className={`grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-lg border border-border bg-glass-strong px-3 ${focus}`}
        >
          •••
        </summary>
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-border bg-background p-1 text-xs">
          {props.onRemove && (
            <button
              type="button"
              className={`min-h-11 w-full rounded px-3 text-left ${focus}`}
              onClick={props.onRemove}
            >
              Remove friend
            </button>
          )}
          {props.onBlock && (
            <button
              type="button"
              className={`min-h-11 w-full rounded px-3 text-left text-destructive ${focus}`}
              onClick={props.onBlock}
            >
              Block
            </button>
          )}
        </div>
      </details>
    ) : null;
  return (
    <article
      aria-labelledby={heading}
      data-card-accent={accent}
      className="profile-card relative w-full overflow-hidden rounded-2xl"
    >
      {props.renderDefs !== false && <BadgeArtDefs />}
      <div
        aria-hidden="true"
        className={`profile-card-banner relative overflow-hidden bg-secondary ${scene ? "" : "profile-card-banner-ink"}`}
      >
        {scene && <img src={scene.url} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-scrim/70 to-transparent" />
        <span className="profile-card-wordmark">
          記録 <span>CALLING CARD</span>
        </span>
      </div>
      {menu}
      {props.mode === "self" && props.onEdit && (
        <button
          type="button"
          className={`absolute right-3 top-3 min-h-11 rounded-lg border border-border bg-glass-strong px-3 text-xs ${focus}`}
          onClick={props.onEdit}
        >
          Edit card
        </button>
      )}
      <div className="profile-card-body">
        <div className="profile-card-avatar-row flex items-start gap-5">
          <Frame frame={data ? deco.fr : "plain"} className="profile-card-avatar-frame -mt-[39px]">
            <Avatar
              avatar={avatar}
              fallbackChar={initialOf(name)}
              className="profile-avatar size-[72px] bg-secondary text-3xl text-primary"
            />
          </Frame>
          {data && deco.sb && (
            <div className="profile-card-status relative mt-3 min-w-0 rounded-2xl border border-border bg-glass-strong px-3 py-2 text-xs text-foreground">
              <span
                aria-hidden="true"
                className="absolute -left-3 top-3 size-2 rounded-full border border-border bg-glass-strong"
              />
              <span
                aria-hidden="true"
                className="absolute -left-[18px] top-1 size-1 rounded-full border border-border bg-glass-strong"
              />
              {FRIEND_STATUS_LABELS[deco.sb]}
            </div>
          )}
        </div>
        <div className="profile-card-name-row mt-4 flex min-w-0 flex-wrap items-center gap-2">
          <h2
            id={heading}
            className="min-w-0 break-words font-display text-2xl text-foreground [overflow-wrap:anywhere]"
          >
            {name}
          </h2>
          {data && deco.tg && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
              {FRIEND_TAG_LABELS[deco.tg]}
            </span>
          )}
        </div>
        {props.draft && (
          <p className="profile-card-draft mt-2 text-xs font-medium text-primary">Draft preview</p>
        )}
        {!data ? (
          <p className="mt-3 text-sm text-muted-foreground">Desk closed</p>
        ) : (
          <>
            {active && (
              <>
                <div className="profile-card-rank mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground [&>[data-stamp]]:size-6 [&>[data-stamp]]:text-[10px]">
                  {rank && <RankStamp glyph={rank.glyph} stamp={resolveStamp(data.st, data.r)} />}
                  <span>{rank ? `${rank.glyph} ${rank.name}` : "No rank yet"}</span>
                </div>
                {earned.length > 0 && (
                  <div className="profile-card-pins mt-4 flex min-h-7 flex-wrap items-center gap-2">
                    {pins.map((id) => (
                      <span
                        key={id}
                        role="img"
                        aria-label={BADGES.find((badge) => badge.id === id)?.name ?? id}
                        title={BADGES.find((badge) => badge.id === id)?.name}
                      >
                        <BadgeArt id={id} className="size-7" />
                      </span>
                    ))}
                    {extra > 0 && (
                      <button
                        type="button"
                        aria-expanded={shelfOpen}
                        aria-label={`${extra} more earned badges. ${shelfOpen ? "Close" : "Open"} full badge shelf`}
                        className={`hit-area rounded-full border border-border px-1.5 py-0.5 text-[10px] ${focus}`}
                        onClick={() => setShelfOpen((open) => !open)}
                      >
                        +{extra}
                      </button>
                    )}
                  </div>
                )}
                <div className="profile-card-stats mt-5 grid grid-cols-3">
                  {(
                    [
                      ["streak", data.s],
                      ["carved", data.c],
                      ["mastered", data.m],
                    ] as const
                  ).map(([label, value]) => {
                    const content = (
                      <>
                        <span className="block font-display text-2xl font-medium tabular-nums text-primary">
                          {value}
                        </span>
                        <span className="mt-0.5 block break-words text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {label}
                        </span>
                      </>
                    );
                    const cls = "profile-card-stat min-w-0 py-3 text-center";
                    return onStat ? (
                      <button
                        key={label}
                        type="button"
                        className={`${cls} ${focus}`}
                        onClick={() => onStat(label)}
                        aria-label={`${value} ${label}. Open your progress.`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div key={label} className={cls}>
                        {content}
                      </div>
                    );
                  })}
                </div>
                {shelfOpen && (
                  <BadgeShelf
                    badges={badges}
                    today={data.d}
                    includeDefs={false}
                    className="profile-card-shelf mt-4"
                  />
                )}
              </>
            )}
            <p className="profile-card-footer mt-4 text-[11px] text-muted-foreground">
              {props.draft
                ? "Only you can see this draft."
                : props.mode === "friend"
                  ? friendCardAge(data.t)
                  : props.sharing
                    ? `Sharing since ${sharingDay(data.sh)}`
                    : "Made yours, one day at a time."}
            </p>
            {props.mode === "friend" && !props.draft && (
              <p className="profile-card-footer mt-1 text-[11px] text-muted-foreground">
                Sharing since {sharingDay(data.sh)}
              </p>
            )}
          </>
        )}
      </div>
    </article>
  );
}
