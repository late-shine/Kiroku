import { createServerFn } from "@tanstack/react-start";
import { generateWithFallback, type GeminiAttempt, type GeminiResult } from "./gemini-fallback";
import {
  GEMINI_ATTEMPT_TIMEOUT_MS,
  GEMINI_MODEL_CHAIN,
  VISION_MODEL_CHAIN,
  rotateChainAfter,
} from "./gemini-models";
import {
  VISION_RELAY_MAX_BASE64_CHARS,
  buildVisionPrompt,
  isVisionCount,
  parseVisionReply,
  type VisionItem,
  type VisionKind,
} from "./gemini-vision";

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

interface VisionRelayInput {
  apiKey: string;
  count: number;
  image: { mime: string; base64: string };
}

export type RelayGeminiVisionResult =
  | {
      ok: true;
      kind: VisionKind;
      items: VisionItem[];
      model: string;
      attempts: GeminiAttempt[];
    }
  | { ok: false; message: string; attempts: GeminiAttempt[] };

function toVisionRelayInput(raw: unknown): VisionRelayInput {
  const record = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const image =
    typeof record["image"] === "object" && record["image"] !== null
      ? (record["image"] as Record<string, unknown>)
      : {};
  return {
    apiKey: typeof record["apiKey"] === "string" ? record["apiKey"] : "",
    count: typeof record["count"] === "number" ? record["count"] : 0,
    image: {
      mime: typeof image["mime"] === "string" ? image["mime"] : "",
      base64: typeof image["base64"] === "string" ? image["base64"] : "",
    },
  };
}

function isBase64(value: string): boolean {
  return value.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

export const relayGeminiVision = createServerFn({ method: "POST" })
  .validator(toVisionRelayInput)
  .handler(async ({ data }): Promise<RelayGeminiVisionResult> => {
    if (!isVisionCount(data.count)) {
      return { ok: false, message: "A photo check needs a page of 1 to 5 answers.", attempts: [] };
    }
    if (data.image.mime !== "image/jpeg" || !isBase64(data.image.base64)) {
      return { ok: false, message: "That photo couldn't be sent. Try another one.", attempts: [] };
    }
    if (data.image.base64.length > VISION_RELAY_MAX_BASE64_CHARS) {
      return {
        ok: false,
        message: "That photo is too detailed to shrink. Try a closer, plainer shot.",
        attempts: [],
      };
    }
    const result = await generateWithFallback(
      data.apiKey,
      buildVisionPrompt(data.count),
      undefined,
      VISION_MODEL_CHAIN,
      GEMINI_ATTEMPT_TIMEOUT_MS,
      {
        image: { mime: "image/jpeg", base64: data.image.base64 },
        thinkingLevel: "medium",
        moveOnNotFound: true,
      },
    );
    if (!result.ok) return result;
    const parsed = parseVisionReply(result.text);
    return {
      ok: true,
      kind: parsed?.kind ?? "unreadable",
      items: parsed?.items ?? [],
      model: result.model,
      attempts: result.attempts,
    };
  });
