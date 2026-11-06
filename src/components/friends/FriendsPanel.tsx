import { Check, ChevronDown, Copy, Link } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import {
  groupedFriendCode,
  normalizeFriendCode,
  INBOX_BATCH,
  publicName,
  friendCardAge,
  resolveDeco,
  type FriendPeer,
  type FriendCard,
  type FriendSettings,
} from "@/lib/friends";
import { PROFILE_GLYPHS, initialOf } from "@/lib/profile";
import { BADGES, RANKS } from "@/lib/rewards";
import { decorationDefinition } from "@/lib/friend-decorations";
import { Frame } from "@/components/profile/Frame";
import { useFriends } from "./useFriends";

const buttonClass =
  "min-h-11 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";
const primaryClass = `${buttonClass} bg-primary text-primary-foreground`;
const inputClass =
  "min-h-11 w-full min-w-0 rounded-md border border-border bg-background/70 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
export type Confirmation = { title: string; body: string; label: string; run: () => void };
type RowKind = "incoming" | "outgoing" | "final" | "unavailable";

export function FriendsConfirmation({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useScrollLock();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="friends-confirm-title"
      aria-describedby="friends-confirm-body"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground backdrop:bg-background/70 backdrop:backdrop-blur-sm"
    >
      <h3 id="friends-confirm-title" className="font-display text-lg">
        {confirmation.title}
      </h3>
      <p
        id="friends-confirm-body"
        className="mt-3 whitespace-pre-line break-words text-sm text-muted-foreground"
      >
        {confirmation.body}
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus className={buttonClass} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={primaryClass}
          onClick={() => {
            onClose();
            confirmation.run();
          }}
        >
          {confirmation.label}
        </button>
      </div>
    </dialog>
  );
}

function symbolLabel(glyph: string, name: string): string {
  const symbol = PROFILE_GLYPHS.find((item) => item.id === glyph);
  return symbol ? `${symbol.char} (${symbol.label})` : `${initialOf(name) || "—"} (initial)`;
}

export function FriendsPanel({
  managementOnly = false,
  refreshOnOpen = true,
}: {
  managementOnly?: boolean;
  refreshOnOpen?: boolean;
}) {
  const friends = useFriends();
  const { sync } = useAccountSync();
  const [settingUp, setSettingUp] = useState(false);
  // Default for a new setup only; saved choices always win.
  const [setupShare, setSetupShare] = useState(true);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [batch, setBatch] = useState(INBOX_BATCH);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [copyPending, setCopyPending] = useState(false);
  const copySequence = useRef(0);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ++copySequence.current;
    setCopied(null);
    setCopyPending(false);
    setCopyNotice(null);
    return () => {
      ++copySequence.current;
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    };
  }, [friends.uid, friends.snapshot?.own?.code, friends.activity.deleting]);

  useEffect(() => {
    setNameDraft(null);
    setSettingUp(false);
    setSetupShare(true);
    setCode("");
    setBatch(INBOX_BATCH);
    setConfirmation(null);
    setCopyNotice(null);
  }, [friends.uid]);

  useEffect(() => {
    setNameDraft(null);
  }, [friends.sharing.settings?.rev]);

  useEffect(() => {
    if (!friends.activity.deleting) return;
    setNameDraft(null);
    setSettingUp(false);
    setSetupShare(true);
    setConfirmation(null);
    setCopyNotice(null);
  }, [friends.activity.deleting]);

  useEffect(() => {
    if (refreshOnOpen) void friends.refresh(); // The single provider owns background/focus refresh.
  }, [friends.refresh, refreshOnOpen]);

  useEffect(() => {
    if (!friends.invite) return;
    setCode(groupedFriendCode(friends.invite));
    // Keep the prefill in the controller until setup makes the input available.
    if (friends.snapshot?.own && !friends.snapshot.own.deleting) {
      codeInput.current?.focus();
      friends.clearInvite();
    }
  }, [friends.invite, friends.snapshot?.own, friends.clearInvite]);

  if (!friends.available) return null;
  const snapshot = friends.snapshot;
  const deleting = friends.activity.deleting || snapshot?.own?.deleting;
  const disabled =
    friends.activity.busy || friends.loading || Boolean(snapshot?.cached) || Boolean(deleting);
  const hasAddForm = Boolean(snapshot?.own && !snapshot.cached && !deleting);
  const showActionFeedback = !hasAddForm || managementOnly || friends.feedbackTarget !== "sharing";
  const validCode = normalizeFriendCode(code);
  const feedback = (
    <div className="space-y-2 text-sm" aria-live="polite" aria-atomic="true">
      {friends.loading && <p className="text-muted-foreground">Refreshing Friends…</p>}
      {friends.activity.busy && (
        <p className="text-muted-foreground">
          {friends.activity.uncertain
            ? "The request may still be processing. Reconnect to check its status."
            : "Saving Friends…"}
        </p>
      )}
      {friends.activity.outcome && <p>{friends.activity.outcome}</p>}
      {showActionFeedback && friends.notice && <p>{friends.notice}</p>}
      {showActionFeedback && friends.error && (
        <p className="break-words text-destructive">{friends.error}</p>
      )}
    </div>
  );
  const chosenName = nameDraft ?? friends.suggestedName;
  const clean = publicName(chosenName, null);
  const identity = { n: clean ?? "", g: friends.glyph };
  const symbol = symbolLabel(friends.glyph, chosenName);
  const requestDisclosure = !friends.sharing.loaded
    ? "This request shares your name and avatar symbol. Your saved sharing choice controls progress sharing."
    : !friends.sharing.settings
      ? "This request shares your name and avatar symbol. No progress is shared until you save a sharing choice."
      : friends.sharing.settings.on
        ? "This request shares your name and avatar symbol. Your sharing choice stays on. Accepted friends can see your published card."
        : "This request shares your name and avatar symbol. Progress sharing stays off.";
  const consent = `Public name: ${clean ?? "Choose a name"}\nAvatar symbol: ${symbol}\n\n${requestDisclosure}`;
  const peers = snapshot?.peers ?? [];
  const incoming = peers.filter(
    (peer) => peer.state === "incoming-pending" || peer.state === "crossing",
  );
  const outgoing = peers.filter((peer) => peer.state === "outgoing-pending");
  const connected = peers.filter((peer) => peer.state === "final");
  const unavailable = peers.filter(
    (peer) => peer.state === "inconsistent" || peer.state === "unavailable",
  );

  const copy = async (invite: boolean) => {
    const ownCode = snapshot?.own?.code;
    if (!ownCode) return;
    const sequence = ++copySequence.current;
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    setCopyPending(true);
    setCopied(null);
    setCopyNotice(null);
    try {
      await navigator.clipboard.writeText(
        invite ? `${location.origin}/#friend=${ownCode}` : groupedFriendCode(ownCode),
      );
      if (sequence !== copySequence.current) return;
      setCopied(invite ? "link" : "code");
      setCopyNotice(invite ? "Invite link copied." : "Friend code copied.");
      copyTimer.current = setTimeout(() => {
        if (sequence !== copySequence.current) return;
        setCopied(null);
        setCopyNotice(null);
      }, 2_000);
    } catch {
      if (sequence !== copySequence.current) return;
      setCopyNotice("Couldn't copy. Select your friend code and copy it manually.");
    } finally {
      if (sequence === copySequence.current) setCopyPending(false);
    }
  };

  const remove = (peer: FriendPeer, block = false) => {
    const title = block
      ? `Block ${peer.name}?`
      : peer.state === "crossing"
        ? "Cancel these requests?"
        : peer.state === "final"
          ? `Remove ${peer.name}?`
          : "Cancel this connection?";
    const body = block
      ? "This removes your friend links and pending requests. They won't be told you blocked them."
      : peer.state === "crossing"
        ? "This clears both your request and their request. You can exchange a current code to try again later."
        : "This clears the connection and any requests in both directions. It does not block future requests.";
    setConfirmation({
      title,
      body,
      label: block ? "Block" : peer.state === "final" ? "Remove" : "Clear requests",
      run: () => {
        void friends.remove(peer.uid, block);
      },
    });
  };

  const confirmRotation = () => {
    setConfirmation({
      title: "Change your friend code?",
      body: "Your old code and invite links will stop working. Existing friends and received requests stay connected.",
      label: "Change code",
      run: () => {
        void friends.rotate();
      },
    });
  };

  const peerRow = (peer: FriendPeer, kind: RowKind) => {
    const entry = snapshot?.cards?.[peer.uid];
    const card = kind === "final" && entry?.kind === "published" ? entry.card : null;
    return (
      <li
        key={peer.uid}
        className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 py-3 last:border-0"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3 break-words text-sm">
            <Frame frame={card ? resolveDeco(card, card.bd ?? {}).fr : "plain"}>
              <span
                role="img"
                aria-label={symbolLabel(card?.g ?? peer.glyph, card?.n ?? peer.name)}
                className="profile-avatar grid size-8 place-items-center rounded-full bg-secondary text-sm text-primary"
              >
                {PROFILE_GLYPHS.find((symbol) => symbol.id === (card?.g ?? peer.glyph))?.char ??
                  initialOf(card?.n ?? peer.name)}
              </span>
            </Frame>
            <span>{card?.n ?? peer.name}</span>
          </div>
          {peer.state === "crossing" && (
            <p className="text-xs text-muted-foreground">You both sent a request.</p>
          )}
          {kind === "unavailable" && <p className="text-xs text-muted-foreground">Not connected</p>}
          {kind === "final" && !managementOnly && <PlainFriendCard peer={peer} />}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Actions for ${peer.name}`}>
          {kind === "incoming" && (
            <button
              type="button"
              className={primaryClass}
              disabled={disabled || !clean}
              aria-label={`Accept ${peer.name}'s request`}
              onClick={() =>
                setConfirmation({
                  title: `Accept ${peer.name}?`,
                  body: consent,
                  label: "Accept",
                  run: () => {
                    void friends.accept(peer.uid, identity);
                  },
                })
              }
            >
              Accept
            </button>
          )}
          <button
            type="button"
            className={buttonClass}
            disabled={disabled}
            aria-label={`${kind === "incoming" ? "Decline request from" : kind === "outgoing" ? "Cancel request to" : "Remove connection with"} ${peer.name}`}
            onClick={() => remove(peer)}
          >
            {kind === "incoming" ? "Decline" : kind === "outgoing" ? "Cancel" : "Remove"}
          </button>
          {kind !== "outgoing" && (
            <button
              type="button"
              className={buttonClass}
              disabled={disabled}
              aria-label={`Block ${peer.name}`}
              onClick={() => remove(peer, true)}
            >
              Block
            </button>
          )}
        </div>
      </li>
    );
  };

  return (
    <section
      id="friends-beta"
      aria-labelledby="friends-title"
      className="min-w-0 border-t border-border p-5 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="friends-title" className="font-display text-base">
          Friends (beta)
        </h2>
        <button
          type="button"
          className={buttonClass}
          disabled={friends.activity.busy || friends.loading}
          onClick={() => {
            void friends.refresh();
          }}
        >
          Refresh
        </button>
      </div>
      {!hasAddForm && <div className="mt-3">{feedback}</div>}
      {deleting ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Cloud deletion is in progress. Finish it before using Friends again.
          </p>
          <button
            type="button"
            className={buttonClass}
            disabled={friends.activity.busy || sync.busy}
            onClick={sync.askDelete}
          >
            Finish deleting cloud data
          </button>
        </div>
      ) : (
        <>
          {snapshot?.cached && (
            <p className="mt-3 text-sm text-muted-foreground">
              Saved Friends snapshot from {new Date(snapshot.fetchedAt).toLocaleString()}. Reconnect
              and refresh before making changes.
            </p>
          )}
          {snapshot && !snapshot.own && !snapshot.cached && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Friends · Off. Study alongside someone you know.
              </p>
              {!settingUp && (
                <button
                  type="button"
                  className={primaryClass}
                  disabled={disabled}
                  onClick={() => setSettingUp(true)}
                >
                  Set up friends
                </button>
              )}
              {friends.invite && (
                <p className="text-sm text-muted-foreground">
                  Your invite code is ready to add after setup. Nothing will be sent automatically.
                </p>
              )}
            </div>
          )}
          {((settingUp && snapshot && !snapshot.own && !snapshot.cached) ||
            (snapshot?.own && !snapshot.cached)) && (
            <div className="mt-4 space-y-3">
              <label className="block space-y-2 text-sm">
                <span>Your public name</span>
                <input
                  className={inputClass}
                  maxLength={24}
                  value={chosenName}
                  disabled={disabled}
                  onChange={(event) => setNameDraft(event.target.value)}
                  autoComplete="off"
                />
              </label>
              <p className="break-words text-xs text-muted-foreground">
                Avatar: {symbol}. Change it in your profile. Picture sharing is a separate choice.
              </p>
              {!clean && (
                <p className="text-sm text-muted-foreground">Enter a name to use Friends.</p>
              )}
              {!snapshot?.own && (
                <div className="space-y-3 border-t border-border pt-3">
                  <SharingChoice
                    id="friends-setup-share"
                    checked={setupShare}
                    disabled={disabled}
                    onChange={setSetupShare}
                  />
                  <p className="text-xs text-muted-foreground">
                    {setupShare ? READY_TEXT : "Nothing is shared. You can turn sharing on later."}
                  </p>
                  <WhatFriendsSee />
                  <p className="text-xs text-muted-foreground">
                    Creating your friend code also saves this choice.
                  </p>
                  <button
                    type="button"
                    className={primaryClass}
                    disabled={disabled || !clean}
                    onClick={() => {
                      void friends.setup(identity, setupShare);
                    }}
                  >
                    Create friend code
                  </button>
                </div>
              )}
            </div>
          )}
          {snapshot?.own && !snapshot.cached && (
            <div className="mt-5 space-y-4 border-t border-border pt-4">
              {!managementOnly && (
                <FriendsSharing
                  name={chosenName}
                  disabled={disabled}
                  friendCount={connected.length}
                />
              )}
              <div className={`grid gap-4 ${managementOnly ? "" : "lg:grid-cols-2"}`}>
                <div className="min-w-0 rounded-xl border border-border bg-background/20 p-4">
                  <h3 className="font-display text-base">Your code</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Share it with someone you know.
                  </p>
                  <p
                    className={`mt-2 select-all break-all ${managementOnly ? "font-display" : "font-mono"} text-xl tracking-wider`}
                    aria-label={`Friend code: ${snapshot.own.code.slice(0, 5)}, ${snapshot.own.code.slice(5)}`}
                  >
                    {groupedFriendCode(snapshot.own.code)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`${buttonClass} inline-flex min-w-32 items-center justify-center gap-2`}
                      disabled={copyPending}
                      onClick={() => {
                        void copy(false);
                      }}
                    >
                      {copied === "code" ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        <Copy aria-hidden="true" className="size-4" />
                      )}
                      {copied === "code" ? "Copied!" : "Copy code"}
                    </button>
                    <button
                      type="button"
                      className={`${buttonClass} inline-flex min-w-40 items-center justify-center gap-2`}
                      disabled={copyPending}
                      onClick={() => {
                        void copy(true);
                      }}
                    >
                      {copied === "link" ? (
                        <Check aria-hidden="true" className="size-4" />
                      ) : (
                        <Link aria-hidden="true" className="size-4" />
                      )}
                      {copied === "link" ? "Copied!" : "Copy invite link"}
                    </button>
                  </div>
                  <p
                    role="status"
                    aria-live="polite"
                    className="mt-2 min-h-5 text-xs text-muted-foreground"
                  >
                    {copyNotice}
                  </p>
                </div>
                <form
                  className="min-w-0 space-y-3 rounded-xl border border-border bg-background/20 p-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (disabled || !clean || !validCode) return;
                    setConfirmation({
                      title: "Send friend request?",
                      body: consent,
                      label: "Send request",
                      run: () => {
                        void friends.request(code, identity);
                      },
                    });
                  }}
                >
                  <h3 className="font-display text-base">Add a friend</h3>
                  <label className="block space-y-2 text-sm">
                    <span>Their friend code</span>
                    <input
                      ref={codeInput}
                      className={inputClass}
                      value={code}
                      disabled={disabled}
                      onChange={(event) => setCode(event.target.value)}
                      placeholder="K7F2M-9XQ4T"
                      autoCapitalize="characters"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={40}
                      aria-invalid={Boolean(code.trim() && !validCode)}
                    />
                  </label>
                  {code.trim() && !validCode && (
                    <p className="text-xs text-muted-foreground">
                      Use their 10-character code. Spaces and the dash are optional.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{requestDisclosure}</p>
                  <button
                    type="submit"
                    className={primaryClass}
                    disabled={disabled || !clean || !validCode}
                  >
                    Review request
                  </button>
                  {feedback}
                </form>
              </div>
            </div>
          )}
          {snapshot && (snapshot.own || snapshot.cached) && (
            <div className="mt-5 grid min-w-0 gap-5 border-t border-border pt-4 xl:grid-cols-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Requests ({incoming.length})</h3>
                {incoming.length ? (
                  <ul>{incoming.slice(0, batch).map((peer) => peerRow(peer, "incoming"))}</ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No incoming requests.</p>
                )}
                {incoming.length > batch && (
                  <button
                    type="button"
                    className={`${buttonClass} mt-3`}
                    onClick={() => setBatch((value) => value + INBOX_BATCH)}
                  >
                    Show more requests
                  </button>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Outgoing requests</h3>
                {outgoing.length ? (
                  <ul>{outgoing.map((peer) => peerRow(peer, "outgoing"))}</ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No outgoing requests.</p>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Friends</h3>
                {connected.length ? (
                  <ul>{connected.map((peer) => peerRow(peer, "final"))}</ul>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">No friends yet.</p>
                )}
              </div>
              {unavailable.length > 0 && (
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold">Connections to clear</h3>
                  <ul>{unavailable.map((peer) => peerRow(peer, "unavailable"))}</ul>
                </div>
              )}
              <details className="min-w-0 border-t border-border pt-3 xl:col-span-2">
                <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
                  More options · code & blocked people
                </summary>
                <div className="space-y-4 pb-2">
                  <div>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={disabled || Boolean(snapshot.cached)}
                      onClick={confirmRotation}
                    >
                      Change friend code
                    </button>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Replaces old invite links. Existing friends stay connected.
                    </p>
                  </div>
                  <h3 className="text-sm font-semibold">
                    Blocked people ({snapshot.blocks.length})
                  </h3>
                  {snapshot.blocks.length ? (
                    <ul>
                      {snapshot.blocks.map((peer, index) => (
                        <li
                          key={peer}
                          className="mt-2 flex flex-wrap items-center justify-between gap-2"
                        >
                          <span className="text-sm">{friends.blockedName(peer)}</span>
                          <button
                            type="button"
                            className={buttonClass}
                            disabled={disabled}
                            aria-label={`Unblock ${friends.blockedName(peer)}, entry ${index + 1}`}
                            onClick={() => {
                              void friends.unblock(peer);
                            }}
                          >
                            Unblock
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No blocked people.</p>
                  )}
                </div>
              </details>
            </div>
          )}
        </>
      )}
      {confirmation && (
        <FriendsConfirmation confirmation={confirmation} onClose={() => setConfirmation(null)} />
      )}
    </section>
  );
}

function PublicSummary({ card }: { card: Omit<FriendCard, "t"> }) {
  const rank = RANKS.find((item) => item.level === card.r);
  const badges = BADGES.filter((badge) => card.bd?.[badge.id]);
  const pinned = BADGES.filter((badge) => card.pin?.split(",").includes(badge.id));
  const values = [
    ["Rank", rank ? `${rank.glyph} ${rank.name}` : "No rank yet"],
    ["Study streak", `${card.s} days`],
    ["Kanji carved", card.c],
    ["Words mastered", card.m],
    ["Lessons", card.l],
    ["Taught kanji", card.k],
    ["Vocabulary", card.vc],
  ];
  const deco = resolveDeco(card, card.bd ?? {});
  return (
    <div className="mt-3 space-y-3 break-words text-xs text-muted-foreground">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {values.map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      <p>Seven days through {card.d}, oldest first:</p>
      <p>Quiz answers: {card.a.split(",").join(", ")}</p>
      <p>Writing marks: {card.w.split(",").join(", ")}</p>
      <p>
        Earned badges: {badges.length ? badges.map((badge) => badge.name).join(", ") : "None yet"}.
      </p>
      {pinned.length > 0 && <p>Pinned badges: {pinned.map((badge) => badge.name).join(", ")}.</p>}
      <p>
        Accent: {card.acc}. Stamp: {card.st}. Frame: {decorationDefinition("frame", deco.fr)?.name}.
        Border: {decorationDefinition("border", deco.border ?? "none")?.name}. Detail:{" "}
        {decorationDefinition("charm", deco.charm ?? "none")?.name}. Effect:{" "}
        {decorationDefinition("effect", deco.fx)?.name}.
      </p>
      <p>
        Banner:{" "}
        {card.bannerId ? "Uploaded crop" : card.bk === undefined ? "Flat" : `Scene ${card.bk + 1}`}.
        Study tag: {card.tg ?? "None"}. Status: {card.statusText ?? card.sb ?? "None"}.
      </p>
      <p>Sharing since {card.sh}.</p>
    </div>
  );
}

function PlainFriendCard({ peer }: { peer: FriendPeer }) {
  const friends = useFriends();
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  const entry = friends.snapshot?.cards?.[peer.uid];
  if (!entry)
    return <p className="mt-2 text-xs text-muted-foreground">Card unavailable. Refresh Friends.</p>;
  if (entry.kind === "closed")
    return <p className="mt-2 text-xs text-muted-foreground">Desk closed</p>;
  if (entry.kind === "unsupported")
    return <p className="mt-2 text-xs text-muted-foreground">Update the app to view this card.</p>;
  if (entry.kind !== "published")
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        {entry.kind === "unavailable" && !entry.cached
          ? "Not connected"
          : "Card unavailable. Refresh Friends."}
      </p>
    );
  const card = entry.card;
  const cached = entry.cached || friends.snapshot?.cached;
  const photo =
    friends.selectedPeer === peer.uid &&
    friends.selectedPhoto?.peer === peer.uid &&
    friends.selectedPhoto.photo.rev === card.rev &&
    card.ph
      ? friends.selectedPhoto.photo.data
      : null;
  const banner =
    failedBanner !== card.bannerId &&
    !cached &&
    friends.selectedBanner?.peer === peer.uid &&
    friends.selectedBanner.banner.id === card.bannerId
      ? friends.selectedBanner.banner
      : null;
  const bannerRead =
    friends.bannerRead?.peer === peer.uid && friends.bannerRead.id === card.bannerId
      ? friends.bannerRead
      : null;
  return (
    <div className="mt-2">
      <p className="text-xs text-muted-foreground">{friendCardAge(card.t)}</p>
      {card.t !== null && Date.now() - card.t > 36 * 60 * 60_000 && (
        <p className="mt-1 text-xs text-muted-foreground">This snapshot may be out of date.</p>
      )}
      {cached && (
        <p className="mt-1 text-xs text-muted-foreground">
          Saved card from {new Date(entry.fetchedAt).toLocaleString()}; it couldn&apos;t be
          refreshed.
        </p>
      )}
      {photo && (
        <img
          className="mt-3 size-16 rounded-md object-cover"
          src={photo}
          alt={`${card.n}'s shared avatar`}
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      {card.ph && !photo && (
        <button
          type="button"
          className={`${buttonClass} mt-2`}
          disabled={Boolean(cached)}
          aria-label={`View ${card.n}'s shared picture`}
          onClick={() => {
            void friends.selectPhoto(peer.uid);
          }}
        >
          View picture
        </button>
      )}
      {banner && (
        <img
          className="mt-3 aspect-[8/3] w-full max-w-md rounded-md object-contain"
          src={banner.data}
          alt={`${card.n}'s shared banner`}
          onError={() => setFailedBanner(banner.id)}
        />
      )}
      {card.bannerId && !banner && (
        <div className="mt-2">
          {(bannerRead?.error || failedBanner === card.bannerId) && (
            <p role="status" className="text-xs text-muted-foreground">
              {bannerRead?.error ?? "Couldn't display this banner. Retry when connected."}
            </p>
          )}
          <button
            type="button"
            className={buttonClass}
            disabled={Boolean(cached) || Boolean(bannerRead?.loading)}
            onClick={() => {
              setFailedBanner(null);
              void friends.selectBanner(peer.uid);
            }}
          >
            {bannerRead?.loading
              ? "Loading banner…"
              : bannerRead?.error || failedBanner === card.bannerId
                ? "Retry banner"
                : "View banner"}
          </button>
        </div>
      )}
      <PublicSummary card={card} />
    </div>
  );
}

// Audience copy follows the current public-card allowlist.
const SHARING_SUMMARY =
  "Accepted friends can see your card and study summary. Lessons, email and API keys stay private.";
const SHARING_FIELDS = [
  "Your public name and avatar symbol.",
  "Rank, study streak, kanji carved, words mastered, and lesson, taught-kanji and vocabulary counts.",
  "Your last 7 days of quiz answers and writing marks.",
  "Earned badges and up to three pinned badges.",
  "Your card look: accent, stamp, avatar frame, card border, little detail, effect, banner scene or cropped uploaded banner, study tag, and status preset or personal status text (up to 60 characters).",
];
const SHARING_PICTURE =
  "Your uploaded picture is shown only if you turn on the separate picture choice. Your Google picture is never shared.";
const SHARING_PRIVATE =
  "Never shared: your email, lesson text, word lists, Gemini key, or the private banner source and crop controls.";
const READY_TEXT = "Ready for your first friend. Only people you accept can see your shared card.";
const MISSING_HELP =
  "Sharing starts On for a new setup. Only people you accept can see your card. Nothing is shared until you save.";
const DEVICE_HELP =
  "Sync this account, or use the study progress stored on this device. Nothing is shared from this device until you choose.";
const DEVICE_WAIT =
  "Wait for progress to finish loading or syncing before using this device's progress.";
const CARD_KEPT = "Your last published card stays visible until then.";

/** A real switch; the On/Off word beside it means state never relies on color alone. */
function SharingChoice({
  id,
  checked,
  disabled,
  describedBy,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled: boolean;
  describedBy?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <span id={`${id}-label`} className="text-sm">
        Share with friends
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {checked ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby={`${id}-label`}
          aria-describedby={describedBy}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`hit-area relative h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 motion-reduce:transition-none ${
            checked ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`block size-4 rounded-full bg-background shadow transition-transform motion-reduce:transition-none ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </span>
    </div>
  );
}

/** The summary line stays visible; the details list the published fields. Not a technical dump. */
function WhatFriendsSee() {
  return (
    <details className="group text-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 py-2 focus-visible:outline-2 focus-visible:outline-ring">
        <span className="min-w-0">
          <span className="block font-medium">What friends see</span>
          <span className="mt-1 block text-xs text-muted-foreground">{SHARING_SUMMARY}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground group-open:rotate-180"
        />
      </summary>
      <div className="space-y-3 pb-2 text-xs text-muted-foreground">
        <ul className="list-disc space-y-1 pl-5">
          {SHARING_FIELDS.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
        <p>{SHARING_PICTURE}</p>
        <p>{SHARING_PRIVATE}</p>
        <p>Stats and unlocks are self-reported, not verified achievements.</p>
        <p>
          Turning sharing off removes your shared card, picture and banner after it is saved. Your
          editable banner stays private in your account. Copies already seen on another device may
          remain there until refreshed.
        </p>
        <p>Signing out doesn&apos;t hide your card. Turn sharing off first.</p>
      </div>
    </details>
  );
}

/**
 * The exceptional, inline source-of-progress guard (it replaces the removed consent dialog). Shown only when
 * sharing is On and this device is not yet associated with the signed-in account. The action reuses the captured
 * preview and source-key check, then publishes through the provider. Nothing here runs automatically.
 */
function DeviceProgress({
  settings,
  kept,
  disabled,
}: {
  settings: FriendSettings;
  kept: boolean;
  disabled: boolean;
}) {
  const friends = useFriends();
  const preview = friends.previewSharing(settings.n, settings.photo, settings.rev);
  const card = preview?.publication.card;
  const rank = RANKS.find((item) => item.level === card?.r);
  const summary = card
    ? `${rank ? rank.name : "No rank yet"} · ${card.s}-day streak · ${card.c} kanji carved · ${card.m} words mastered · ${card.l} lessons`
    : null;
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-sm font-medium">Your card is waiting for this device&apos;s progress.</p>
      <p className="text-xs text-muted-foreground">{DEVICE_HELP}</p>
      {kept && <p className="text-xs text-muted-foreground">{CARD_KEPT}</p>}
      {preview && card ? (
        <>
          <p className="break-words text-xs">
            {symbolLabel(card.g, preview.name)} · {preview.name}
          </p>
          <p className="break-words text-xs text-muted-foreground">{summary}</p>
          {preview.publication.photo && (
            <p className="text-xs text-muted-foreground">Your uploaded picture will be included.</p>
          )}
          <button
            type="button"
            className={primaryClass}
            disabled={disabled}
            onClick={() => {
              void friends.startSharing(preview);
            }}
          >
            Use this device&apos;s progress
          </button>
        </>
      ) : (
        <p role="status" className="text-xs text-muted-foreground">
          {DEVICE_WAIT}
        </p>
      )}
    </div>
  );
}

function FriendsSharing({
  name,
  disabled,
  friendCount,
}: {
  name: string;
  disabled: boolean;
  friendCount: number;
}) {
  const friends = useFriends();
  const { loaded, settings, card, error } = friends.sharing;
  const [photo, setPhoto] = useState(false);
  const [choice, setChoice] = useState(true); // Draft for confirmed-missing settings only.
  const [savingChoice, setSavingChoice] = useState<boolean | null>(null);
  const choiceSequence = useRef(0);
  useEffect(() => {
    setPhoto(settings?.photo ?? false);
  }, [settings?.rev, settings?.photo]);
  useEffect(() => {
    setChoice(true);
    setSavingChoice(null);
    ++choiceSequence.current;
    return () => {
      ++choiceSequence.current;
    };
  }, [friends.uid, friends.activity.deleting]);
  const clean = publicName(name, null);
  const missing = loaded && settings === null;
  const on = settings?.on === true;
  const pending =
    savingChoice !== null && !friends.activity.uncertain
      ? savingChoice
        ? "Turning sharing on…"
        : "Turning sharing off…"
      : friends.activity.busy
        ? friends.activity.uncertain
          ? "The last change may still be processing. Reconnect to check its status."
          : "Saving…"
        : friends.loading
          ? "Refreshing Friends…"
          : null;
  const waiting =
    friends.deviceProgress === "needs-device"
      ? "On · waiting for this device's progress. No card is shared yet."
      : friends.deviceProgress === "loading"
        ? "On · waiting for progress to finish loading or syncing. No card is shared yet."
        : "On · your card will be published shortly. No card is shared yet.";
  const status = !loaded
    ? "Sharing status isn't confirmed. Refresh to check your saved choice."
    : missing
      ? "Not saved yet. Nothing is shared until you save your choice."
      : !on
        ? "Off. Nothing is shared."
        : card.kind === "published"
          ? "On · accepted friends can see your card."
          : card.kind === "closed"
            ? waiting
            : "On · card status unavailable. Refresh to check it.";
  // Zero friends never disables the switch; On only means ready for people you accept.
  const showReady = (missing ? choice : on) && friendCount === 0;
  const actionError = friends.feedbackTarget === "sharing" ? friends.error : null;
  return (
    <div className="space-y-3 border-b border-border pb-5">
      <SharingChoice
        id="friends-sharing"
        checked={missing ? choice : on}
        disabled={disabled || !loaded || savingChoice !== null}
        describedBy="friends-sharing-status"
        onChange={(next) => {
          if (missing) {
            setChoice(next);
            return;
          }
          if (!settings || savingChoice !== null) return;
          const sequence = ++choiceSequence.current;
          setSavingChoice(next);
          const save = next
            ? friends.saveSharing({ on: true }, settings.rev)
            : friends.stopSharing();
          void save.finally(() => {
            if (sequence === choiceSequence.current) setSavingChoice(null);
          });
        }}
      />
      <div
        id="friends-sharing-status"
        role="status"
        className="space-y-1 text-sm text-muted-foreground"
      >
        <p>{status}</p>
        {showReady && <p>{READY_TEXT}</p>}
        {on && card.kind === "published" && <p>{friendCardAge(card.card.t)}</p>}
        {pending && <p>{pending}</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {actionError && actionError !== error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {actionError}
        </p>
      )}
      <WhatFriendsSee />
      {missing && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{MISSING_HELP}</p>
          <button
            type="button"
            className={primaryClass}
            disabled={disabled || !clean}
            onClick={() => {
              if (clean) void friends.saveSharing({ on: choice, n: clean }, null);
            }}
          >
            Save sharing choice
          </button>
        </div>
      )}
      {settings && (
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || !loaded || !clean || clean === settings.n}
          onClick={() => {
            if (clean) void friends.saveSharing({ n: clean }, settings.rev);
          }}
        >
          Save public name
        </button>
      )}
      {settings?.on && (
        <>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
              checked={photo}
              disabled={disabled || (!friends.uploadedPhotoAvailable && !photo)}
              onChange={(event) => setPhoto(event.target.checked)}
            />
            <span>Also show my uploaded picture</span>
          </label>
          <button
            type="button"
            className={buttonClass}
            disabled={disabled || !loaded || photo === settings.photo}
            onClick={() => {
              void friends.saveSharing({ photo }, settings.rev);
            }}
          >
            Save picture choice
          </button>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={disabled || !loaded || !friends.readyToUpdate}
              onClick={() => {
                void friends.updateNow();
              }}
            >
              Update now
            </button>
          </div>
          {friends.deviceProgress === "needs-device" && (
            <DeviceProgress
              settings={settings}
              kept={card.kind === "published"}
              disabled={disabled || !loaded}
            />
          )}
        </>
      )}
    </div>
  );
}
