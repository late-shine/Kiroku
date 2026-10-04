// Phase 9a: one hook for the sign-in state, shared by the header button and the Progress card.
// Each caller gets its own subscription; Firebase keeps the actual session, so they always agree.
import { useEffect, useState } from "react";
import {
  describeAuthError,
  finishRedirectSignIn,
  isFirebaseConfigured,
  signInWithGoogle,
  signOutOfAccount,
  watchAccount,
  type Account,
} from "@/lib/firebase";

export type AuthState = { status: "loading" } | { status: "out" } | { status: "in"; account: Account };

export type AccountController = {
  configured: boolean;
  auth: AuthState;
  busy: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

/** `handleRedirect`: also pick up the result (or failure) of a redirect sign-in. Use it once, in the always-mounted header. */
export function useAccount({ handleRedirect = false }: { handleRedirect?: boolean } = {}): AccountController {
  const configured = isFirebaseConfigured();
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    const stop = watchAccount(
      (account) => {
        if (alive) setAuth(account ? { status: "in", account } : { status: "out" });
      },
      (message) => {
        if (!alive) return;
        setAuth({ status: "out" });
        setError(message);
      },
    );
    if (handleRedirect) {
      void finishRedirectSignIn().then((message) => {
        if (alive && message) setError(message);
      });
    }
    return () => {
      alive = false;
      stop();
    };
  }, [configured, handleRedirect]);

  const signIn = async () => {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error("[Kiroku] sign-in failed", e);
      setError(describeAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setError(null);
    setBusy(true);
    try {
      await signOutOfAccount();
    } catch (e) {
      console.error("[Kiroku] sign-out failed", e);
      setError("Couldn't sign out. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return { configured, auth, busy, error, signIn, signOut };
}
