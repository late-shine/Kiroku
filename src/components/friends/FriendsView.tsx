import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Plus, RefreshCw, Users } from "lucide-react";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { BadgeArtDefs } from "@/components/profile/BadgeArt";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { cardEffectRun, type CardEffectRun } from "@/lib/card-motion";
import { addDays, localDay } from "@/lib/word-memory";
import {
  friendCardAge,
  publicName,
  resolveDeco,
  INBOX_BATCH,
  type CardScene,
  type FriendPeer,
} from "@/lib/friends";
import { useFriends } from "./useFriends";
import { FriendsPanel, FriendsConfirmation, type Confirmation } from "./FriendsPanel";
import { AddFriendDrawer } from "./AddFriendDrawer";
import { FriendTabs } from "./FriendTabs";
import { FriendAvatar } from "./FriendAvatar";
import { SideBySide } from "./SideBySide";
import { CheerRow } from "./CheerRow";
import { friendButton } from "./friends-ui";

export function FriendsView({
  scenes,
  onProfile,
  onBack,
}: {
  scenes: readonly CardScene[];
  onProfile: () => void;
  onBack: () => void;
}) {
  const friends = useFriends();
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [online, setOnline] = useState(true);
  const [imageRefresh, setImageRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const prefix = useId();
  const motionAllowed = useMotionPreference();
  const snapshot = friends.snapshot;
  const today = localDay(new Date(clock));
  const people = snapshot?.peers ?? [];
  const peers = people
    .filter((peer) => ["final", "unavailable", "inconsistent"].includes(peer.state))
    .sort((a, b) => {
      const first = snapshot?.cards?.[a.uid],
        second = snapshot?.cards?.[b.uid];
      return (first?.kind === "published" ? first.card.n : a.name).localeCompare(
        second?.kind === "published" ? second.card.n : b.name,
        undefined,
        { sensitivity: "base" },
      );
    });
  const active = peers.find((peer) => peer.uid === selected) ?? peers[0] ?? null;
  const incoming = people.filter((peer) => ["incoming-pending", "crossing"].includes(peer.state));
  const disabled =
    friends.activity.busy ||
    friends.loading ||
    Boolean(snapshot?.cached) ||
    friends.activity.deleting;
  const callbacks = useRef(friends);
  callbacks.current = friends;
  useEffect(() => {
    void friends.refresh();
  }, [friends.refresh]);
  useEffect(() => {
    setSelected(null);
    setDrawer(false);
    setConfirmation(null);
  }, [friends.uid]);
  // Local calendar/freshness boundaries only. Network focus refresh belongs to the provider.
  const timestamps = Object.values(snapshot?.cards ?? {})
    .flatMap((entry) => (entry.kind === "published" && entry.card.t !== null ? [entry.card.t] : []))
    .join(",");
  useEffect(() => {
    const update = () => {
      setClock(Date.now());
      setOnline(navigator.onLine);
    };
    update();
    window.addEventListener("focus", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    const midnight = new Date(clock);
    midnight.setHours(24, 0, 0, 0);
    const stale = timestamps
      .split(",")
      .map(Number)
      .map((time) => time + 36 * 60 * 60_000)
      .filter((time) => time > clock);
    const next = Math.min(midnight.getTime(), ...stale);
    const timer = setTimeout(() => setClock(Date.now()), Math.max(1, next - Date.now() + 30));
    return () => clearTimeout(timer);
  }, [clock, timestamps]);
  const peerIds = peers.map((peer) => peer.uid).join(",");
  useEffect(() => {
    if (selected !== null && !peerIds.split(",").includes(selected)) {
      setSelected(null);
      heading.current?.focus();
    }
    if (!peerIds) heading.current?.focus();
  }, [peerIds, selected, friends.showFriends]);
  const accept = (peer: FriendPeer) => {
    const name = publicName(friends.suggestedName, null);
    if (!name) {
      setDrawer(true);
      return;
    }
    setConfirmation({
      title: `Accept ${peer.name}?`,
      body: `Public name: ${name}\nAvatar symbol: ${friends.glyph || "initial"}\n\nThis shares your name and avatar symbol. Your saved sharing choice stays unchanged.`,
      label: "Accept",
      run: () => {
        void friends.accept(peer.uid, { n: name, g: friends.glyph });
      },
    });
  };
  const remove = (peer: FriendPeer, block = false) =>
    setConfirmation({
      title: `${block ? "Block" : "Remove"} ${peer.name}?`,
      body: block
        ? "This removes your links and requests. They won't be told you blocked them."
        : "This clears your connection and requests. It does not block a later request.",
      label: block ? "Block" : "Remove",
      run: () => {
        void friends.remove(peer.uid, block);
      },
    });
  const refresh = async () => {
    const owner = callbacks.current.uid;
    await callbacks.current.refresh();
    if (callbacks.current.uid !== owner) return;
    setClock(Date.now());
    setImageRefresh((old) => old + 1);
  };
  return (
    <div className="friends-view mx-auto max-w-5xl" data-motion-allowed={motionAllowed === true}>
      <BadgeArtDefs />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1
          ref={heading}
          tabIndex={-1}
          className="flex items-center gap-2 font-display text-xl outline-none"
        >
          <Users aria-hidden="true" className="size-5" />
          Friends
        </h1>
        <div className="flex gap-2">
          <button type="button" className={friendButton} onClick={onBack}>
            <ArrowLeft aria-hidden="true" className="mr-1 inline size-3.5" />
            Back
          </button>
          <button type="button" className={friendButton} onClick={onProfile}>
            Profile & sharing
          </button>
        </div>
      </div>
      {!friends.available ? (
        <p className="glass-panel rounded-xl p-5 text-sm">
          Open Profile to sign in and set up Friends.
        </p>
      ) : friends.activity.deleting || snapshot?.own?.deleting ? (
        <FriendsPanel managementOnly refreshOnOpen={false} />
      ) : (
        <>
          {incoming.length > 0 && (
            <div
              className="glass-panel mb-4 space-y-3 rounded-xl p-4"
              aria-label="Incoming requests"
            >
              {incoming.slice(0, INBOX_BATCH).map((peer) => (
                <div key={peer.uid} className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm">
                    {peer.name} wants to study alongside you.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={disabled}
                      className={friendButton}
                      onClick={() => accept(peer)}
                    >
                      Accept<span className="sr-only"> {peer.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      className={friendButton}
                      onClick={() => void friends.remove(peer.uid)}
                    >
                      Decline<span className="sr-only"> {peer.name}</span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      className={friendButton}
                      onClick={() => remove(peer, true)}
                    >
                      Block<span className="sr-only"> {peer.name}</span>
                    </button>
                  </div>
                </div>
              ))}
              {incoming.length > INBOX_BATCH && (
                <button type="button" className={friendButton} onClick={() => setDrawer(true)}>
                  All requests ({incoming.length})
                </button>
              )}
            </div>
          )}
          <div className="glass-panel min-w-0 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {friends.loading
                  ? "Refreshing Friends…"
                  : snapshot
                    ? friendCardAge(snapshot.fetchedAt, clock).replace("Updated", "Refreshed")
                    : "No confirmed snapshot yet."}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={friendButton}
                  disabled={friends.activity.busy}
                  onClick={() => setDrawer(true)}
                >
                  <Plus aria-hidden="true" className="mr-1 inline size-3.5" />
                  Add friend · Requests ({incoming.length})
                </button>
                <button
                  type="button"
                  className={friendButton}
                  disabled={friends.activity.busy || friends.loading}
                  onClick={() => void refresh()}
                >
                  <RefreshCw aria-hidden="true" className="mr-1 inline size-3.5" />
                  Refresh
                </button>
              </div>
            </div>
            {peers.length > 0 && (
              <FriendTabs
                peers={peers}
                cards={snapshot?.cards ?? {}}
                selected={active?.uid ?? null}
                onSelect={setSelected}
                prefix={prefix}
                today={today}
                now={clock}
                activityKnown={online && !snapshot?.cached}
                unread={friends.unreadCheers}
                cheersStale={friends.cheersStale}
              />
            )}
          </div>
          <div
            role="status"
            aria-live="polite"
            className="my-3 space-y-1 text-sm text-muted-foreground"
          >
            {!online && <p>You're offline. Try requests again when you're back.</p>}
            {friends.error && <p>{friends.error}</p>}
            {friends.cheersError && <p>{friends.cheersError}</p>}
            {friends.error && !snapshot && (
              <p>Couldn’t refresh this desk. Nothing here is filled in.</p>
            )}
            {friends.notice && <p>{friends.notice}</p>}
            {friends.activity.busy && (
              <p>
                {friends.activity.uncertain
                  ? "The request may still be processing. Reconnect to check its status."
                  : "Saving Friends…"}
              </p>
            )}
          </div>
          {peers.length === 0 ? (
            <div className="glass-panel mt-4 rounded-xl">
              <p className="px-5 pt-5 text-sm text-muted-foreground">
                {snapshot?.own
                  ? "Friends see only what you choose to share."
                  : "Study alongside someone you know."}
              </p>
              {!drawer && <FriendsPanel managementOnly refreshOnOpen={false} />}
            </div>
          ) : (
            peers.map((peer) => (
              <section
                key={peer.uid}
                role="tabpanel"
                id={`${prefix}-panel-${peer.uid}`}
                aria-labelledby={`${prefix}-tab-${peer.uid}`}
                hidden={active?.uid !== peer.uid}
                className="mt-4"
              >
                {active?.uid === peer.uid && (
                  <SelectedDesk
                    key={`${friends.uid}:${peer.uid}`}
                    peer={peer}
                    scenes={scenes}
                    today={today}
                    now={clock}
                    offline={!online}
                    imageRefresh={imageRefresh}
                    onRemove={() => remove(peer)}
                    onBlock={() => remove(peer, true)}
                  />
                )}
              </section>
            ))
          )}
        </>
      )}
      {drawer && friends.available && !friends.activity.deleting && (
        <AddFriendDrawer
          requests={incoming.length}
          onClose={() => setDrawer(false)}
          onReturnFocus={() => heading.current?.focus()}
        />
      )}
      {confirmation && friends.available && (
        <FriendsConfirmation confirmation={confirmation} onClose={() => setConfirmation(null)} />
      )}
    </div>
  );
}

function SelectedDesk({
  peer,
  scenes,
  today,
  now,
  offline,
  imageRefresh,
  onRemove,
  onBlock,
}: {
  peer: FriendPeer;
  scenes: readonly CardScene[];
  today: string;
  now: number;
  offline: boolean;
  imageRefresh: number;
  onRemove: () => void;
  onBlock: () => void;
}) {
  const friends = useFriends();
  const entry = friends.snapshot?.cards?.[peer.uid];
  const card = peer.state === "final" && entry?.kind === "published" ? entry.card : null;
  const cached = Boolean(friends.snapshot?.cached || entry?.cached || offline);
  const [run, setRun] = useState<CardEffectRun | null>(null);
  const entered = useRef(false);
  const attempted = useRef<string | null>(null);
  const methods = useRef(friends);
  methods.current = friends;
  useEffect(() => () => methods.current.clearSelectedImages(), []);
  useEffect(() => {
    if (!card || cached || entered.current) return;
    entered.current = true;
    setRun(cardEffectRun(resolveDeco(card, card.bd ?? {}).fx));
  }, [card, cached]);
  const imageKey = card ? `${card.rev}:${card.ph}:${card.bannerId ?? ""}:${imageRefresh}` : null;
  useEffect(() => {
    if (!imageKey || cached || attempted.current === imageKey) return;
    attempted.current = imageKey;
    if (card?.ph) void methods.current.selectPhoto(peer.uid);
    if (card?.bannerId) void methods.current.selectBanner(peer.uid);
  }, [imageKey, cached, peer.uid, card?.ph, card?.bannerId]);
  const photo =
    !cached &&
    card?.ph &&
    friends.selectedPhoto?.peer === peer.uid &&
    friends.selectedPhoto.photo.rev === card.rev
      ? friends.selectedPhoto.photo
      : null;
  const banner =
    !cached &&
    friends.selectedBanner?.peer === peer.uid &&
    friends.selectedBanner.banner.id === card?.bannerId
      ? friends.selectedBanner.banner
      : null;
  const imageError = friends.bannerRead?.peer === peer.uid ? friends.bannerRead.error : null;
  const local = friends.comparisonData(today);
  const unavailable =
    peer.state !== "final"
      ? "Not connected."
      : entry?.kind === "unsupported"
        ? "Update the app to view this card."
        : "Couldn't refresh this desk. Nothing here is filled in.";
  const closed = peer.state === "final" && entry?.kind === "closed";
  if (!card)
    return (
      <div className="glass-panel friends-closed-cover rounded-xl p-5">
        {closed ? (
          <>
            <div className="friends-closed-card">
              <ProfileCard
                mode="friend"
                data={null}
                cover={{ n: peer.name, g: peer.glyph }}
                scenes={scenes}
                renderDefs={false}
                motionRun={null}
              />
              <span aria-hidden="true" className="friends-cover-strap" />
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              {peer.name} isn’t sharing right now. You can still send a cheer.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <FriendAvatar name={peer.name} glyph={peer.glyph} />
              <h2 className="font-display text-lg">{peer.name}</h2>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">{unavailable}</p>
          </>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={friends.activity.busy || cached}
            className={friendButton}
            onClick={onRemove}
          >
            Remove
          </button>
          <button
            type="button"
            disabled={friends.activity.busy || cached}
            className={friendButton}
            onClick={onBlock}
          >
            Block
          </button>
        </div>
        {peer.state === "final" && (
          <CheerRow peer={peer.uid} name={peer.name} today={today} offline={offline} />
        )}
      </div>
    );
  return (
    <div className="friends-comparison-grid">
      <aside className="friends-selected-card min-w-0">
        {cached && (
          <p className="mb-3 text-xs text-muted-foreground">
            {offline
              ? `Offline: showing what we saw ${friendCardAge(entry?.fetchedAt ?? friends.snapshot?.fetchedAt ?? now, now).replace(/^Updated /, "")}.`
              : `Saved on this device · ${new Date(entry?.fetchedAt ?? friends.snapshot?.fetchedAt ?? now).toLocaleString()}.`}
          </p>
        )}
        <ProfileCard
          mode="friend"
          data={card}
          cover={{ n: peer.name, g: peer.glyph }}
          scenes={scenes}
          photo={photo}
          banner={banner}
          bannerError={imageError}
          onRetryBanner={() => void friends.selectBanner(peer.uid)}
          motionRun={run}
          motionActive={!cached}
          renderDefs={false}
          {...(!cached && !friends.activity.busy ? { onRemove, onBlock } : {})}
        />
        <p className="mt-3 text-xs text-muted-foreground">{friendCardAge(card.t, now)}.</p>
        {card.d <= addDays(today, -14) && (
          <p className="mt-2 text-xs text-muted-foreground">No update since {card.d}.</p>
        )}
        {(card.ph || card.bannerId) && !cached && (
          <button
            type="button"
            className={`${friendButton} mt-3`}
            onClick={() => {
              if (card.ph) void friends.selectPhoto(peer.uid);
              if (card.bannerId) void friends.selectBanner(peer.uid);
            }}
          >
            Reload shared images
          </button>
        )}
        <CheerRow peer={peer.uid} name={card.n} today={today} offline={offline} />
      </aside>
      {local ? (
        <SideBySide
          source={local.source}
          previousAnswers={local.previousAnswers}
          ownName={friends.suggestedName || "You"}
          ownDecoration={friends.sharing.settings?.deco ?? null}
          ownAvatar={local.avatar}
          card={card}
          today={today}
          now={now}
          cached={cached}
          photo={photo?.data ?? null}
        />
      ) : (
        <p className="glass-panel rounded-xl p-5 text-sm text-muted-foreground">
          Your comparison is waiting for local progress to finish loading or syncing. Opening
          Friends does not turn sharing on.
        </p>
      )}
    </div>
  );
}
