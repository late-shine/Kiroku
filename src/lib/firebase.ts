// Phase 9a: Firebase foundation — Google sign-in, CLIENT ONLY. Phase 9b added the Realtime Database calls
// (`readCloud`, `readCloudForSync`, `writeCloud`, `deleteCloud`) at the bottom. 9c runs them automatically (app start, tab
// focus, a short while after a local change), but still one request at a time and with no realtime listeners.
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

/** `photoURL` (Phase 19a): the Google profile picture address, when Google has one. Never stored by Kiroku; used only to draw the avatar. */
export type Account = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

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

function toAccount(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}): Account {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL ?? null,
  };
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
    if (
      code === "auth/popup-blocked" ||
      code === "auth/operation-not-supported-in-this-environment"
    ) {
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

/** Friends shares the lazy SDK and current auth session; no additional auth observer. */
export async function getDb(uid: string): Promise<DbLoaded & { token: string }> {
  const { auth } = await load();
  const loaded = await loadDb();
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error("The signed-in account changed.");
  const token = await user.getIdToken();
  if (auth.currentUser?.uid !== uid) throw new Error("The signed-in account changed.");
  return { ...loaded, token };
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

async function cloudSyncUrl(uid: string): Promise<URL> {
  requireOnline();
  const { db, mod, token } = await getDb(uid);
  const url = new URL(mod.ref(db, `users/${uid}`).toString());
  url.pathname += ".json";
  url.searchParams.set("auth", token);
  return url;
}

function checkCloudResponse(response: Response): void {
  if (!response.ok) {
    throw Object.assign(new Error(`The database request failed (${response.status}).`), {
      code:
        response.status === 401 || response.status === 403
          ? "permission-denied"
          : "kiroku/sync-http-error",
    });
  }
}

/** The raw account value and its ETag from the same server read. */
export async function readCloudForSync(uid: string): Promise<{ value: unknown; etag: string }> {
  const response = await fetch(await cloudSyncUrl(uid), {
    headers: { "X-Firebase-ETag": "true" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  checkCloudResponse(response);
  const etag = response.headers.get("ETag");
  if (!etag) throw new Error("The database response did not include a sync ETag.");
  const value: unknown = await response.json();
  return { value, etag };
}

/** Replaces the account only if its ETag still matches; false means a concurrent write won. */
export async function writeCloud(
  uid: string,
  tree: Record<string, unknown>,
  etag: string,
): Promise<boolean> {
  if (!etag) throw new Error("A sync ETag is required to write.");
  const response = await fetch(await cloudSyncUrl(uid), {
    method: "PUT",
    headers: { "Content-Type": "application/json", "if-match": etag },
    body: JSON.stringify(tree),
    signal: AbortSignal.timeout(30000),
  });
  if (response.status === 412) return false;
  checkCloudResponse(response);
  return true;
}

/** Removes everything stored for this person. Nothing on this device is touched. */
const pendingCloudDeletions = new Map<string, Promise<void>>();

export async function deleteCloud(uid: string): Promise<void> {
  requireOnline();
  const { db, mod } = await loadDb();
  // A timeout does not cancel remove(). A later explicit retry joins its acknowledgement.
  let pending = pendingCloudDeletions.get(uid);
  if (!pending) {
    pending = mod.remove(mod.ref(db, `users/${uid}`));
    pendingCloudDeletions.set(uid, pending);
    const clear = () => {
      if (pendingCloudDeletions.get(uid) === pending) pendingCloudDeletions.delete(uid);
    };
    void pending.then(clear, clear);
  }
  await withTimeout(pending, 30000);
}

/** True when a sync failed only because there is no connection (the status line says "Offline", not "error"). */
export function isOfflineError(error: unknown): boolean {
  const text = (error instanceof Error ? error.message : "").toLowerCase();
  return errorCode(error) === "kiroku/offline" || text.includes("client is offline");
}

/** Short, plain messages for the Account panel. The raw error is logged by the caller. */
export function describeSyncError(error: unknown): string {
  const code = errorCode(error);
  const text = (error instanceof Error ? error.message : "").toLowerCase();
  if (code === "kiroku/offline") {
    return "You're offline. Connect and try again; nothing was changed.";
  }
  if (
    error instanceof SyncTimeoutError ||
    (error instanceof Error && error.name === "TimeoutError")
  ) {
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
