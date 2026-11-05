import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import {
  groupedFriendCode,
  INBOX_BATCH,
  publicName,
  friendCardAge,
  type FriendPeer,
  type FriendCard,
} from "@/lib/friends";
import { PROFILE_GLYPHS, initialOf } from "@/lib/profile";
import { BADGES, RANKS } from "@/lib/rewards";
import { useFriends } from "./useFriends";

const buttonClass =
  "min-h-11 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50";
const primaryClass = `${buttonClass} bg-primary text-primary-foreground`;
const inputClass =
  "min-h-11 w-full min-w-0 rounded-md border border-border bg-background/70 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
type Confirmation = { title: string; body: string; label: string; run: () => void };
type RowKind = "incoming" | "outgoing" | "final" | "unavailable";

function FriendsConfirmation({
  confirmation,
  onClose,
  children,
  cancelLabel = "Cancel",
  disabled = false,
}: {
  confirmation: Confirmation;
  onClose: () => void;
  children?: ReactNode;
  cancelLabel?: string;
  disabled?: boolean;
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
      {children}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" autoFocus className={buttonClass} onClick={onClose}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={primaryClass}
          disabled={disabled}
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

export function FriendsPanel() {
  const friends = useFriends();
  const { sync } = useAccountSync();
  const [settingUp, setSettingUp] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [batch, setBatch] = useState(INBOX_BATCH);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameDraft(null);
    setSettingUp(false);
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
    setConfirmation(null);
    setCopyNotice(null);
  }, [friends.activity.deleting]);

  useEffect(() => {
    void friends.refresh(); // Opening Profile refreshes; background focus reads are throttled.
  }, [friends.refresh]);

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
  const chosenName = nameDraft ?? friends.suggestedName;
  const clean = publicName(chosenName, null);
  const identity = { n: clean ?? "", g: friends.glyph };
  const symbol = symbolLabel(friends.glyph, chosenName);
  const requestDisclosure = !friends.sharing.loaded
    ? "This request shares your name and avatar symbol. Your saved sharing choice controls progress sharing."
    : friends.sharing.settings?.on
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
    try {
      await navigator.clipboard.writeText(
        invite ? `${location.origin}/#friend=${ownCode}` : groupedFriendCode(ownCode),
      );
      setCopyNotice(invite ? "Invite link copied." : "Friend code copied.");
    } catch {
      setCopyNotice("Couldn't copy. Select your friend code and copy it manually.");
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

  const confirmSetup = () => {
    setConfirmation({
      title: "Set up friends?",
      body: `Public name: ${clean}\nAvatar symbol: ${symbol}\n\nCreate a friend code for people you know. Progress sharing stays off.`,
      label: "Create friend code",
      run: () => {
        void friends.setup(identity);
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
          <p className="break-words text-sm">
            {symbolLabel(card?.g ?? peer.glyph, card?.n ?? peer.name)} · {card?.n ?? peer.name}
          </p>
          {peer.state === "crossing" && (
            <p className="text-xs text-muted-foreground">You both sent a request.</p>
          )}
          {kind === "unavailable" && <p className="text-xs text-muted-foreground">Not connected</p>}
          {kind === "final" && <PlainFriendCard peer={peer} />}
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
      className="glass-panel min-w-0 rounded-xl p-5 md:p-6"
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
      <div
        aria-live="polite"
        role="status"
        className="mt-3 space-y-2 text-sm text-muted-foreground"
      >
        {friends.loading && <p>Loading Friends…</p>}
        {friends.activity.busy && (
          <p>
            {friends.activity.uncertain
              ? "The request may still be processing. Reconnect to check its status."
              : "Saving Friends…"}
          </p>
        )}
        {friends.activity.outcome && <p>{friends.activity.outcome}</p>}
        {friends.notice && <p>{friends.notice}</p>}
        {copyNotice && <p>{copyNotice}</p>}
      </div>
      {friends.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {friends.error}
        </p>
      )}
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
              <p className="break-words text-sm text-muted-foreground">
                Avatar symbol: {symbol}. To change it, choose a symbol in your profile above.
                Picture sharing is controlled below.
              </p>
              {!clean && (
                <p className="text-sm text-muted-foreground">Enter a name to use Friends.</p>
              )}
              {!snapshot?.own && (
                <button
                  type="button"
                  className={primaryClass}
                  disabled={disabled || !clean}
                  onClick={confirmSetup}
                >
                  Create friend code
                </button>
              )}
            </div>
          )}
          {snapshot?.own && !snapshot.cached && (
            <div className="mt-5 space-y-4 border-t border-border pt-4">
              <FriendsSharing name={chosenName} disabled={disabled} />
              <div>
                <p className="text-sm text-muted-foreground">Your friend code</p>
                <p
                  className="mt-2 select-all break-all font-mono text-xl tracking-wider"
                  aria-label={`Friend code: ${snapshot.own.code.slice(0, 5)}, ${snapshot.own.code.slice(5)}`}
                >
                  {groupedFriendCode(snapshot.own.code)}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={disabled}
                    onClick={() => {
                      void copy(false);
                    }}
                  >
                    Copy code
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={disabled}
                    onClick={() => {
                      void copy(true);
                    }}
                  >
                    Copy invite link
                  </button>
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={disabled}
                    onClick={confirmRotation}
                  >
                    Change code
                  </button>
                </div>
              </div>
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (disabled || !clean) return;
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
                <label className="block space-y-2 text-sm">
                  <span>Add someone by code</span>
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
                  />
                </label>
                <p className="text-xs text-muted-foreground">{requestDisclosure}</p>
                <button
                  type="submit"
                  className={primaryClass}
                  disabled={disabled || !clean || !code.trim()}
                >
                  Review request
                </button>
              </form>
            </div>
          )}
          {snapshot && (snapshot.own || snapshot.cached) && (
            <div className="mt-5 grid min-w-0 gap-5 border-t border-border pt-4 xl:grid-cols-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Incoming requests</h3>
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
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Blocked people</h3>
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
        Accent: {card.acc}. Stamp: {card.st}. Frame: {card.fr}. Effect: {card.fx}.
      </p>
      <p>
        Banner: {card.bk === undefined ? "Flat" : `Scene ${card.bk + 1}`}. Study tag:{" "}
        {card.tg ?? "None"}. Status: {card.sb ?? "None"}.
      </p>
      <p>Sharing since {card.sh}.</p>
    </div>
  );
}

function PlainFriendCard({ peer }: { peer: FriendPeer }) {
  const friends = useFriends();
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
      <PublicSummary card={card} />
    </div>
  );
}

const SHARING_COPY =
  "Friends you accept can see your chosen name and avatar symbol, rank, streak, kanji carved, words mastered, lesson and taught-kanji counts, vocabulary count, your last 7 days of answers and writing marks, earned badges and selected decorations, study tag and status. They never see your email, lesson text, word lists or Gemini key.";

function SharingConsent({
  initialName,
  revision,
  onClose,
}: {
  initialName: string;
  revision: string | null;
  onClose: () => void;
}) {
  const friends = useFriends();
  const [name, setName] = useState(initialName);
  const [photo, setPhoto] = useState(
    Boolean(
      friends.sharing.settings?.on &&
      friends.sharing.settings.photo &&
      friends.uploadedPhotoAvailable,
    ),
  );
  const preview = friends.previewSharing(name, photo, revision);
  return (
    <FriendsConfirmation
      confirmation={{
        title: "Share with friends?",
        body: SHARING_COPY,
        label: "Start sharing",
        run: () => {
          if (preview) void friends.startSharing(preview);
        },
      }}
      onClose={onClose}
      cancelLabel="Not now"
      disabled={!preview || friends.activity.busy || friends.activity.deleting}
    >
      <div className="mt-4 space-y-4">
        <label className="block space-y-2 text-sm">
          <span>Public name</span>
          <input
            autoComplete="off"
            maxLength={24}
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
            checked={photo}
            disabled={!friends.uploadedPhotoAvailable && !photo}
            onChange={(event) => setPhoto(event.target.checked)}
          />
          <span>Also show my uploaded picture</span>
        </label>
        {!friends.uploadedPhotoAvailable && (
          <p className="text-xs text-muted-foreground">
            Upload a picture in your profile to include it. Your Google picture is never shared.
          </p>
        )}
        {preview ? (
          <div className="border-t border-border pt-4">
            <p className="break-words text-sm font-medium">
              {symbolLabel(preview.publication.card.g, preview.name)} · {preview.name}
            </p>
            {preview.publication.photo && (
              <img
                className="mt-3 size-16 rounded-md object-cover"
                src={preview.publication.photo.data}
                alt="Your uploaded picture in the sharing preview"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              This is the progress on this device that you are confirming for this account.
            </p>
            <PublicSummary card={preview.publication.card} />
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Wait for progress to finish loading or syncing. If sharing settings changed, close this
            preview and review them again.
          </p>
        )}
      </div>
    </FriendsConfirmation>
  );
}

function FriendsSharing({ name, disabled }: { name: string; disabled: boolean }) {
  const friends = useFriends();
  const { loaded, settings, card, error } = friends.sharing;
  const [consent, setConsent] = useState<{ revision: string | null } | null>(null);
  const [photo, setPhoto] = useState(false);
  useEffect(() => {
    setPhoto(settings?.photo ?? false);
  }, [settings?.rev, settings?.photo]);
  useEffect(() => {
    setConsent(null);
  }, [friends.uid, friends.activity.deleting]);
  const clean = publicName(name, null);
  return (
    <div className="space-y-3 border-b border-border pb-5">
      <h3 className="text-sm font-semibold">Share with friends</h3>
      <p className="text-sm text-muted-foreground">
        {loaded
          ? settings?.on
            ? "Sharing is on."
            : "Sharing is off."
          : "Sharing status is not confirmed. Refresh to check your saved choice."}
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          role="switch"
          className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
          checked={settings?.on ?? false}
          disabled={disabled || !loaded}
          onChange={(event) => {
            if (event.target.checked) setConsent({ revision: settings?.rev ?? null });
            else void friends.stopSharing();
          }}
        />
        <span>Share with friends</span>
      </label>
      <button
        type="button"
        className={buttonClass}
        disabled={disabled || !loaded || !clean || clean === settings?.n}
        onClick={() => {
          if (clean) void friends.saveSharing({ n: clean }, settings?.rev ?? null);
        }}
      >
        Save public name
      </button>
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
            {!friends.readyToUpdate && (
              <button
                type="button"
                className={buttonClass}
                disabled={disabled || !loaded}
                onClick={() => setConsent({ revision: settings.rev })}
              >
                Review this device
              </button>
            )}
          </div>
          {!friends.readyToUpdate && (
            <p className="text-xs text-muted-foreground">
              Your published card is kept until this device&apos;s progress is ready. Sync this
              account, or review this device to confirm its progress.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {card.kind === "published"
              ? friendCardAge(card.card.t)
              : card.kind === "closed"
                ? "No card is published. Update it when your progress is ready."
                : "Publication status unavailable. Refresh to check it."}
          </p>
        </>
      )}
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2 focus-visible:outline-ring">
          What friends see
        </summary>
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>{SHARING_COPY}</p>
          <p>Stats and unlocks are self-reported, not verified achievements.</p>
          <p>
            Turning sharing off prevents new reads after it is saved. Copies already seen on another
            device may remain there until refreshed.
          </p>
          <p>Signing out doesn&apos;t hide your card. Turn sharing off first.</p>
        </div>
      </details>
      {consent && (
        <SharingConsent
          initialName={name}
          revision={consent.revision}
          onClose={() => setConsent(null)}
        />
      )}
    </div>
  );
}
