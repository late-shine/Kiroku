// Phase 9a: names of the Firebase web-config variables (all public by design; see .env.example).
// Declared here so `import.meta.env.VITE_FIREBASE_*` type-checks under noPropertyAccessFromIndexSignature.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
}
