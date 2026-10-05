// Phase 9a/9b: the account body (status, sign in / sign out, sync, errors). Purely presentational: it renders what
// the shared controllers say, so the header popover and the Progress card look the same.
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { timeAgo } from "@/lib/sync";
import type { AccountSyncValue } from "./AccountSyncContext";

const buttonClass =
  "mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50";
const linkClass = "underline underline-offset-2 hover:text-primary disabled:opacity-50";

export function AccountPanel({ account, sync }: AccountSyncValue) {
  const { auth, error } = account;
  const working = account.busy || sync.busy;
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
            press Sync now.
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
              <p className="mt-1 text-xs text-muted-foreground">
                {sync.lastSyncedAt
                  ? `Last synced ${timeAgo(sync.lastSyncedAt)}.`
                  : "Not synced yet. Nothing has left this device."}
              </p>
              <button
                onClick={() => void sync.syncNow()}
                disabled={working}
                className={buttonClass}
              >
                <RefreshCw className={`size-3 ${sync.busy ? "animate-spin" : ""}`} />
                {sync.busy ? "Syncing…" : "Sync now"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Syncs lessons, review progress and stars. Your Gemini key and other settings stay on
                this device.
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
          <button onClick={() => void account.signOut()} disabled={working} className={buttonClass}>
            <LogOut className="size-3" />
            Sign out
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Signing out keeps your lessons on this device.
          </p>
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
