# Phase 3c2 — follow-ups after verifying Phase 3c

Written by the verifier (Claude), after the user live-tested 3c. Small, self-contained edits; nothing in PLAN's 3d design changed.

## Verified before these edits (on a scratch `npm install`, no lockfile)
- `tsc --noEmit` (strict) clean. `gemini-relay.ts` calls `.validator(...)`, which is the current name in the installed `@tanstack/react-start` 1.168.32 (its types mark `inputValidator` as deprecated, so `phase-3c.md`'s worry about the name is resolved). `Loader2`, `Sparkles`, `RefreshCw` exist in lucide-react.
- `eslint` clean apart from prettier formatting errors (about 98 across `LessonStudio.tsx`, `gemini-fallback.ts`, `prompt-builder.ts`, `gemini-relay.ts`; the new files were never run through prettier). Left alone.
- `npm run build` OK (Cloudflare output by default).
- A network-free fake-`fetch` test of `generateWithFallback` and `rotateChainAfter`: 27/27 (429/503 advance; 400/401/403/404/500 and network errors stop; key never in URL or error text; hung models time out; `MAX_TOKENS`, empty, thought-part and non-JSON-200 handling).
- The user's own live test: Day 14 built by Gemini, trail was 3.8 busy → 3.7 no answer → 3.6 busy → 3.5 busy → 3.1-flash-lite worked.

## Changed in 3c2
1. **Repair uses the day in the pasted text.** New `detectDayNumber(text)` in `src/lib/lesson-schema.ts` reads `"dayNumber": N` from text that may not be valid JSON. `fixWithGemini` in `LessonStudio.tsx` now calls `buildRepairPrompt(repairDay, …)` where `repairDay = detectDayNumber(pasted) ?? day`, and the caption says which one it used. Why it matters: the schema only checks that vocab ids look like `d{n}-{n}`, not that they match the lesson's day, so a mismatch used to pass silently, and Phase 3d's delete cleanup strips `d{day}-*` ids from `masteredVocabIds`/`weakVocabIds`. Vocab count still comes from step 1 (the caption says so).
2. **Doubled "Day 14: Day 14: …" title.** Root cause: the prompt's JSON example told the AI to write `"title": "Day ${day}: <short title>"`, while the preview card adds "Day N:" itself, and the built-in sample lessons have no prefix. Fixed in two places: `prompt-builder.ts` now asks for `"<short title — no 'Day N' prefix, the app adds that>"`, and the preview card renders `stripDayPrefix(lesson.title)` (new helper in `lesson-schema.ts`) so already-generated or pasted titles that still carry a prefix display cleanly. Stored titles are not rewritten.

## Checks after the edits
`tsc --noEmit` clean; `eslint` clean with prettier off; `npm run build` OK; a fake test of the new helpers and prompt (detects the day in broken/fenced JSON, ignores quoted or zero values, strips one prefix only, never returns an empty title, prompt no longer asks for the prefix, repair prompt uses the passed day) — all pass.

## Not verified
- Anything in a real browser (the new caption text, the card title).
- Whether models other than 3.8/3.7/3.6/3.5/3.1-lite as listed still answer; only the 3.1-flash-lite success is seen live.
- Timing discrepancy, worth a 10-second look: the user's trail included a "no answer" (a timeout, 45s in the zip's `GEMINI_ATTEMPT_TIMEOUT_MS`) yet the user reported ~38s total. Either the 38s was approximate, or the running copy's constant differs from the zip.

## Known and left alone
- Prettier noise in the 3c files.
- One shared Gemini status/trail between the Copy step and the Import step (cosmetic).
- 11 of the 13 built-in sample days fail the import schema (fewer than 3 grammar examples), so Gemini repair would refuse to patch lessons shaped like them.
- Vercel: re-check the deployed function's max duration at the Vercel milestone (Hobby is 300s per Vercel's docs, updated July 2026; the worst-case chain is ~225s).

## Files touched
`src/lib/lesson-schema.ts`, `src/lib/prompt-builder.ts`, `src/components/ai/LessonStudio.tsx`, `PLAN.md`, `context.md`, and this file.
