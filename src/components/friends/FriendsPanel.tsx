import { useEffect, useRef, useState } from "react";
import { useAccountSync } from "@/components/account/AccountSyncContext";
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { groupedFriendCode, INBOX_BATCH, publicName, type FriendPeer } from "@/lib/friends";
import { PROFILE_GLYPHS, initialOf } from "@/lib/profile";
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
      className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-sm overflow-y-auto rounded-xl border border-border bg-background p-5 text-foreground backdrop:bg-background/70 backdrop:backdrop-blur-sm"
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
  const consent = `Public name: ${clean ?? "Choose a name"}\nAvatar symbol: ${symbol}\n\nThis request shares your name and avatar symbol. Progress sharing stays off.`;
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

  const peerRow = (peer: FriendPeer, kind: RowKind) => (
    <li
      key={peer.uid}
      className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-border/60 py-3 last:border-0"
    >
      <div className="min-w-0">
        <p className="break-words text-sm">
          {symbolLabel(peer.glyph, peer.name)} · {peer.name}
        </p>
        {peer.state === "crossing" && (
          <p className="text-xs text-muted-foreground">You both sent a request.</p>
        )}
        {kind === "unavailable" && (
          <p className="text-xs text-muted-foreground">Not connected</p>
        )}
      </div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={`Actions for ${peer.name}`}
      >
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
              Saved Friends snapshot from {new Date(snapshot.fetchedAt).toLocaleString()}.
              Reconnect and refresh before making changes.
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
                Photos stay private.
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
                <p className="text-xs text-muted-foreground">
                  This request shares your name and avatar symbol. Progress sharing stays off.
                </p>
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
