// Phase 9a: the account body (status, sign in / sign out, errors). Purely presentational: it renders
// whatever the `useAccount` controller says, so the header popover and the Progress card look the same.
import { LogIn, LogOut } from "lucide-react";
import type { AccountController } from "./useAccount";

const buttonClass =
  "mt-3 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs disabled:opacity-50";

export function AccountPanel({ account }: { account: AccountController }) {
  const { auth, busy, error } = account;
  return (
    <>
      {auth.status === "loading" && (
        <p className="mt-2 text-xs text-muted-foreground">Checking sign-in…</p>
      )}
      {auth.status === "out" && (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            Optional. Kiroku works fully without an account, and nothing is sent anywhere yet.
          </p>
          <button onClick={() => void account.signIn()} disabled={busy} className={buttonClass}>
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
          <p className="mt-1 text-xs text-muted-foreground">
            Sync isn't on yet. Your lessons and progress stay on this device.
          </p>
          <button onClick={() => void account.signOut()} disabled={busy} className={buttonClass}>
            <LogOut className="size-3" />
            Sign out
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
