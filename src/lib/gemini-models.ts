/**
 * Gemini fallback chain, tried in order. Store bare IDs (no "models/" prefix) — AI Studio's
 * "Get code" showed some with the prefix and some without, so `normalizeModelId()` strips it
 * and `geminiEndpoint()` builds `models/${id}:generateContent` itself.
 *
 * Free-tier limits seen on the user's dashboard: full Flash models 5 requests/min and 20/day;
 * Flash Lite 15/min and 500/day. Pro models showed 0/0, so they are intentionally not here.
 * A renamed or retired model is a one-line fix in this array.
 */
export const GEMINI_MODEL_CHAIN: readonly string[] = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite", // last resort — much higher daily quota
];

/** How long one model gets to answer before the chain moves on (also shown in the UI). */
export const GEMINI_ATTEMPT_TIMEOUT_MS = 45_000;

export function normalizeModelId(id: string): string {
  return id.trim().replace(/^models\//, "");
}

export function geminiEndpoint(modelId: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${normalizeModelId(modelId)}:generateContent`;
}

/**
 * Returns the chain reordered to start with the model *after* `modelId`, wrapping around so every
 * model is still present (the ones already tried come last). Used by "Try another model": it
 * resumes past the model that just failed instead of hitting it again. An unknown or empty
 * `modelId` returns the chain unchanged.
 */
export function rotateChainAfter(chain: readonly string[], modelId: string): string[] {
  const id = normalizeModelId(modelId);
  const i = chain.findIndex((m) => normalizeModelId(m) === id);
  if (i === -1) return [...chain];
  return [...chain.slice(i + 1), ...chain.slice(0, i + 1)];
}
