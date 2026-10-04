// Phase 9a: Firebase foundation — Google sign-in only, CLIENT ONLY, no data read or written yet.
//
// Kiroku renders on the server (TanStack Start), so nothing here may touch the Firebase SDK at
// import time. The SDK is loaded with dynamic `import()` inside functions that only run in the
// browser (from effects / click handlers). The `import type` lines below are erased at build time.
// Only the modular entry points are used (`firebase/app`, `firebase/auth`); `firebase/database`
// arrives with Phase 9b.
//
// The web config is public by design (it ships in the browser bundle). Security comes from the
// database rules (`firebase/database.rules.json`), never from hiding these values.
import type { FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";

export type Account = { uid: string; email: string | null; displayName: string | null };

type AuthModule = typeof import("firebase/auth");
type Loaded = { auth: Auth; mod: AuthModule };

/** True when the build has the Firebase web config. Without it the Account card hides itself. */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID,
  );
}

function firebaseConfig(): FirebaseOptions {
  const entries = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  };
  const config: Record<string, string> = {};
  for (const [key, value] of Object.entries(entries)) if (value) config[key] = value;
  return config as FirebaseOptions;
}

let loading: Promise<Loaded> | null = null;

function load(): Promise<Loaded> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Firebase only runs in the browser."));
  }
  if (!isFirebaseConfigured()) return Promise.reject(new Error("Firebase is not configured."));
  loading ??= (async () => {
    const [appMod, mod] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
    const app = appMod.getApps()[0] ?? appMod.initializeApp(firebaseConfig());
    return { auth: mod.getAuth(app), mod };
  })().catch((error: unknown) => {
    loading = null; // let a later click retry (e.g. after a dropped connection)
    throw error;
  });
  return loading;
}

function toAccount(user: { uid: string; email: string | null; displayName: string | null }): Account {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

/** Calls `onChange` with the signed-in account (or null) now and on every change. Returns a stop function. */
export function watchAccount(
  onChange: (account: Account | null) => void,
  onError: (message: string) => void,
): () => void {
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  load().then(
    ({ auth, mod }) => {
      if (stopped) return;
      unsubscribe = mod.onAuthStateChanged(auth, (user) => onChange(user ? toAccount(user) : null));
    },
    (error: unknown) => {
      if (!stopped) onError(describeAuthError(error));
    },
  );
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}

/**
 * Google sign-in by popup, falling back to a full-page redirect when the browser blocks popups.
 * "cancelled" = the person closed the popup (not an error). "redirecting" = the page is about to leave.
 */
export async function signInWithGoogle(): Promise<"signed-in" | "redirecting" | "cancelled"> {
  const { auth, mod } = await load();
  const provider = new mod.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await mod.signInWithPopup(auth, provider);
    return "signed-in";
  } catch (error) {
    const code = errorCode(error);
    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
      return "cancelled";
    }
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await mod.signInWithRedirect(auth, provider);
      return "redirecting";
    }
    throw error;
  }
}

/** After a redirect sign-in the page reloads; this surfaces a failed attempt (returns a message or null). */
export async function finishRedirectSignIn(): Promise<string | null> {
  try {
    const { auth, mod } = await load();
    await mod.getRedirectResult(auth);
    return null;
  } catch (error) {
    return describeAuthError(error);
  }
}

export async function signOutOfAccount(): Promise<void> {
  const { auth, mod } = await load();
  await mod.signOut(auth);
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : "";
}

/** Short, plain messages for the Account card. The raw error is logged by the caller. */
export function describeAuthError(error: unknown): string {
  switch (errorCode(error)) {
    case "auth/unauthorized-domain":
      return "This web address isn't on the Firebase authorized-domains list yet.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't turned on for this Firebase project.";
    case "auth/network-request-failed":
      return "Couldn't reach Google. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/user-disabled":
      return "This account has been disabled.";
    default:
      return "Sign-in didn't work. Try again.";
  }
}
