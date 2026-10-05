// Phase 9a: Firebase foundation — Google sign-in, CLIENT ONLY. Phase 9b adds the Realtime Database calls
// (`readCloud`, `writeCloud`, `deleteCloud`) at the bottom; they only run when the person presses a sync button.
//
// Kiroku renders on the server (TanStack Start), so nothing here may touch the Firebase SDK at
// import time. The SDK is loaded with dynamic `import()` inside functions that only run in the
// browser (from effects / click handlers). The `import type` lines below are erased at build time.
// Only the modular entry points are used (`firebase/app`, `firebase/auth`, `firebase/database`).
//
// The web config is public by design (it ships in the browser bundle). Security comes from the
// database rules (`firebase/database.rules.json`), never from hiding these values.
import type { FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Database } from "firebase/database";

export type Account = { uid: string; email: string | null; displayName: string | null };

type AuthModule = typeof import("firebase/auth");
type Loaded = { auth: Auth; mod: AuthModule };
type DbModule = typeof import("firebase/database");
type DbLoaded = { db: Database; mod: DbModule };

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

// ---------------------------------------------------------------------------------------------
// Phase 9b — Realtime Database. Everything for one person lives under `users/<uid>`; the shape and the
// rules that guard it are in src/lib/sync.ts and firebase/database.rules.json. Nothing here listens for
// changes: each call is one request, made when the person presses a sync / delete button.
// ---------------------------------------------------------------------------------------------

/** Sync needs the database address too. A Singapore database's URL contains its region, so it can't be guessed. */
export function isSyncConfigured(): boolean {
  return isFirebaseConfigured() && Boolean(import.meta.env.VITE_FIREBASE_DATABASE_URL);
}

let loadingDb: Promise<DbLoaded> | null = null;

function loadDb(): Promise<DbLoaded> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Firebase only runs in the browser."));
  }
  if (!isSyncConfigured()) return Promise.reject(new Error("Sync is not configured."));
  loadingDb ??= (async () => {
    await load(); // make sure the auth side is up first, so the database picks up the signed-in user
    const [appMod, mod] = await Promise.all([import("firebase/app"), import("firebase/database")]);
    const app = appMod.getApps()[0] ?? appMod.initializeApp(firebaseConfig());
    return { db: mod.getDatabase(app), mod };
  })().catch((error: unknown) => {
    loadingDb = null;
    throw error;
  });
  return loadingDb;
}

class SyncTimeoutError extends Error {
  constructor() {
    super("The request took too long.");
    this.name = "SyncTimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SyncTimeoutError()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Fail fast with a clear message instead of queueing a write that would only land later. */
function requireOnline(): void {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw Object.assign(new Error("offline"), { code: "kiroku/offline" });
  }
}

/** Everything stored for this person: the raw value, or `null` when the account is empty. */
export async function readCloud(uid: string): Promise<unknown> {
  requireOnline();
  const { db, mod } = await loadDb();
  const snap = await withTimeout(mod.get(mod.ref(db, `users/${uid}`)), 20000);
  return snap.exists() ? (snap.val() as unknown) : null;
}

/** Replaces everything stored for this person with `tree`. The caller reads first, so a failed read stops a write. */
export async function writeCloud(uid: string, tree: Record<string, unknown>): Promise<void> {
  requireOnline();
  const { db, mod } = await loadDb();
  await withTimeout(mod.set(mod.ref(db, `users/${uid}`), tree), 30000);
}

/** Removes everything stored for this person. Nothing on this device is touched. */
export async function deleteCloud(uid: string): Promise<void> {
  requireOnline();
  const { db, mod } = await loadDb();
  await withTimeout(mod.remove(mod.ref(db, `users/${uid}`)), 30000);
}

/** Short, plain messages for the Account panel. The raw error is logged by the caller. */
export function describeSyncError(error: unknown): string {
  const code = errorCode(error);
  const text = (error instanceof Error ? error.message : "").toLowerCase();
  if (code === "kiroku/offline") {
    return "You're offline. Connect and try again; nothing was changed.";
  }
  if (error instanceof SyncTimeoutError) {
    return "That took too long. Check your connection and try again; if it was an upload, Sync now again to check it went through.";
  }
  if (
    code.toLowerCase().includes("permission") ||
    text.includes("permission_denied") ||
    text.includes("permission denied")
  ) {
    return "The database refused the request. The rules in the Firebase console may not match this version of Kiroku (see firebase/database.rules.json).";
  }
  if (text.includes("client is offline")) {
    return "Couldn't reach the database. Check your connection and try again.";
  }
  if (code.startsWith("auth/")) return describeAuthError(error);
  return "Sync didn't work. Try again.";
}
