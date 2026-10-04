import { GEMINI_ATTEMPT_TIMEOUT_MS, GEMINI_MODEL_CHAIN, geminiEndpoint, normalizeModelId } from "./gemini-models";

/**
 * The Gemini call + model-fallback loop. Deliberately free of framework imports and of any
 * hardcoded global `fetch`: the fetch implementation is injectable so this can be tested with
 * a fake (429, 429, then 200) without a network, and it only uses Web-standard APIs so it runs
 * on both build targets (Cloudflare Workers / Vercel Functions).
 *
 * Rules (from PLAN.md Phase 3c):
 * - Advance to the next model ONLY on HTTP 429 (quota / rate limit) or 503 (that model is
 *   overloaded — a per-model condition, so a different model will very likely answer). This
 *   widens PLAN.md's original "429 only" rule after a real 503 on gemini-3.8-flash.
 * - A model that doesn't answer within the per-attempt timeout is skipped too (it was hanging).
 * - 400/401/403 (bad request / bad key) stop immediately with a plain-language message.
 * - Any other failure also stops with a clear message — a different model can't fix it.
 * - The API key goes in the `x-goog-api-key` header (never the URL) and is never logged or stored.
 */

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type AttemptOutcome = "ok" | "rate-limited" | "overloaded" | "timed-out" | "failed";

export interface GeminiAttempt {
  model: string;
  outcome: AttemptOutcome;
  /** HTTP status, or null when no response was received (network error). */
  status: number | null;
}

export type GeminiResult =
  | { ok: true; text: string; model: string; attempts: GeminiAttempt[] }
  | { ok: false; message: string; attempts: GeminiAttempt[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Pulls a short human-readable detail out of a Google error body, without ever echoing the key. */
function errorDetail(bodyText: string, apiKey: string): string {
  let detail = "";
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (isRecord(parsed) && isRecord(parsed["error"]) && typeof parsed["error"]["message"] === "string") {
      detail = parsed["error"]["message"];
    }
  } catch {
    /* body wasn't JSON — no detail */
  }
  if (apiKey) detail = detail.split(apiKey).join("[key]");
  return detail.slice(0, 200);
}

interface ExtractedReply {
  text: string;
  finishReason: string | null;
  blockReason: string | null;
}

function extractReply(body: unknown): ExtractedReply {
  const empty: ExtractedReply = { text: "", finishReason: null, blockReason: null };
  if (!isRecord(body)) return empty;

  const feedback = body["promptFeedback"];
  const blockReason = isRecord(feedback) && typeof feedback["blockReason"] === "string" ? feedback["blockReason"] : null;

  const candidates = body["candidates"];
  const first: unknown = Array.isArray(candidates) ? candidates[0] : undefined;
  if (!isRecord(first)) return { ...empty, blockReason };

  const finishReason = typeof first["finishReason"] === "string" ? first["finishReason"] : null;
  const content = first["content"];
  const parts = isRecord(content) && Array.isArray(content["parts"]) ? content["parts"] : [];
  const text = parts
    .filter((p): p is Record<string, unknown> => isRecord(p) && typeof p["text"] === "string" && p["thought"] !== true)
    .map((p) => String(p["text"]))
    .join("");

  return { text, finishReason, blockReason };
}

function failureMessage(status: number, model: string, detail: string): string {
  const suffix = detail ? ` (Google said: ${detail})` : "";
  if (status === 401 || status === 403) {
    return `Gemini rejected the API key (${status}). Check that you pasted the whole key and that it's enabled for the Gemini API.${suffix}`;
  }
  if (status === 400) {
    return `Gemini rejected the request (400) — this usually means the API key is invalid or malformed. Check it and try again.${suffix}`;
  }
  if (status === 404) {
    return `Gemini says the model "${model}" wasn't found (404). It may have been renamed or retired — the list lives in src/lib/gemini-models.ts.${suffix}`;
  }
  return `Gemini returned an error (${status}) on ${model}.${suffix}`;
}

type AttemptStep = { kind: "next"; attempt: GeminiAttempt } | { kind: "done"; result: GeminiResult };

/** One model, one call. Never throws; tells the loop whether to move on or stop. */
async function attemptModel(
  key: string,
  model: string,
  body: string,
  fetchImpl: FetchLike,
  attempts: GeminiAttempt[],
  signal: AbortSignal,
): Promise<AttemptStep> {
  const stop = (message: string, attempt: GeminiAttempt): AttemptStep => ({
    kind: "done",
    result: { ok: false, message, attempts: [...attempts, attempt] },
  });

  let res: Response;
  try {
    res = await fetchImpl(geminiEndpoint(model), {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body,
      signal,
    });
  } catch {
    return stop("Couldn't reach Gemini — check your internet connection and try again.", { model, outcome: "failed", status: null });
  }

  if (res.status === 429 || res.status === 503) {
    return { kind: "next", attempt: { model, outcome: res.status === 429 ? "rate-limited" : "overloaded", status: res.status } };
  }

  if (!res.ok) {
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      /* unreadable body — message falls back to the status alone */
    }
    return stop(failureMessage(res.status, model, errorDetail(bodyText, key)), { model, outcome: "failed", status: res.status });
  }

  let parsedBody: unknown;
  try {
    parsedBody = await res.json();
  } catch {
    return stop(`Gemini's reply on ${model} couldn't be read. Try again.`, { model, outcome: "failed", status: res.status });
  }

  const reply = extractReply(parsedBody);
  if (!reply.text.trim()) {
    const why = reply.blockReason ? ` It was blocked (${reply.blockReason}).` : "";
    return stop(`Gemini returned an empty reply on ${model}.${why}`, { model, outcome: "failed", status: res.status });
  }
  if (reply.finishReason === "MAX_TOKENS") {
    return stop(`Gemini's reply on ${model} was cut off before it finished. Try again.`, { model, outcome: "failed", status: res.status });
  }

  return { kind: "done", result: { ok: true, text: reply.text, model, attempts: [...attempts, { model, outcome: "ok", status: res.status }] } };
}

/**
 * Sends `prompt` to Gemini, walking `models` in order but only moving on when a model returns 429,
 * 503, or doesn't answer within `timeoutMs` (a hung connection used to spin forever).
 * Never throws for expected failures — it returns `{ ok: false, message }` instead, so callers
 * (including the server-function relay, whose thrown errors would become a generic 500 page)
 * can always show a plain-language message.
 */
export async function generateWithFallback(
  apiKey: string,
  prompt: string,
  fetchImpl: FetchLike = (input, init) => fetch(input, init),
  models: readonly string[] = GEMINI_MODEL_CHAIN,
  timeoutMs: number = GEMINI_ATTEMPT_TIMEOUT_MS,
): Promise<GeminiResult> {
  const attempts: GeminiAttempt[] = [];
  const key = apiKey.trim();

  if (!key) return { ok: false, message: "Add your Gemini API key first.", attempts };
  if (models.length === 0) return { ok: false, message: "No Gemini models are configured.", attempts };

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // Worth trying per the plan; whatever comes back still goes through parseLessonFromText and the
    // preview card — nothing is ever saved straight from an API response.
    generationConfig: { responseMimeType: "application/json" },
  });

  for (const rawId of models) {
    const model = normalizeModelId(rawId);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Race against a timer as well as aborting, so a fetch that ignores `signal` can't hang the loop.
    const timeout = new Promise<"timeout">((resolve) => {
      timer = setTimeout(() => {
        resolve("timeout"); // settle the race first, then abort (so the abort error can't win it)
        controller.abort();
      }, timeoutMs);
    });

    const step = await Promise.race([attemptModel(key, model, body, fetchImpl, attempts, controller.signal), timeout]);
    clearTimeout(timer);

    if (step === "timeout") {
      attempts.push({ model, outcome: "timed-out", status: null });
      continue;
    }
    if (step.kind === "done") return step.result;
    attempts.push(step.attempt);
  }

  const allTimedOut = attempts.every((a) => a.outcome === "timed-out");
  return {
    ok: false,
    message: allTimedOut
      ? "Gemini didn't answer in time on any model. It may be having a slow spell — try again in a bit, or use the manual copy/paste flow."
      : "Every Gemini model in the fallback chain is busy, slow or out of quota right now (free tier: about 20 requests/day on the full Flash models, 500/day on Flash Lite). Try again in a bit, or use the manual copy/paste flow.",
    attempts,
  };
}

/**
 * The repair/save prompts tell Gemini to answer `{"error": "..."}` when the source text genuinely
 * doesn't contain a usable lesson (so it never invents one). Returns that message, or null when
 * the reply is a normal lesson object.
 */
export function readGeminiRefusal(text: string): string | null {
  try {
    const parsed: unknown = JSON.parse(text);
    if (isRecord(parsed) && typeof parsed["error"] === "string" && !("dayNumber" in parsed)) {
      return parsed["error"];
    }
  } catch {
    /* not JSON — treat as a normal reply */
  }
  return null;
}
