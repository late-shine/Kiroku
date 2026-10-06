// Phases 9a-9c: the account body (status, sign in / sign out, sync, errors). Purely presentational: it renders what
// the shared controllers say, so the header popover and the Progress card look the same.
import { useState } from "react";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { timeAgo } from "@/lib/sync";
import type { AccountSyncValue } from "./AccountSyncContext";
import type { SyncController } from "./useSync";

const buttonClass =
  "mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50";
const linkClass = "underline underline-offset-2 hover:text-primary disabled:opacity-50";

/** The line under the email: what sync is doing right now, in plain words. */
function StatusLine({ sync }: { sync: SyncController }) {
  const ago = sync.lastSyncedAt ? timeAgo(sync.lastSyncedAt) : "";
  if (!sync.linked) {
    return <>Not synced yet. Nothing has left this device.</>;
  }
  if (!sync.auto) {
    return <>Last synced {ago}. Automatic sync is off.</>;
  }
  if (sync.status === "syncing") return <>Syncing…</>;
  if (sync.status === "offline") return <>Offline — will sync when you're back online.</>;
  if (sync.status === "error") {
    return (
      <span className="text-destructive">
        {sync.statusError ?? "Sync didn't work."}{" "}
        <button onClick={sync.retry} className={`${linkClass} text-foreground`}>
          Retry
        </button>
      </span>
    );
  }
  return <>Synced · {ago}</>;
}

export function AccountPanel({ account, sync }: AccountSyncValue) {
  const { auth, error } = account;
  const working = account.busy || sync.busy;
  const [wipe, setWipe] = useState(false);
  return (
    <>
      {auth.status === "loading" && (
        <p className="mt-2 text-xs text-muted-foreground">Checking sign-in…</p>
      )}
      {auth.status === "out" && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. Kiroku works fully without an account. Sign in to keep a copy of your lessons
            and progress in your account and carry it between devices. Nothing is sent until you
            choose how to sync the first time.
          </p>
          <button onClick={() => void account.signIn()} disabled={working} className={buttonClass}>
            <LogIn className="size-3" />
            Sign in with Google
          </button>
        </>
      )}
      {auth.status === "in" && (
        <>
          <p className="mt-2 break-all text-xs">
            Signed in as {auth.account.email ?? auth.account.displayName ?? "your Google account"}.
          </p>
          {sync.configured ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
                <StatusLine sync={sync} />
              </p>
              {sync.activity && (
                <p className="mt-1 text-[11px] text-muted-foreground">{sync.activity}</p>
              )}
              <button
                onClick={() => void sync.syncNow()}
                disabled={working}
                className={buttonClass}
              >
                <RefreshCw className={`size-3 ${sync.busy ? "animate-spin" : ""}`} />
                {sync.busy ? "Syncing…" : "Sync now"}
              </button>
              {sync.linked && (
                <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-primary"
                    checked={sync.auto}
                    onChange={(e) => sync.setAuto(e.target.checked)}
                  />
                  <span>
                    Sync automatically{" "}
                    <span className="text-muted-foreground">
                      (when you open Kiroku, come back to it, or change something)
                    </span>
                  </span>
                </label>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Syncs lessons, review progress, stars and a few display settings. Your Gemini key,
                music and voice stay on this device.
              </p>
              <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <button
                  onClick={() => void sync.chooseHow()}
                  disabled={working}
                  className={linkClass}
                >
                  Choose how to sync…
                </button>
                <button
                  onClick={sync.askDelete}
                  disabled={working}
                  className={`${linkClass} text-destructive hover:text-destructive`}
                >
                  Delete my cloud data
                </button>
              </p>
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Sync isn't set up in this build.</p>
          )}
          {sync.configured && sync.linked && (
            <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={wipe}
                onChange={(e) => setWipe(e.target.checked)}
              />
              <span>
                Also remove lessons and progress from this device{" "}
                <span className="text-muted-foreground">(for a shared computer)</span>
              </span>
            </label>
          )}
          <button
            onClick={() => (wipe && sync.linked ? sync.askWipeSignOut() : void account.signOut())}
            disabled={working}
            className={buttonClass}
          >
            <LogOut className="size-3" />
            {wipe && sync.linked ? "Sign out and remove data…" : "Sign out"}
          </button>
          {!(wipe && sync.linked) && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Signing out keeps your lessons on this device.
            </p>
          )}
        </>
      )}
      {sync.notice && auth.status === "in" && (
        <p
          role={sync.notice.kind === "error" ? "alert" : "status"}
          className={`mt-3 text-xs ${
            sync.notice.kind === "error"
              ? "text-destructive"
              : sync.notice.kind === "success"
                ? "text-success"
                : "text-muted-foreground"
          }`}
        >
          {sync.notice.text}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
