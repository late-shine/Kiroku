# Handoff — Phase 3c: Gemini API smart import (repair + Save-only automation)
Date: 2026-09-28

## Summary
Added one Gemini-backed call with two optional entry points in the AI Lesson Studio: **"Fix with
Gemini"** (Import step, shown only after a failed parse) and **"Save with Gemini"** (Copy step,
`save-only` mode only). Both send a prompt through a new TanStack Start server function that walks
a 5-model fallback chain (advancing on HTTP 429, and — after the follow-up below — 503), and both feed the reply through the existing
`parseLessonFromText` → preview card → explicit Save flow. Manual copy/paste is untouched and needs
no key. No "teach it all for me" Generate button, per the plan.

**Follow-up (same day, after the user's first real test):** the first real call returned a 503 ("this
model is currently experiencing high demand") from `gemini-3.8-flash` and just stopped. Two changes:
the chain now also auto-advances on 503, and a "Try another model" button appears when the chain
still ends in a retryable failure. See "Deviation from PLAN.md" below.

**Follow-up 2 (second real test):** the spinner ran indefinitely — there was no timeout on the Google
call, so a model that held the connection open hung the whole chain, and removing the key mid-request
did nothing (the request was already in flight). Fixed with a per-model timeout (45s,
`GEMINI_ATTEMPT_TIMEOUT_MS`; a timed-out model is skipped like a 503) and a **Cancel** button. Also,
the dev server warned `createServerFn().inputValidator() is deprecated. Use .validator()` — switched
to `.validator()`.

## Files added
- `src/lib/gemini-models.ts`: `GEMINI_MODEL_CHAIN` (bare IDs, 3.8-flash → 3.7 → 3.6 → 3.5 →
  3.1-flash-lite), `normalizeModelId()` (strips a leading `models/`), `geminiEndpoint()`, and
  `rotateChainAfter(chain, modelId)` (chain reordered to start after that model, wrapping around),
  and `GEMINI_ATTEMPT_TIMEOUT_MS`.
- `src/lib/gemini-fallback.ts`: `generateWithFallback(apiKey, prompt, fetchImpl?, models?)`. Pure,
  Web-standard only, **fetch is an injectable parameter**. **429, 503, or a per-model timeout** → next model; 400/401/403/
  404/other 5xx/network/empty/`MAX_TOKENS` → stop with a plain-language message. Returns `{ok, text, model,
  attempts}` or `{ok:false, message, attempts}`; never throws for expected failures. Key goes in the
  `x-goog-api-key` header only, and is scrubbed from any echoed Google error text. Also exports
  `readGeminiRefusal(text)`.
- `src/lib/gemini-relay.ts`: `relayGemini`, a `createServerFn({ method: "POST" })` with a lenient
  `.inputValidator` (`{apiKey, prompt, startAfter}`; `startAfter` is a required string, `""` = start of
  chain) and a handler that calls `generateWithFallback` with `rotateChainAfter(chain, startAfter)`. Doesn't store or log the key.
  Returns failures as data (a thrown error would hit `start.ts`'s error middleware and become a
  generic 500 HTML page).
- `handoffs/phase-3c.md`: this file.

## Files changed
- `src/lib/prompt-builder.ts`: new exported `buildRepairPrompt(day, vocabCount, failedText, errors)`,
  reusing the private `schemaAndExampleBlock()`. `buildSaveOnlyPrompt` unchanged and reused as-is.
- `src/components/ai/LessonStudio.tsx`: key field (`GeminiKeyPanel`), status/trail display
  (`GeminiStatus`), "Save with Gemini" block in the Copy step (save-only), "Fix with Gemini" block in
  the Import step's failure state, a "Built by Gemini" note on the preview card, and the handlers
  (`runGemini`, `applyGeminiText`, `fixWithGemini`, `saveWithGemini`). Follow-up: `lastGeminiAction`
  state, a `GeminiRetry` prop on `GeminiStatus`, and the "Having trouble? Try <next model>" button
  (refresh icon). `fixWithGemini`/`saveWithGemini` take a `startAfter = ""` parameter.

## Data/schema changes
- New `localStorage` key `komorebi_gemini_key_v1` holding the raw key string. Separate from
  `komorebi_ai_studio_v1` on purpose. **Not** in the export file (export is still `{lessons, progress}`).
  Phase 4's rebrand migration list needs this key added.
- No change to `DayLesson`, the zod schema, or any existing key.

## Behavior changes
- Copy step, `save-only` only: "Save with Gemini" (disabled until a key is saved **and** the
  "Existing lesson text" box from step 1 is non-empty — it never uses the "our conversation above"
  branch, per context.md's save-only rule). On success it jumps to Import with the preview showing.
- Import step, after a failed parse: "Fix with Gemini". Uses the Day / vocab count chosen in step 1.
- **Both put Gemini's JSON into the Import textarea** (replacing what was there) so errors, re-fixing
  and editing all use the normal path. The preview card says it was built by Gemini.
- If the source text genuinely doesn't contain a usable lesson (or a required part like "≥3 examples"
  can't be produced without inventing it), the prompts tell Gemini to answer `{"error": "..."}`; the
  UI shows that as "Gemini couldn't build a lesson from that text: …" instead of a fabricated lesson.
  This is a judgment call: some "fixable by inventing" failures will now be refused rather than patched.
- The "Tried: model (busy) → model (rate-limited) → model (worked)" trail shows under the button
  (outcomes: worked / rate-limited (429) / busy (503) / failed).
- **"Try another model" button** (in both the Copy-step and Import-step status areas): appears after a
  failed run whose last attempt was a retryable failure, i.e. not a bad key (400/401/403), not a network
  error, and not a successful reply Gemini declined to convert. Label shows the model it will start
  with, e.g. "Having trouble? Try gemini-3.7-flash". It re-runs whichever action ran last (fix or save)
  starting *after* the model that just failed, then wraps around the chain.
- The "every model failed" message now reads "busy, slow or out of quota" (or "didn't answer in time
  on any model" if every attempt timed out).
- **Per-model timeout (45s):** a model that doesn't answer is recorded as `timed-out` (trail label "no
  answer") and the chain moves on. Worst case for a fully hung chain is ~5 × 45s ≈ 3.75 min, after which
  the user gets the message above — or they hit Cancel. The retry button also appears after a timeout.
- **Cancel button** (with a "Waiting on Gemini — each model gets up to 45s…" line) shows while a call is
  in flight, in both the Save and Fix blocks. Cancel is client-side: it stops waiting and drops the
  result via a run-id (`geminiRunId` ref). It cannot recall the request from the server — that keeps
  going until Google answers or the 45s cap hits — so a cancel doesn't refund quota.
- `.validator()` replaces `.inputValidator()` in `gemini-relay.ts` (confirmed by the dev-server
  deprecation warning from the installed package; same call shape otherwise).

## Deviation from PLAN.md (needs an explicit OK from whoever owns the plan)
PLAN.md says advance **only on 429**. I widened that to **429 or 503**. Reason: 429 is a quota
problem, 503 is "this model is overloaded right now" — a per-model condition another model very
likely doesn't have, so it's the same "a different model can fix it" case the rule exists to allow.
Everything else (400/401/403 bad key, 404, other 5xx, network) still stops immediately. If you'd rather
keep the strict rule, revert the one line `res.status === 429 || res.status === 503` in
`gemini-fallback.ts` — the manual "Try another model" button still covers 503 by hand. Plain 500 is
deliberately *not* advanced (could be a real fault, not load).

## What the next phase should know
- Reuse `GEMINI_MODEL_CHAIN` / `generateWithFallback` for any future Gemini feature (e.g. a full
  "Generate" button) — it's a small addition on top of this plumbing.
- Phase 4 rebrand: add `komorebi_gemini_key_v1` to the migration list. Phase 5: still delete the stray
  `package-lock.json` — I did not create or ship one.
- `context.md` is now stale on two lines ("Not built yet: the Gemini Generate button and repair-on-
  failure (Phase 3c)") and PLAN.md's status table still lists 3c as ready-to-build. I did not edit
  either; flagging for whoever updates them.

## Verified vs NOT verified (please read)
**Not reproduced:** I never saw why the call hung in the user's test (nothing but the deprecation
warning appeared in the dev-server console). A model holding the connection open — or a slow "thinking"
model on a long prompt — is the likely cause, and the timeout makes that visible ("no answer" in the
trail). If it still hangs past ~45s per model, the cause is elsewhere and needs the console output.

**Confirmed by the user's real run (screenshot):** the key panel, server-function relay, Google
call, model ID `gemini-3.8-flash`, error surfacing and the "Tried:" trail all work end-to-end — the
call reached Google and came back with a real 503 body. That also settles the `createServerFn` call
shape working in `vite dev` (items 1 and 4 below are therefore *partly* resolved: it runs; a strict
`tsc` against the real package types is still worth doing).

Verified here: `tsc` under the project's strict flags is clean on `gemini-models.ts`,
`gemini-fallback.ts`, `prompt-builder.ts`. A network-free test with a fake `fetch` passed 38 checks
(the original 24, plus timeout checks — a hung model is skipped, a fetch that ignores the abort signal
still times out, 2 hung models take ~2× the timeout rather than forever, 503→hang→ok lands on the 3rd
model — plus: 503,429,200 lands on the 3rd model; all-503 gives 5 calls then the busy message
with last status 503; a plain 500 still stops; `rotateChainAfter` starts after the failed model, wraps
at the end, handles the `models/` prefix and unknown/empty ids; a retry after 3.8 first calls 3.7).
The original 24:
429,429,200 lands on the 3rd model; 400/401/403 stop after one call and don't leak the key; 500 and
network errors stop; all five 429s give the quota message; the key is in the header, never the URL;
`models/` prefix stripped; `MAX_TOKENS`, empty/blocked replies, and "thought" parts handled; refusal
detection; repair/save prompts contain what they should.

**NOT verified — no `node_modules` here, so none of this could be checked:**
1. **(Runs in dev per the user's test, but strict types unchecked.) The `createServerFn` call shape in `gemini-relay.ts`** (`createServerFn({method}).inputValidator(fn).handler(...)`)
   and the client call `relayGemini({ data: { apiKey, prompt } })`. PLAN.md says to check the exact API
   against the installed package's types; I couldn't, so this is written from memory of
   `@tanstack/react-start` 1.168.x. **This is the most likely place for a compile error** — run
   `tsc --noEmit` and check `inputValidator` vs `validator` first.
2. `LessonStudio.tsx` type-checks only in the sense that there are no syntax errors or undefined names
   (React/lucide types were unavailable). `Loader2` and `Sparkles` are assumed to exist in lucide-react.
3. Whether the relay actually runs on your deploy target (Cloudflare default vs. Vercel via the
   `process.env.VERCEL` guard). Works in `vite dev` is the expected minimum; deploy not tested.
4. Only `gemini-3.8-flash` is confirmed live (it answered with a 503); the other four IDs are untested
   against a real key. The "Try another model" button and 503 auto-advance were added after that
   screenshot and have only been tested with the fake `fetch`, not against Google.
5. Visual layout of the new blocks.

## What I did NOT touch
- `src/server.ts`, `src/start.ts`, `vite.config.ts`, `lesson-schema.ts`, `context.md`, `PLAN.md`.
- Phase 3d (delete a day / reset), the rebrand, the export shape, and the `ProgressView` "words" bug.
