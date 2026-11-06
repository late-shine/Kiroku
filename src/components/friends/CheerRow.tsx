import { useEffect, useRef } from "react";
import { CHEERS } from "@/lib/friends";
import { useFriends } from "./useFriends";
import { friendButton, focusRing } from "./friends-ui";

/** One selected mutual pair; slot reads and daily/seen metadata belong to the provider. */
export function CheerRow({
  peer,
  name,
  today,
  offline,
}: {
  peer: string;
  name: string;
  today: string;
  offline: boolean;
}) {
  const friends = useFriends();
  const methods = useRef(friends);
  methods.current = friends;
  const status = friends.cheerFor(peer);
  const incoming = status.incoming;
  const receivedAt = incoming?.t;
  const phrase = incoming ? CHEERS.find((cheer) => cheer.id === incoming.k) : null;
  useEffect(() => {
    methods.current.openCheerPane(peer);
    return () => methods.current.closeCheerPane(peer);
  }, [friends.uid, peer]);
  useEffect(() => {
    const mark = () => {
      if (
        receivedAt !== undefined &&
        !status.cached &&
        !offline &&
        document.visibilityState === "visible"
      )
        methods.current.markCheerSeen(peer, receivedAt);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [peer, receivedAt, status.cached, offline]);
  const busy = friends.activity.busy || friends.activity.deleting;
  return (
    <section
      className="mt-4 space-y-3 border-t border-border pt-4"
      aria-label={`Cheers with ${name}`}
    >
      <h3 className="font-display text-sm">Send a cheer</h3>
      {incoming && phrase && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            {status.cached || offline ? "Last-known cheer from" : "A cheer from"} {name}
          </p>
          <p className="mt-2 text-sm">
            <span lang="ja">{phrase.japanese}</span> · {phrase.gloss}
          </p>
          <button
            type="button"
            className={`${friendButton} mt-2`}
            disabled={busy || offline || status.cached}
            onClick={() => void friends.clearCheer(peer)}
          >
            Clear<span className="sr-only"> received cheer from {name}</span>
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Preset cheers for ${name}`}>
        {CHEERS.map((cheer) => {
          const chosen = status.sentKind === cheer.id;
          return (
            <button
              key={cheer.id}
              type="button"
              disabled={busy || offline || !status.canSend}
              className={`min-h-11 rounded-full border px-3 py-1.5 text-xs transition-colors duration-200 motion-reduce:transition-none disabled:opacity-60 ${focusRing} ${chosen ? "border-primary/60 bg-primary/10" : "border-border"}`}
              onClick={() => void friends.sendCheer(peer, cheer.id)}
            >
              <span lang="ja">{cheer.japanese}</span>
              <span className="block text-[10px] text-muted-foreground">{cheer.gloss}</span>
              {chosen && (
                <span className="mt-1 block font-medium text-primary">
                  {status.sentDay === today ? "Sent today" : "Recorded for a later day"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {status.sentDay && status.sentDay > today && (
        <p className="text-xs text-muted-foreground">
          A cheer is recorded for {status.sentDay}. Sending stays paused until after that local day.
        </p>
      )}
      <div className="space-y-1 text-xs text-muted-foreground" role="status" aria-live="polite">
        {status.loading && <p>Loading cheer status. Last-known indicators are kept.</p>}
        {status.error && <p>{status.error}</p>}
        {!status.loaded && !status.loading && !status.error && (
          <p>Refresh cheer status before sending.</p>
        )}
        {offline && <p>You're offline. Try again when you're back.</p>}
        {friends.activity.uncertain && (
          <p>The send may still be processing. Wait for its result before trying again.</p>
        )}
      </div>
      {(status.error || (!status.loaded && !status.loading)) && (
        <button
          type="button"
          className={friendButton}
          disabled={busy || offline || status.loading}
          onClick={() => void friends.refreshCheerPane(peer)}
        >
          Refresh cheer status
        </button>
      )}
      <p className="text-[10px] text-muted-foreground">
        This device keeps one cheer per friend per local day. A new cheer replaces the previous one.
      </p>
    </section>
  );
}
