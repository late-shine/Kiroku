import { createServerFn } from "@tanstack/react-start";
import { generateWithFallback, type GeminiResult } from "./gemini-fallback";
import { GEMINI_MODEL_CHAIN, rotateChainAfter } from "./gemini-models";

/**
 * Server-side relay for Gemini calls. Why a server function at all: it keeps the request off the
 * browser's cross-origin path and lets the fallback loop run in one place. Why it's still BYOK:
 * the user's key lives only in their browser's localStorage and arrives here per request — this
 * file must never store it, log it, or read it from anywhere else.
 *
 * `createServerFn` gets the CSRF protection installed in src/start.ts for free (that middleware is
 * filtered to `serverFn` handlers). Everything here uses Web-standard APIs only (see
 * gemini-fallback.ts), so it runs as a Vercel Function (Nitro `vercel` preset, see vite.config.ts).
 *
 * Expected failures (bad key, quota, network) come back as `{ ok: false, message }` — never
 * thrown — because src/start.ts's error middleware turns any thrown error into a generic 500 HTML
 * page, which would leave the UI with nothing useful to show.
 */

const MAX_PROMPT_CHARS = 60_000;

interface RelayInput {
  apiKey: string;
  prompt: string;
  /** "" = start at the top of the chain; otherwise resume with the model after this one ("Try another model"). */
  startAfter: string;
}

// Lenient on purpose: wrong-typed fields become "" so the handler can return a normal
// `{ ok: false }` message instead of throwing out of the validator.
function toRelayInput(raw: unknown): RelayInput {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    apiKey: typeof record["apiKey"] === "string" ? record["apiKey"] : "",
    prompt: typeof record["prompt"] === "string" ? record["prompt"] : "",
    startAfter: typeof record["startAfter"] === "string" ? record["startAfter"] : "",
  };
}

export const relayGemini = createServerFn({ method: "POST" })
  .validator(toRelayInput)
  .handler(async ({ data }): Promise<GeminiResult> => {
    if (!data.prompt.trim()) {
      return { ok: false, message: "There was nothing to send to Gemini.", attempts: [] };
    }
    if (data.prompt.length > MAX_PROMPT_CHARS) {
      return {
        ok: false,
        message: "That text is too long to send to Gemini in one go. Trim it down and try again.",
        attempts: [],
      };
    }
    return generateWithFallback(data.apiKey, data.prompt, undefined, rotateChainAfter(GEMINI_MODEL_CHAIN, data.startAfter));
  });
