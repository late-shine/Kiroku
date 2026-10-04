# Phase 2 handoff — AI Lesson Studio (Configure / Copy prompt / Import)

## Status: done, typechecked, built, SSR smoke-tested. Not yet interaction-tested by the user.

## What changed
- **New** `src/lib/prompt-builder.ts` — pure `buildLessonPrompt(opts)`. Tone and lesson-style
  instruction *text* are ported verbatim from the old `ChatGPTBridgeModal.tsx` (its
  `toneInstruction`/`focusInstruction` maps, lines ~54-66); the *labels* shown in the UI
  follow doc 1's wording exactly (e.g. "Kanji Deep Dive" not "Kanji Etymology & Deep Dive").
  Day 1 gets a distinct "foundations" branch (hiragana/katakana primer + です/だ, zero assumed
  knowledge); Day N gets the old file's "prior knowledge" block, but rebuilt to also list full
  known-vocab (the old file never did this) and a weak-words-to-review section sourced from
  `progress.weakVocabIds` (already existed on `UserProgressState`, just unused before now).
  Ends with a JSON schema + filled example block, vocab ids `d{day}-{n}`.
- **New** `src/lib/lesson-schema.ts` — zod schema mirroring `DayLesson` exactly, plus
  `extractJsonBlock` (fenced ```json first, falls back to first-`{`-to-last-`}`) and
  `parseLessonFromText` (extract → `JSON.parse` → zod `safeParse`, returns
  `{success, lesson?, errors: string[]}` with human-readable per-field messages).
- **New** `src/components/ai/LessonStudio.tsx` — replaces `AIPanel` entirely. Three-tab
  stepper (Configure / Copy prompt / Import) in a wide (`max-w-3xl`) glass sheet:
  - Configure: day stepper (clamped 1..highestDay+1), tone (2×2), style (2×2), JLPT level
    (N5/N4/N3), vocab count (5/10/15), romaji toggle, custom focus text input. Persisted
    to `localStorage` under `komorebi_ai_studio_v1` (day itself is *not* persisted — always
    starts at "next day" when reopened, matching doc 1's "Day 1 up to next day" range).
  - Copy prompt: live `useMemo`'d preview, copy-to-clipboard with "Copied!" feedback,
    plain "Open ChatGPT / Claude / Gemini" links (just open the site in a new tab — none
    of the three officially support prefilling the composer via URL params, so this doesn't
    try to rely on that; the Copy button is the real mechanism).
  - Import: paste box → "Extract & preview" → either a field-level error list (using the
    new `--destructive` token from Phase 1) or a preview card (day/title/grammar/kanji/vocab
    count) with a Save/Replace button. Replacing an existing day asks a native `confirm()`
    first — matches this codebase's existing simplicity level (no custom dialog component
    exists anywhere else in the app either).
- **Modified** `src/routes/index.tsx` — deleted the old `AIPanel` function, wired in
  `<LessonStudio lessons={lessons} progress={progress} onClose={...} onImport={...}/>`
  (same `onImport` wiring as before: replaces-by-dayNumber, re-sorts, jumps to that day,
  closes the panel), dropped the now-dead `X` icon import (nothing else in the file used it
  once both old modals were gone).

## Deliberately NOT built yet (this is "Phase 2a," not all of Phase 2)
The one-click **"Generate automatically"** button (Gemini BYOK, same-key model fallback)
is not in the UI at all yet — not even as a disabled placeholder, since a dead button felt
worse than no button. Manual copy/paste is fully functional as the default path in the
meantime. To wire the Generate button next, I need:
1. The exact Gemini model name(s) to try, in fallback order (a Google AI Studio screenshot
   of the model list + rate limits works great here — no need to search this myself).
2. Confirmation of the BYOK architecture from our earlier discussion: user pastes their key
   into a settings field (localStorage, client-side only), a thin TanStack Start server
   route relays {key, prompt} to Gemini per-request and returns the text — the key is never
   persisted server-side, never hardcoded, never committed.
Once that's in hand, this becomes a fairly small addition: a settings field in `LessonStudio`
(or a separate small settings panel), a `src/routes/api/*` (or `createServerFn`) route, and a
"Generate" button on the Copy-prompt step that calls it and jumps straight to the Import step
pre-filled with the response.

## Verified
- `npx tsc --noEmit -p tsconfig.json` — clean, strict mode (`noUncheckedIndexedAccess` included).
- `npx eslint` on all new files — clean.
- `npm run build` — succeeds; `zod` shows up bundled server-side as expected.
- Dev server SSR smoke test: fetched the root route, confirmed no error-boundary text /
  exception strings in the response, confirmed Phase 1's music markup still renders correctly
  post-merge. Did **not** verify the Lesson Studio's actual tab-by-tab interaction (opening
  it, clicking through Configure → Copy → Import, extracting a real pasted lesson) — that
  needs a real browser, still blocked by this sandbox's network allowlist for Playwright.

## Known trade-offs, worth knowing about
- The "Open in ChatGPT/Claude/Gemini" links are inert conveniences (open the site, nothing
  prefilled). If any of the three ever add an officially-supported prefill query param,
  worth revisiting — didn't want to rely on undocumented URL tricks that could break silently.
- `window.confirm()` for the overwrite-existing-day guard is intentionally low-tech to match
  the rest of the app; if a nicer confirm dialog gets built for other reasons later, this
  should switch to it too instead of staying a special case.
- Vocab summary in the Day N prompt lists *every* known word across all prior days with no
  cap — by Day 30+ this could make the prompt quite long. Not a bug, just something to watch;
  a future pass could summarize older days more tersely if it becomes a real problem.

## Still ahead
Gemini "Generate" wiring (see above), SRS (`srs.ts`, Review mode), library backup
export/import (currently `ProgressView`'s export/import is `{lessons, progress}` only —
not versioned, doesn't include SRS/settings yet), first-run welcome flow, splitting the
rest of `index.tsx` into `src/components/desk/*`. Phase 3 also has the shuffle-should-
randomize-speed-too tweak from Phase 1, noted but not yet done.
