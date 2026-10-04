# Kiroku — Build Plan

This is the working roadmap for everything past Phase 3a. Every implementing AI — Claude, Codex, or anyone else — reads this file plus the phase section it's assigned before doing anything.

## Working Rules for Every Implementing AI

These two rules apply to **all** phases and all AI passes.

### Rule 1 — Read only what the phase needs
Do not scan the whole project. Read only the files listed for your phase (plus anything they directly import that you must modify). Reading everything wastes context, invites unrelated changes, and risks touching parts of the app that belong to another phase.

### Rule 2 — Write a handoff after every phase
After finishing a phase, the implementing AI must produce a **handoff note** so the next AI (which knows only the old version) does not have to discover what changed. Save it as `handoffs/phase-<id>.md` in the project (for example `handoffs/phase-3d.md`).

**Handoff template:**
```text
# Handoff — Phase <id>: <title>
Date: <date>

## Summary
One short paragraph: what this phase changed and why.

## Files changed
- <path>: what changed (new component / modified section / moved code).
- <path>: ...

## Files added
- <path>: purpose.

## Data/schema changes
- New or renamed fields, new data files, migration notes, and how old data
  is kept compatible (or state "none").

## Behavior changes
- Anything the user will notice; anything other screens now depend on.

## What the next phase should know
- New APIs/components it should reuse.
- Known limitations, TODOs, and review-gate items still open.

## What I did NOT touch
- Areas intentionally left for later phases.
```
A phase is not complete until its handoff file exists and is accurate.

---

## Phase Roadmap

| Phase | Title | Status |
|---|---|---|
| **3b** | Prompt rewrite: teach-then-save + a Learn/Save mode toggle | ✅ Done — see `handoffs/phase-3b.md` and `handoffs/phase-3b2.md` (a follow-up safety fix, see that phase's own section below) |
| **3c** | Gemini API: smart import (repair + Save-only automation) | **Built and live-tested** (Day 14 built via Gemini in ~40s; fallback chain visibly worked). Follow-ups in `handoffs/phase-3c2.md` |
| **3d** | Delete a day / reset progress | Built, then extended with multi-select in `phase-3d2.md` |
| 4 | Rebrand: Komorebi → Kiroku everywhere, incl. localStorage migration | ✅ Built — see `handoffs/phase-4.md`. Header is `記録 STUDY DESK` (user's choice). The user swaps `public/favicon.ico` by hand. |
| 5 | Repo cleanup — delete `AGENTS.md` boilerplate (keep one line), remove the stray `package-lock.json` | ✅ Done — see `handoffs/phase-5.md` |
| 6 | Music & quiz polish — shuffle+speed, quiz day-range toggle, more songs | ✅ Built and user-tested (the dark-dropdown fix is in the verifier addendum) — see `handoffs/phase-6.md`. Also fixed the `ProgressView` words-count bug. |
| 7 | Atmosphere — auto theme-cycle with slow crossfade; optional particles | Optional / later, suggestions below |
| 8 | Voice selection — pick + save a browser voice | ✅ Built and user-tested — see `handoffs/phase-8.md`. Picker card lives in the Atmosphere tab. (A 1–2 s delay before the voice list appears after a hard refresh is expected: Chrome loads voices asynchronously.) |
| 9 | Accounts — Google sign-in, cross-device sync | Later, bigger architecture change; gets its own sub-plan when we start it |
| 10 | Cross-app bridge — Kiroku ↔ Astra-chan suggest each other | Later, depends on Phase 9 and both repos being public |
| 11a | **Welcome screen** — remove the 13 sample days; a welcome panel where Kiroku introduces itself | ✅ Built, user-tested and **verified** — see `handoffs/phase-11a.md` (incl. the verifier addendum: the welcome shows whenever there are zero lessons; no stored flag). |
| 11b | First-run tips — dismissible per-screen cards + a "?" help card for the AI-prompt flow | ✅ Built, user-tested on PC and mobile, code spot-checked by the verifier (tokens only, `kiroku_tips_v1` not in backups, Astra link opens in a new tab with `noopener`) — see `handoffs/phase-11b.md`. Not yet checked in a real browser (builder sandbox has none); the click-through list is in the handoff. Also fixed the day-after-Restore quirk. |
| 12 | Astra-chan mention — one quiet "also by me" link | ✅ Built with 11b and user-tested — bottom of the Atmosphere tab, proposed-default wording; see `handoffs/phase-11b.md`. |
| 13 | **Backup safety** — versioned export, validated restore | ✅ Built, user-tested and **verified** — see `handoffs/phase-13.md`. New `src/lib/backup.ts`; `ProgressView` export/restore replaced by `BackupControls`. Checked: tsc clean, 38-case script `handoffs/phase-13-backup-check.ts` passes, and in the browser: restore round-trip, garbage file refused, `version: 99` refused, Cancel changes nothing, welcome-screen "Restore a backup" works. Keep the script in the repo (it imports `src/data/initialLessons.ts`, so keep that file too). |
| 14a | **Quiz rounds** — a quiz that ends, shows a summary, lets you retry what you missed; misses feed the existing `weakVocabIds` | ✅ Built, user-tested in the browser and code spot-checked by the verifier — see `handoffs/phase-14a.md`. Decisions used: counter keeps counting answered questions; round default 10; misses only return via "Retry missed"; (c) misses feed `weakVocabIds` (a right answer removes the id) — the user is OK with it. `QuizView` now lives in `src/components/quiz/`. No schema or backup change. |
| 14b | **Word memory + Review mode** — per-word records (Leitner boxes), "Due today", earned mastery | ✅ Built; data layer, backup v2 and cleanup spot-checked by the verifier (schema validation, v1→v2 migration, delete/reset cleanup all read correctly); user tried it in the browser. **Design flaw found in use:** every never-answered word counts as due, so a fresh restore shows "Due today · 130". Fixed by 14b-fix (built, below). See `handoffs/phase-14b.md`. |
| 14b-fix | **Calm intake** — a word joins review only when you add it (or miss it); the quiz badge stops being a wall | ✅ Built and verified. Two builders did this phase independently with near-identical results; this build was chosen as the base (cleaner round API, accessible per-word labels, one `badgeText` helper, a separate check script) and the user tested it in the browser. See `handoffs/phase-14b-fix.md`. A word is in review only when it has a record (added, answered or missed); "Add to review" on the Vocab tab; badge and "Due today" count only words in review (badge capped at 99+); due rounds ask the most overdue first. No backup-format change (stays v2). Decisions (a) = no, (b) = yes, taken from the verifier's leans; see the handoff. |
| 14c | **Review words in the AI prompt** — due/weak words go into the next Learn prompt so the AI re-teaches them in new sentences | ✅ Built, user-tested (including a real ChatGPT run that used the review words) and verified — see `handoffs/phase-14c.md`. The Learn prompts (Learn + Save, Learn only) carry up to 10 due words from earlier days, most overdue first, in a new "Words due for review" paragraph; the Lesson Studio says how many. Save only never gets it. No backup change. Prompt wording **approved by the user (2026-10-03)**. Micro phase 14c-1 added an "AIs can ignore the prompt: resend, try thinking mode" note to the Studio tip and help card. This is the part that makes Kiroku different from a flashcard deck. |
| 14d | **Harder question types** — English→Japanese, type the reading | ✅ Built, user-run and verified (tsc, build, the 120-case quiz script and both jsdom UI scripts pass; lint only shows the old prettier findings) — see `handoffs/phase-14d.md`. A follow-up inside the phase added a **Question style** row (By progress / Meaning / Choose the word / Type the reading, every scope; "Choose the word" is the way out for anyone without a Japanese keyboard) and removed repeated words in a round (same Japanese text + reading counts as one word; the copy already in review wins). In a "Due today" round a word is asked the way its Leitner box earns: boxes 1–2 pick the meaning (as before), box 3 choose the Japanese word, boxes 4–5 type the reading in kana (kana-only words and words with an unusable reading get "choose" instead). Practice scopes are unchanged. Typed answers: NFKC, spaces ignored, katakana = hiragana, several stored readings accepted, never romaji, Japanese-keyboard safe. Decisions (a)–(d) = the plan's defaults. No backup change (stays v2), no tip changes. **Addendum (2026-10-04, user-approved):** a "Question style" row (By progress / Meaning / Choose the word / Type the reading) that works in every scope, and rounds ask each *word* (same Japanese + reading) once — see the addendum in `handoffs/phase-14d.md`. Known small limits are listed under "Small known issues". |
| 14e | **Quiz more than vocab** — kanji, grammar, phrases | Later, after 14d. |
| — | Cross-link both READMEs | Whenever the GitHub repos go live — a reminder, not a numbered phase |
| 15 | **Leave Lovable: strip `@lovable.dev/vite-tanstack-config`, go bare Vite + Vercel-only** | **Code changes made (2026-10-04), not yet checked by the user.** Plain `vite.config.ts` (reference config from the verifier addendum, dev port 8080 kept), Lovable error reporter and package removed, `bun.lock` and `bunfig.toml` deleted, `.gitignore` now covers `.env*` and `.vercel` and no longer ignores `package-lock.json`, `context.md` build/deploy and package-manager rules rewritten. **Still to do (the user):** `npm install` to create `package-lock.json`, then every check in the Phase 15 section, then `git init` + first push to `late-shine/Kiroku` (private, created 2026-10-04), then connect Vercel. See `handoffs/phase-15.md`. Phase 15b (README) follows. |
| 15b | **README refresh** (small; **not** part of the builder's Phase 15 session) | To be done by the first verifier (he knows the decision history) after Phase 15 passes: keep the user's text as written and update only the stale facts (features, status, setup, the "Being built next" list), using `context.md` for what the app does and `handoffs/` for the dated history. The old "Japanese SRS" line is fair again now that review mode is real. Not started. |

*Phase numbers are labels, not a build order. Suggested order from here: (user prep: screenshot a lesson while Day 13 still exists, generate welcome mockups) → ~~11a → 13~~ (both built) → ~~11b (+12)~~ (built) → ~~14a (quiz rounds)~~ (built) → ~~14b (word memory + Review)~~ (built) → ~~14b-fix (calm intake)~~ (built) → ~~14c (review words in the AI prompt)~~ (built) → ~~14d (harder question types)~~ (built) → **15 (the GitHub/Lovable exit) + 15b (README refresh)** → a planning-only session for 9 → 10. Whenever you feel like it: 7, 14e, tips polish (see the notes below).*

"Interactive features" isn't on this list yet — it's too open-ended to schedule. Bring a concrete example when you have one and it'll get a phase number.

**A gap worth deciding on, found while reconciling this plan against the very first spec document:** the original app spec called for a real SRS (spaced-repetition scheduling, a Review mode, weak/mastered word tracking feeding back into prompts) and a first-run welcome (start fresh vs. load a sample course), and a properly versioned `{version, lessons, progress, srs, settings}` backup export. **Update:** the first-run welcome is now Phase 11a (with a changed shape: new users start empty and see a welcome panel, there is no loadable sample course), and the versioned backup is now Phase 13 (`{app, version, exportedAt, lessons, progress}`; no SRS or settings yet). The SRS / Review mode still has no phase number — it got sidelined when planning pivoted hard into the prompt/Gemini work. `progress.weakVocabIds` already exists and is already read by the prompt builder, but nothing actually writes meaningful values into it yet (no real spaced-repetition scheduling exists). Worth explicitly deciding whether these come back onto the roadmap (and where) rather than staying silently dropped.

**Small known issues, not yet scheduled** (found while verifying, each is a few lines to fix):
- (14d) If both copies of a repeated word (same Japanese + reading under two ids) are in review, the "Due today · N" count and the Quiz badge count both, though a round asks the word once, and answering one copy does not update the other's record. Fix would be in the badge in `index.tsx`; harmless meanwhile.
- (14d) In a typed question, a Japanese keyboard can turn "ほん" into 本 if the player converts before pressing Enter. The typed kanji then counts as a miss ("Not quite"). Possible polish: if the typed text equals the word's written form, show a gentle "type the reading in kana" hint and let them try again without a penalty.
- **(Fixed in Phase 11b.)** After a Restore, the shell's `day` state isn't reset. If the backup has no Day 1 (e.g. starts at Day 5), the header can read D1 while the workspace shows the first lesson. Fix: set `day` to the first restored lesson's number after a successful Restore. Harmless for backups that start at Day 1.
- ~~`ProgressView`'s "words" metric was hardcoded as `lessons.length * 10`.~~ Fixed in Phase 6 (sums `lesson.vocab.length`).
- The export filename is now `kiroku-backup.json` (Phase 4); the export shape was `{lessons, progress}` only until Phase 13 (now `{app, version, exportedAt, lessons, progress}`; no music/AI-studio settings). Fold the filename into Phase 4 (rebrand); the versioned backup is Phase 13; a complete backup that also carries SRS data waits for the SRS decision above.

---

## Phase 3b — Prompt Rewrite (full design)

**✅ Built.** What follows is the original design brief, kept for reference. What actually shipped
(including a same-conversation-vs-fresh-chat safety fix beyond this original design, prompted by
real testing) is in `handoffs/phase-3b.md` and `handoffs/phase-3b2.md` — read those for the
as-built behavior, not just this section.

**Files this phase touches:** `src/lib/prompt-builder.ts`, `src/lib/lesson-schema.ts` (read-only, to confirm `extractJsonBlock` behavior — no change needed there), `src/components/ai/LessonStudio.tsx` (the Configure step, to add the mode toggle).

### What's actually wrong today
The current prompt (`buildLessonPrompt` in `prompt-builder.ts`) says *"Please teach Day X with exactly these sections"* immediately followed by *"Return the lesson as exactly ONE JSON code block."* Most AIs read that combination as "output only JSON" and skip the readable teaching moment entirely — which is the exact complaint. Worth knowing: `extractJsonBlock()` in `lesson-schema.ts` already searches the *whole* reply for a fenced block, so prose before it has never actually broken the importer. This is a prompt-wording fix, not a parser fix.

### New default prompt shape (mode: `learn-save`)
Keep everything before `=== TODAY'S LESSON REQUEST ===` as-is (tone, level, romaji, prior-knowledge block all still needed). Change the teaching instruction and the bridge into the schema block:

```
=== TODAY'S LESSON REQUEST: DAY ${day} ===
Teach me Day ${day} like a real tutor would — in your own natural voice, not as a
data form. Cover exactly these six things, each fully explained, in plain
readable prose with real examples:
1. Grammar Point — ...
2. Kanji of the Day — ...
3. ${vocabCount} Themed Vocabulary Words — ...
4. A Natural Japanese Phrase — ...
5. Pattern of the Day — ...
6. Tiny Culture Corner — ...

Keep everything beginner-appropriate for someone who only knows what's listed
above — do not skip ahead.

When you're done teaching, add one short natural sentence letting me know
what's coming next — for example: "Since you're using Kiroku to save your
progress, here's the block to paste back into Kiroku's Import screen." Then
output the same lesson as one JSON code block, exactly as specified below.
```
Then the existing `schemaAndExampleBlock()` call, unchanged — its "no extra prose *inside* the code block" rule is still correct and still needed.

### Mode toggle: 2 more prompt variants
Add `type PromptMode = "learn-save" | "learn-only" | "save-only"` and a small 3-way toggle in the Configure step, defaulting to `learn-save`.

- **`learn-only`** — reuses the teaching instructions above, drops the closing paragraph and the `schemaAndExampleBlock()` call entirely. Good for someone who wants to ask follow-up questions before committing anything to Kiroku.
- **`save-only`** — a new, short prompt function that doesn't reteach anything: *"I already learned Day ${day} — either from our conversation above, or from the lesson text I'm about to paste in. Convert it into Kiroku's format."* Then the same `schemaAndExampleBlock()` call — fully reusable, no new schema code needed.

### In-app guidance copy (small note under the toggle)
> **Learn + Save** (recommended) — teaches you the full lesson, then adds a small block at the end for Kiroku. Paste the whole reply back in.
> **Learn only** — just the lesson, no data block. Good for follow-up questions before saving.
> **Save only** — turns a lesson you already have into Kiroku's format. Paste your existing lesson in first, then copy this prompt.

---

## Phase 3c — Gemini API: what it should actually do

You asked the right question: once 3b ships, the manual copy-paste prompt already teaches, guides the user, *and* produces clean JSON — for free, with any AI, no key required. So a "one-click Generate the whole lesson" button adds less than it would have before 3b; mostly it just saves a tab-switch.

Where the API still earns its place is at the two friction points 3b doesn't remove:

1. **Import-time repair.** Any mode, any AI, any user can end up pasting something that fails schema validation — wrong section copied, an AI that ignored the format, a truncated paste. Instead of sending the user back to regenerate, the Import screen's error state gets a "Fix with Gemini" button: send the failed text + the schema + the validation errors, get back corrected JSON, show it in the same preview-before-saving flow that already exists.
2. **Automating `save-only`.** This is genuinely new value, not just a shortcut: someone who already learned Day X in an ordinary, unstructured conversation with any AI can paste that raw text straight into Kiroku and skip the second round-trip (copying the `save-only` prompt back into that same AI, waiting for its reply, copying *that* back). Under the hood this is the exact same call as #1 — "take this text + schema, return valid JSON" — just triggered proactively on paste instead of only after a validation failure.

**Recommendation:** scope Phase 3c as one Gemini-backed function with two entry points (repair-on-failure, and an explicit "Save with Gemini" option on the `save-only` flow), rather than a full auto-teaching "Generate" button. Keep manual copy/paste as the always-works default with no key needed either way. If a full one-click "teach and save" button still seems worth it later, it's a small addition on top of the same plumbing — just lower priority now that the prompt itself does the job.

### Files this phase touches
- **New** `src/lib/gemini-models.ts` — the fallback chain as a single array constant (see below), so a renamed or retired model is a one-line fix.
- **New** a server function that relays the call to Gemini (e.g. `src/lib/gemini-relay.ts`). Use `createServerFn` from `@tanstack/react-start`; **check the exact API against the installed package's types in `node_modules`, not memory**. `src/start.ts` already installs CSRF middleware filtered to `serverFn` handlers, so a server function gets that protection for free, while a plain file-route API endpoint would not.
- `src/components/ai/LessonStudio.tsx` — an API-key settings field, a "Fix with Gemini" button in the Import step's error state, a "Save with Gemini" option in the `save-only` flow, a loading state, and a short "tried X, then Y" trail when the chain falls through.
- `src/lib/prompt-builder.ts` — add a pure repair-prompt builder (failed text + schema + the validation errors). `schemaAndExampleBlock()` is currently private to that file; reuse it there rather than duplicating the schema text.
- Read-only: `src/lib/lesson-schema.ts` (results still go through `parseLessonFromText`, then the existing preview-before-saving flow), `context.md`.
- ~~**Do not put any of this in `src/server.ts` or `src/start.ts`.**~~ *(Lovable-era rule: it existed because Lovable's build inspected those two files. Retired in Phase 15 now that the wrapper is gone. Keep Gemini code in `gemini-relay.ts` and the Studio anyway; there is no reason to move it.)*

### Gemini details
Fallback order (bare IDs; AI Studio's "Get code" showed some with a `models/` prefix and one without, so store them bare, strip a leading `models/` if present, and build `models/${id}:generateContent` yourself):
1. `gemini-3.8-flash`
2. `gemini-3.7-flash`
3. `gemini-3.6-flash`
4. `gemini-3.5-flash`
5. `gemini-3.1-flash-lite` — last resort, much higher daily quota

Free-tier limits seen on the user's dashboard: full Flash models 5 requests/min and 20/day; Flash Lite 15/min and 500/day. Pro models showed 0/0, so they are not in the chain.

Rules:
- **Advance to the next model only on HTTP 429** (quota / rate limit). For 400/401/403 (bad request, bad key) stop immediately and show a plain-language message such as "Gemini rejected the API key". Any other failure also stops with a clear message. Don't burn through the whole chain on errors that a different model can't fix.
  - **As built (deliberate deviations):** the chain also advances on HTTP 503 (a real "model busy" seen live) and on a per-model timeout (`GEMINI_ATTEMPT_TIMEOUT_MS`, 45s), because a different model can fix both. Worst case a fully hung chain is ~5 × 45s. Vercel Hobby's function limit is 300s (Vercel docs, July 2026), so it fits; re-check the deployed function's max duration at the Vercel milestone.
- **The API key is not given to you and you must never hardcode one.** The user pastes it into the app's settings field; it lives in `localStorage` only (follow the existing `komorebi_*_v1` naming — the rebrand is Phase 4, not this phase). The server function receives it per request, sends it to Google in the `x-goog-api-key` header (not in the URL), and must not store or log it.
- **Use only Web-standard APIs (`fetch`, `Response`)** in the relay so it runs on both targets the build supports (Cloudflare Workers by default, Vercel Functions when `process.env.VERCEL` is set) — no Node-only modules.
- **Make the fallback loop testable without a network.** Your sandbox probably can't reach Google. Write the loop so the `fetch` implementation is injectable and test it with a fake that returns 429 a couple of times and then 200. The first real call to Gemini will be the user, in the running app.
- For the repair call, asking Gemini for JSON output (`generationConfig.responseMimeType: "application/json"`) is worth trying, but whatever comes back still goes through `parseLessonFromText` and the preview card — never save straight from an API response.

**Before writing the server route:** read `context.md`'s note on `vite.config.ts`'s `process.env.VERCEL`-guarded nitro preset first. Whichever host actually runs this server route needs to be the one the preset targets — confirm that's settled before assuming the route "just works" wherever it's deployed.

**Also worth knowing (from Phase 3b2, already shipped):** `buildSaveOnlyPrompt(day, vocabCount, existingLessonText?)` already takes an optional third argument for embedding lesson text directly into the prompt, specifically because a fresh AI chat has no memory of what was taught elsewhere. If this phase's automation calls that same function, or reimplements its logic for a direct API call, it should take pasted/existing lesson text as an input for the identical reason — an automated call has even less implicit conversation context to lean on than a human pasting into a chat does.

---

## Phase 3d — Delete a day / reset progress

**Files this phase touches:** `src/routes/index.tsx` (all app state lives here — the curriculum
list/day picker UI, `lessons`/`progress` state, and `ProgressView`'s existing export/import
section). No schema changes; `src/types/japanese.ts` and the zod schema in `lesson-schema.ts` are
read-only for this phase.

**Built.** Bundled with this phase: `lessons` now persists to `localStorage["komorebi_lessons_v1"]`
(add it to the Phase 4 migration list). It never had before — a page refresh silently reverted
*any* change to `lessons`, delete included, back to the 13-day sample set, and the AI-imported days
you'd just built didn't survive a reload either. That made "This can't be undone" untrue in the
other direction (a refresh *did* undo it) and made zero lessons an unreachable state, so this needed
fixing for the delete/reset promise to hold. See `handoffs/phase-3d.md` for what else was built and
what's still unverified.

### What's actually missing
There is currently no way to remove a single day's lesson, and no way to reset all progress short
of manually clearing the browser's `localStorage`. The only thing that touches the `lessons` array
today is Import's create-or-replace-by-`dayNumber` — there's no delete path at all.

### Delete a single day
Add a delete action to wherever the day is most naturally selected — the "今日 · curriculum"
sidebar list is the obvious spot (a small trash icon per row), gated behind a `window.confirm()`
("Delete Day N? This can't be undone.") to match the existing overwrite-confirmation convention
already used by Import. On confirm:
- Remove that `dayNumber` from `lessons`.
- Strip any vocab ids belonging to that day (`d{day}-*`) out of `progress.masteredVocabIds` and
  `progress.weakVocabIds` — leaving them in would silently reference vocabulary that no longer
  exists anywhere, corrupting future prompts' "known vocabulary" and "weak words" sections.
- Remove the day from `progress.completedDays` if it's tracked there.
- If the currently-selected `day` was the one just deleted, move to the nearest remaining day
  (falling back to Day 1, or to an empty/no-lessons state if none remain — check how the app
  currently behaves with zero lessons, since that may not have been an exercised path before).

### Reset everything
Add a clearly-separated "Reset all progress" action in `ProgressView`, next to the existing
export/import backup controls (export first, as the obvious "back this up before you nuke it"
nudge). Scope this narrowly: it clears `lessons` back to empty and `progress` back to its default
shape — it should **not** try to also implement offering the sample course back (Days 1–13) as an
alternative to a blank slate; that's the original spec's separate "first-run welcome" idea, which
is now Phase 11a (new users start empty and see a welcome panel; there is no sample course to offer back)
and shouldn't get bundled into this one by accident. Gate this one behind a stronger confirmation than the
single-day delete, given the blast radius — consider requiring the user to type something
(e.g. the word "reset") rather than a plain OK/Cancel, since a single misclick here is much more
costly than a misclick on one day.

---

## Phase 14 — The quiz, in four steps (full design)

**Why:** the quiz is the weakest part of the app. `QuizView` (in `src/routes/index.tsx`) is vocab only and always the same question (pick the English meaning of a Japanese word, multiple choice). It shuffles the pool once and then wraps around forever (`index % shuffled.length`), so there is no score and no end. The README promises "a Japanese SRS" and the original spec called for spaced repetition, but today the app has **no memory of how you did on any word**. Found while reading the code:
- **A wrong answer never shows the right one.** Only the option you picked is highlighted.
- **Answers aren't locked.** Before pressing Next you can click another option and change it.
- **"Review this one again" does nothing.** Misses aren't recorded. `weakVocabIds` already exists in `UserProgressState`, and `prompt-builder.ts` already reads it to tell the AI which words are weak, but nothing ever writes to it.
- **"Mastered" is only the star** the user clicks. **"Quizzes taken" counts questions**, not quizzes (`totalQuizzesTaken` goes up on every Next).

This is split into small phases so each fits one builder session and can be tested alone. 14a ships first because it is small and has no data change; 14b is the big one and comes **before Phase 9 (accounts)**, so that sync carries the final shape of the review data and nothing needs migrating later.

### Phase 14a — Quiz rounds (no data-format change)
1. **A round has an end.** Starting a quiz takes the current pool (Day / All days / Range, unchanged), shuffles it once, and asks each word once. Add a round length choice: 10, 20 or all (suggested default 10; if the pool is smaller, use the pool). The counter reads "Question 3 of 10" and the last Next becomes "Finish".
2. **Lock the answer** after the first pick, and **always highlight the correct option** when the pick was wrong (picked one marked wrong).
3. **Summary screen:** score (e.g. 7 / 10), the list of missed words (Japanese, reading, meaning), and buttons **Retry missed words** (a new round of only those, shown only if something was missed), **New round**, and a way back. If everything was right, say so.
4. **End round early** button: goes to the summary with what was answered so far.
5. **Misses feed `weakVocabIds`** (the existing field, so the backup already carries it and no backup version bump is needed): a miss adds the word's id; getting that word right in a later round removes it. Deleting a day and resetting already clear these ids. *This changes what future AI prompts say about weak words, so confirm it with the user (the verifier leans yes: it is what the field is for).*
6. Keep the Day/All/Range controls and the empty-pool messages exactly as they are. Changing the scope mid-round starts a fresh round.

*Decisions for the user (the builder must ask):* (a) what "quiz taken" means. Option A: one per finished round plus a new "questions answered" number; Option B: leave `totalQuizzesTaken` counting questions as today. The verifier leans to **B for 14a** (keeps existing numbers consistent; revisit in 14b). (b) default round length; (c) point 5 above; (d) should a missed word also come back later *within* the same round (e.g. a few questions later), or only through "Retry missed"? Default: only Retry missed.

*Structure:* move `QuizView` out of `index.tsx` into `src/components/quiz/QuizView.tsx`, with the round logic as a pure helper in `src/components/quiz/round.ts` (build a round, score it, list the misses, build a retry round). Add a script like `handoffs/phase-14a-quiz-check.ts` (as 11b did) testing the helper without a browser: empty pool, pool smaller than the round length, retry of missed words, duplicate meanings still giving unique options. `index.tsx` should shrink, not grow.

### Phase 14b — Word memory + Review mode (changes the backup format)
1. **Per-word record**, keyed by the vocab id (ids look like `d<day>-…`, and delete-day already filters by that `d<day>-` prefix): Leitner box, next-due date, times right, times wrong, last answered. Stored in the progress state (a new field such as `vocabMemory`), so it is part of the backup. *Decision: whether the builder re-uses ids when an AI re-emits a day (re-import of the same day). Records follow the id, so this must be stated in the handoff.*
2. **Scheduling (Leitner):** default gaps 1, 3, 7, 14, 30 days for boxes 1–5. Right answer: up one box. Wrong answer: back to box 1 (the standard rule; the user can pick "down one box" instead). A new word starts in box 1 and is due immediately. *(Superseded by Phase 14b-fix: a word with no record is NOT due; it joins review only when added, answered or missed.)* "Due" compares **local calendar days**, not 24-hour spans, so "due tomorrow" means tomorrow morning.
3. **Review mode in the quiz:** a **"Due today"** option next to Day / All / Range, with the due count shown somewhere visible (a small badge on the Quiz tab or a line in the quiz card). Every quiz answer, in any mode, updates the word's record.
4. **Mastered becomes earned:** reaching the top box counts as mastered. The user's star stays as a manual override. Decide how they combine (the verifier suggests: mastered = starred **or** top box, computed, so un-starring never fights the schedule) and what the Progress "mastered" number counts.
5. **Backup format v2** (use the Phase 13 machinery in `src/lib/backup.ts`): old v0/v1 files still restore, with empty memory; the new field is validated like the rest; a v2 file in an older Kiroku is refused by the existing "newer Kiroku" guard. Extend `handoffs/phase-13-backup-check.ts` with the new cases.
6. **Cleanup:** Delete a day removes that day's records; Reset everything clears all of them (same as `weakVocabIds` now). `weakVocabIds` can become "words currently in box 1 after a miss"; state how the two relate in the handoff.
7. Prompt builder: out of scope here. Say in the handoff whether due/weak words should later flow into the AI prompt.

*If it doesn't fit one session, split it:* 14b-1 = data + backup + cleanup (no visible UI), 14b-2 = Review mode UI + due count + mastery.

### Phase 14b-fix — Calm intake (what makes Kiroku's review different from a flashcard deck)

**What went wrong:** 14b treats a word with no record as "new, so due now" (`isDue` in `src/lib/word-memory.ts`). Restoring 13 days therefore shows "Due today · 130": a wall of cards on day one. That was the verifier's plan default ("a new word starts in box 1 and is due immediately"), and it was the wrong default. Astra's own SRS plan lists the same problems (no daily limit, everything added becomes due at once). **Kiroku should not solve this the Astra way** (daily caps, a card deck, grading buttons). Kiroku is the notebook that remembers what your AI taught you, so intake should come from the lessons and from the user, not from a flood.

**The rule:** the review list is only the words that have a record. A word gets a record when the user **adds it**, **answers it** in any quiz, or **misses it**. Words that have never been touched are **not due**. They are just lesson content. Nothing about the stored data changes: records stay as they are, **backup stays v2**, and no migration is needed.

**Work:**
1. `isDue` / `dueWords`: a word with no record is **not** due. Keep `applyAnswer` behaving as built (a brand-new word answered right still starts in box 1 and climbs to box 2, because "new" is decided there by `!prev`, not by `isDue`). Update the 45-case memory script accordingly.
2. **Add to review**, two small controls on the Lessons **Vocab** tab (tokens only): a per-word "Add to review" action, and one **"Add this day's words to review (N)"** button. Adding creates a record in box 1 due today for words that have none, and leaves existing records alone. Do not reuse the star: the star means "I already know this".
3. **Quiz badge and button:** the badge and "Due today · N" now count only words in review. When the count is 0, show a quiet "Nothing due. Add words from a lesson, or practise any day" instead of an empty round. Cap the badge text at "99+".
4. **Most overdue first** when building a Due round (oldest due date first; ties random), instead of random order.
5. **Quiz tip card** (`tips.ts`): add "Due today" in one line.
6. A user with a restored backup and no records simply starts with 0 due. That is correct.

*Built as `handoffs/phase-14b-fix.md` describes.* *Decisions for the user (the builder must ask):* (a) should marking a day **Done** also add that day's words to review? The verifier leans **no for now**: one explicit button is clearer, and Done already means "I finished the lesson". (b) Should a right answer in a practice scope (This day / All days / Range) on a word that isn't in review still create a record? As built: yes, every answer creates one. The verifier leans to keep that: it is the user's own effort, so it is naturally limited.

### Phase 14c — Review words in the AI prompt (Kiroku-only)
Kiroku already sends the AI "what you already know" and the weak words (`prompt-builder.ts` reads `weakVocabIds`). 14c adds the words that are **due for review** (from `vocabMemory`) as a short section of the Learn prompt: "Use these words again in the new lesson's example sentences and phrases." The AI then does the spaced exposure inside real lessons, which a flashcard app cannot do. Keep it small: a cap on how many words go in (suggest 10, most overdue first), a note in the prompt-mode help text, and a test script for the prompt text. The builder must read `src/lib/prompt-builder.ts` and `context.md` first, and ask the user before changing the prompt wording (Phase 3b's guidance copy rules still apply: the user approves the wording).

### Phase 14d — Harder question types (recall, not just recognition)
**✅ Built — see `handoffs/phase-14d.md` for the as-built behavior; the text below is the original design brief.**

**Why:** today every question is the same: see a Japanese word, pick its English meaning. That tests *recognition*. A word that has climbed the Leitner boxes should be asked in harder ways, because recalling a word is what makes it stick. 14b's boxes now tell us how well a word is known.

**Question types (new `kind` on each round question):**
- **A, recognise (as today):** see the Japanese word (and reading), pick the meaning from four.
- **B, choose the word:** see the English meaning, pick the Japanese word from four options.
- **C, type the reading:** see the Japanese word and its meaning, type the reading in kana; check it after normalising (see below).

**Which type a word gets (in "Due today" rounds):** box 1–2 → A, box 3 → B, box 4–5 → C. A word that isn't in review yet keeps type A. The practice scopes (This day / All days / Day range) stay on type A, so the quiz you already know does not change. *If a word's reading is the same as its written form (kana-only words such as ありがとう), type C would just be copying: give it B instead.*

**Typed answers (type C):**
- Compare after: Unicode NFKC normalisation, trimming spaces, and converting katakana to hiragana (so ｶﾀｶﾅ / カタカナ and かたかな all match). Do not accept romaji.
- If the stored `reading` holds several readings (check the real data format for separators such as `/`, `・`, `、`), accept any one of them.
- **IME safety:** Enter must NOT submit while the player is still converting kana (check `isComposing` / keyCode 229), otherwise typing on a Japanese keyboard breaks. Input attributes: `lang="ja"`, `autoComplete="off"`, `autoCapitalize="off"`, `spellCheck={false}`. Enter submits; Enter or the button goes to Next.
- A wrong typed answer shows what was typed next to the correct reading. Add an **"I don't know"** button that counts as a miss.
- Right or wrong goes through the same `recordAnswer` / `applyAnswer` as every other answer. No new record fields, **no backup change**, and the summary screen, weak words and retry work as they do now.

**Constraints:** theme tokens only, no new dependencies, nothing in the prompt builder, tips or backup. Put the type choice and the answer checking in pure helpers in `src/components/quiz/round.ts` (or a new file next to it) with a script like the earlier `handoffs/phase-14*-check.ts` (empty/short pools, B options all have different Japanese text, type C normalisation cases, multi-reading words, kana-only words fall back to B, IME-composing Enter does not submit — the last one in the jsdom UI script). If it will not fit one session, split it: **14d-1** = type B (no typing), **14d-2** = type C (typing).

*Decisions for the user (the builder must ask):* (a) the box → type mapping above; (b) Due-only, or should "All days" also use the harder types for words that are in review? (default: Due-only); (c) in type C, show the meaning as a hint? (default: yes; the aim is recalling the reading, not guessing the word); (d) is a missed type-C word treated like any other miss (back to box 1)? (default: yes).

*Handoff must include* a click-through list for the verifier: one word of each type, a wrong typed answer, "I don't know", typing with a Japanese keyboard (Enter during conversion), a kana-only word, and a phone width.

### Phase 14e (later)
- **14e — quiz more than vocab:** kanji, grammar points, phrases. Vocab first keeps it manageable.

*(14c is the one phase that does change the prompt builder, and the Lesson Studio's Configure step, as its section above says.)* **Constraints for all of 14:** theme tokens only (the existing `border-success` / `bg-success/15` classes are fine), no new dependencies, no changes to the prompt builder or tips, keep each phase to the Quiz/Progress tabs and the code they need. Every phase writes a handoff with the decisions made and a click-through list for the verifier.

## Phase 15 — Leave Lovable, go GitHub + Vercel (full design)

**Goal:** the project stops depending on Lovable's build wrapper and gets a real Git history, so every later phase (especially Phase 9, accounts) is a normal commit and a normal diff. Why, and what the wrapper does, is in the "Leave Lovable" notes in the later-items section below; the builder reads those first.

**Do first (the user, about ten minutes):**
1. Keep one untouched zip of the current project as the archive ("before leaving Lovable").
2. Confirm which package manager you really use (the project has `bun.lock`, but you run `npm`). Tell the builder: it must not leave two lockfiles disagreeing.
3. Create an empty GitHub repo (private is fine). Do not push yet.

**Builder tasks (one session, no feature work):**
1. Read the wrapper package's own docs first. The note below says there may be a documented way to choose your own target that is less work than rebuilding every plugin by hand.
2. Replace `@lovable.dev/vite-tanstack-config` in `vite.config.ts` with a plain Vite config on the underlying plugins (TanStack Start, React, Tailwind, tsconfig-paths, Nitro pinned to the `vercel` preset; drop the `process.env.VERCEL` conditional).
3. Remove `src/lib/lovable-error-reporting.ts` and its import in `src/routes/__root.tsx` (`reportLovableError`). Keep `error-capture.ts` and `error-page.ts` (generic, wired into `server.ts` / `start.ts`; do not edit those two files).
4. Remove the Lovable packages from `package.json`, and fix the lockfile for the package manager chosen above. Do not change any other dependency.
5. Check `.gitignore` covers `node_modules`, `.output`, `.wrangler`, `dist`, `.env*`, and that no key or secret is in any file.
6. Write `handoffs/phase-15.md` and update `context.md` (build/deploy section) and this plan.

**Checks (the user runs them; the builder must not guess results):** `npx tsc --noEmit`, `npm run build`, `npm run dev` and a click-through of the whole app (welcome, lessons, quiz, backup export and restore, Lesson Studio, music and atmosphere), then every script in `handoffs/` (11b, 13, 14a, 14b, 14d). Only if all of that passes: `git init`, first commit, push to the new repo, connect Vercel to it, and confirm the Vercel preview deploy matches `npm run dev`.

**After it works:** tag the first commit (for example `v-phase-15`). From then on each phase is one commit or branch, and the verifier can read `git diff` instead of unzipping builds (cheaper for credits).

**Phase 15b, README refresh:** rewrite the README from `context.md` (what Kiroku is, the three-step loop, backup, the review loop, how to run it, how to deploy). Remove the old "Japanese SRS" promise unless the new text matches the real review mode. One page.

**Constraints:** no feature, UI, backup or storage changes, and no new dependencies. If the new build behaves differently from the old one in any way a user can see, stop and tell the user.

### Verifier addendum to Phase 15 (read before building; checked against `Kiroku_latest14d.zip`)

**Verdict: approved, with the corrections below.** The plan is sound and smaller than it looks: outside Lovable's own sandbox the wrapper is just a list of ordinary plugins.

**What was actually tested** (scratch copy, sandbox, no browser): the config below replaces the wrapper. `npm run build` exits 0 and writes a valid `.vercel/output/` (Build Output v3: `config.json` with a long-cache rule for `/assets/` and a catch-all to `__server`, `functions/__server.func`, `static/`). `tsc --noEmit` is clean. `npm run dev` serves HTTP 200 on port 8080, with the Kiroku title and no "lovable" text in the page. **Not tested:** the click-through, every script in `handoffs/`, and the Gemini relay on a real deployed Vercel function. Those stay with the user, as written above.

**Reference config** (tested; the builder may start from it and must re-run the checks itself):
```ts
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Plain Vite config: the same plugins the Lovable wrapper assembled, minus its sandbox/preview/watchdog/manifest parts.
export default defineConfig({
  // Same dev address the wrapper used (localhost:8080), so nothing the user does changes.
  server: { host: "::", port: 8080 },
  css: { transformer: "lightningcss" },
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
      server: { entry: "server" },
      importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    }),
    nitro({ preset: "vercel" }),
    viteReact(),
  ],
});
```
The wrapper also added things that are deliberately left out: Lovable sandbox detection, its preview/asset proxy, the HMR gate, the build-exit watchdog, the route manifest, the dev-only TanStack devtools plugin and `VITE_*` env injection (Vite already does that natively, and the app reads no `VITE_` variables). `vite-tsconfig-paths` still works but Vite 8 prints a notice that `resolve.tsconfigPaths: true` can replace it; **leave the plugin in for this phase** (no change that isn't needed), it is a later one-line tidy.

**Corrections to the builder tasks:**
1. **Keep the dev address.** The wrapper sets `server: { host: "::", port: 8080 }`. Without it, `npm run dev` moves to port 5173, which is a user-visible change. The reference config keeps 8080.
2. **There is no `process.env.VERCEL` guard to drop.** `vite.config.ts` in this zip is the plain wrapper config (no guard, no `vercel.json`); `context.md` still describes a guard and a `vercel.json` that are not in the project. Fix `context.md` (the "`vite.config.ts`'s nitro preset" bullet) and the stale comment in `src/lib/gemini-relay.ts` (it mentions the guard). No `vercel.json` is needed: the Nitro `vercel` preset writes the whole Vercel output itself.
3. **`.gitignore` does not cover secrets or Vercel output.** Tested with a throwaway git repo: `.env`, `.env.production` and `.vercel/` are **not** ignored (only `.env.local` is, via `*.local`). Add `.env`, `.env.*` (keeping `!.env.example`), and `.vercel`. A scan of `src/`, `handoffs/`, `context.md`, `PLAN.md`, `README.md`, `vite.config.ts` and `package.json` found no API key.
4. **`bunfig.toml` still names Lovable packages** in `minimumReleaseAgeExcludes` (the wrapper and three others). Remove those entries with the packages. Keep the 24-hour guard itself.
5. **Delete the Lovable-era rule in the Phase 3c notes** ("do not put anything in `server.ts`/`start.ts` because Lovable inspects them") from `context.md` once the wrapper is gone; it no longer applies. The files themselves stay untouched, as the task list says.
6. **Re-check Gemini on the deployed function** (already noted in 3c): the worst-case model chain is about 225 s and Vercel Hobby allows 300 s. Test one real import on the Vercel preview URL, not just locally.

**Decisions recorded (the user, 2026-10-04):**
- **Package manager: `npm`** (the one the user runs and tests with). The builder deletes `bun.lock` and `bunfig.toml`, commits `package-lock.json`, removes it from `.gitignore`, rewrites the "Bun is the package manager" rule in `context.md`, and **re-runs every check afterwards**, because a freshly generated lockfile can resolve slightly different versions than the ones tested so far.
- **Repo: private** for the first push (user creates it empty).
- **Phase 15b (README):** done by the first verifier after Phase 15 passes, not by the builder.
- **Music files and backgrounds: decided by the user. `public/audio/` goes into the repo and the deployment as it is, and the player stays as built.** There is no builder task and nothing to ask about here.

**Decisions the user makes before the builder starts** (the builder must ask if they are not answered):
- **Package manager.** Your local tests use `npm`, but the repo has `bun.lock`. Vercel installs whatever lockfile it finds, so a mismatch means Vercel can build different versions from the ones you tested. Verifier's recommendation: **use the one you actually run.** If that is `npm`, the builder deletes `bun.lock` and `bunfig.toml`, commits `package-lock.json`, removes it from `.gitignore`, and rewrites the "Bun is the package manager" rule in `context.md`. If you want to keep Bun, the builder regenerates `bun.lock` (Bun is available in the builder sandbox), and you accept that your npm tests can drift from it.
- **Music files.** Decided by the user: `public/audio` stays in the repo and deploys with the app. Nothing to do or ask.
- **Phase 15b (README).** Verifier's recommendation: **do not bundle it into the builder's session.** Phase 15 is the risky one and should be small. The README is your story in your voice, so the refresh keeps your text as written and only updates the facts that are out of date (features, status, setup, the "Being built next" list). That is a short job for the verifier after Phase 15 passes, using `context.md` for what the app does and `handoffs/` for the dated history. The old "Japanese SRS" line is now fair to keep, since review mode (14b to 14d) is real.

## Notes on later/optional items

- **Tips polish (parked on purpose, decided by the user):** the current tip cards stay as they are for now. The "Three steps" card in the Studio is now about six lines long, which is the real thing to fix. The user's idea is a small guided bar with **Next** and **Skip all** that moves through the Studio options (Learn + Save, then Learn only, and so on). Verifier's view: a floating, pointing tour needs positioning code inside a scrolling modal on desktop and phone and is the fragile part. A cheaper version keeps the guidance **inside the same card** as short steps with Next / Skip all, and the save-mode step can add a highlight ring around the three mode buttons (no positioning code). It would reuse the stored `kiroku_tips_v1` dismissed flag. Only worth doing before showing Kiroku to new people; until then, just shorten the Studio text if it bothers you. Not scheduled.


**Welcome screen (Phase 11a) — agreed with the user.** This is the "first-run welcome" that was parked from the original spec, now with a firmer shape.

*Why:* today a brand-new visitor does not see an empty app. They land on **Day 13 with 13 sample days and seeded stats** (`initialProgress` in `index.tsx`: 4 quizzes, 34 correct). Those are the author's own lessons, not something a new user wants. A loadable sample course would also be actively harmful: the prompt builder feeds saved lessons and vocab back to the AI as "already known", so a new user who loaded sample Day 1 would be telling their AI they already know Day 1's words. So: **new visitors start empty and see a welcome panel. There is no sample course.** A screenshot in the panel shows what a lesson looks like without touching their data.

*What the user does before this phase (the builder does not do these):*
1. Takes a clean screenshot of a lesson (e.g. Day 13, Overview tab) **while the sample days still exist**, and saves it as `src/assets/images/welcome-lesson.webp`. Aim for about 200 KB or less; the four background JPEGs are already 0.7–1 MB each.
2. Generates several welcome-panel mockups with other tools (Lovable, Claude, others) and picks one. The pictures and the code come to the builder as **visual reference only**.
3. Approves the wording (a draft is below).

*Mockups are a reference, not code to paste.* Generated code will hardcode colours, may bring new libraries or animation packages, and won't know `GlassPane` or the tokens. The builder recreates the chosen design with the existing theme tokens only (`bg-glass`, `primary`, etc.), the existing `GlassPane`, and **no new dependencies**. The builder must ask which mockup was chosen and must not pick one.

*Trigger (as built, revised after user testing):* show the welcome panel whenever `lessons.length === 0`. **No stored flag** (the first build used `kiroku_welcome_v1`; it was removed because any button click hid the welcome for good even when nothing was imported). "Skip intro" only hides it for the current visit, using plain React state, so a refresh brings it back. That state is cleared whenever lessons exist. That rule means:
- existing users (saved lessons) never see it;
- someone who resets everything, or deletes the last day, sees the welcome again ("empty means welcome");
- a new user who restores a backup or imports a lesson leaves it automatically.
Do **not** detect a new user by empty progress.

*Removing the samples — three places in `src/routes/index.tsx`* (checked: `INITIAL_LESSONS` is imported nowhere else):
1. `loadLessons()`: its four fallbacks return `INITIAL_LESSONS`; they become `[]`.
2. `initialProgress`: it derives `completedDays` from the samples and carries `currentDay: 13`, five mastered ids and the seeded quiz stats. It becomes the empty shape. `emptyProgress` already exists, so use **one** constant for both instead of two near-copies. `loadProgress()` merges `{...defaults, ...saved}`, so existing users' saved progress still wins.
3. `useState(Math.min(13, INITIAL_LESSONS.length))` for the starting `day` becomes `1`.

Existing users' saved lessons and progress in `localStorage` are untouched. `src/data/initialLessons.ts` (902 lines) then has no importer. **Ask the user** whether to delete it or leave it unimported; the default is delete, once the user confirms they've kept the pre-11a zip as the archive (there is no git).

*Where the code goes:* a new `src/components/welcome/WelcomePanel.tsx`. `index.tsx` only decides which of `WelcomePanel` / `EmptyLessons` to render (it is already large; don't grow it). `EmptyLessons` stays as the "deliberately empty" screen.

*The main risk — hydration flash.* The app is server-rendered, and the loaders already read `localStorage` inside `useState` initialisers behind a `typeof window` guard, so the server render sees the fallback and the client sees the saved data. With samples gone the server fallback is `[]`, which means **the server HTML would contain the welcome panel for everyone**. An existing user must never see even a one-frame flash of it. The builder must gate the welcome and empty screens so they only render after the client has read storage (e.g. a `mounted` flag set in `useEffect`), and must test it: saved lessons in the browser, hard refresh, watch for a flash.

*Also verify (the user checks by hand where the builder can't click through):* a fresh browser with no `kiroku_*` keys shows the welcome panel; the Quiz and Progress tabs look sane with zero lessons and zero stats; "Build my first lesson" opens the Lesson Studio; after the first import the user lands on that day and the welcome never returns.

*Draft wording — the user must approve or change it:*
> **Welcome to Kiroku** · 記録
> Kiroku is a notebook for your Japanese. It doesn't teach — you learn from any AI you like (ChatGPT, Claude, Gemini…), and Kiroku remembers what you've learned so your next lesson never repeats or skips ahead.
> 1. **Build a prompt** — pick a day in the AI Lesson Studio.
> 2. **Paste it into your AI** and learn as usual.
> 3. **Paste the reply back** — Kiroku saves the lesson and quizzes you on it.
>
> Free, no account, no key needed. (Optional: add your own Gemini key to speed up saving; it stays in your browser.) Everything is stored in this browser only, so export a backup from the Progress tab now and then.
> [Build my first lesson] [Restore a backup] · Skip intro

Beside the text, the screenshot in a small token-styled frame with a caption like "What a saved lesson looks like."

*Buttons:* "Build my first lesson" calls the existing `onAI`; "Restore a backup" goes to the Progress tab (`onRestore`); neither hides the panel. "Skip intro" shows `EmptyLessons` for this visit only.

*Also in this phase:* add the new key to the key list in `context.md`, and add one line there saying new visitors now start empty (that file is the baseline every builder reads, so this counts as a foundational change). Flag, don't edit, any README mismatch.

*Not in scope:* the tip cards (11b), the prompt builder, Gemini code, the backup format (Phase 13), the Astra link, analytics, backend, accounts.

*Decisions for the user:* which mockup; the final wording; delete or keep `initialLessons.ts` (**still open** — and note Phase 13's `handoffs/phase-13-backup-check.ts` imports it as test data; see `handoffs/phase-13.md` before deleting); (decided after testing: the welcome shows whenever there are zero lessons, no stored flag). Open for 11b: what the Tips button does, since it can no longer "re-open" the welcome by clearing a flag.

**First-run tips (Phase 11b) — built together with Phase 12 (awaiting verifier); `handoffs/phase-11b.md` has as-built behavior. The section below is the agreed design brief.**

*Read first:* `PLAN.md`, `context.md`, `handoffs/phase-11a.md` (its verifier addendum explains why the welcome has **no stored flag**), then `handoffs/phase-13.md`. Rule 1 still applies after that.

*Why:* the app is easy if you know the system and confusing if you don't, most of all the AI-prompt flow (Lesson Studio). The welcome panel gives the overview; these help on the screens afterwards.

**Decisions (settled; the builder does not need to ask again):**
1. **The Tips button** is a small "?" icon button in the header, next to the AI (bot) and music buttons, same style, `aria-label="Help"`. It opens a short **help card** about the Lesson Studio flow (wording below). It does **not** touch the welcome panel and does not depend on any welcome state. It is available on every screen, with or without lessons.
2. **Tip cards** are small, dismissible, token-styled cards on **three** screens only: **Quiz, Progress, Atmosphere**. A fourth lives **inside the Lesson Studio's Configure step**. **Never** on the Lessons tab, and never on the welcome or empty-curriculum screens (that's where people are learning or being welcomed). The Studio card is fine even when the Studio was opened from the welcome's "Build my first lesson" (that is the best moment for it); the rule "never while the welcome is showing" is about the welcome *panel* itself, which only lives on the Lessons tab, so it holds automatically.
3. **Storage:** one new key, `kiroku_tips_v1` (add `tips` to `STORAGE_KEYS`; no legacy twin; no migration). Value: `{ "dismissed": ["studio", ...] }`. A card's "Got it" adds its id. The help card has a "Show tips again" button that empties the list. Read it behind the existing `mounted` gate (or only after mount) so a returning user never sees a one-frame flash of a card.
4. **Fixed ids:** `studio`, `quiz`, `progress`, `atmosphere`.
5. **Not included as separate cards:** "What Kiroku is" (the welcome already says it; it's the first line of the help card) and the Gemini key (the Studio's key field already carries its own explanation; the help card has one line).

**Approved wording** (the user delegated this; use as written, no edits unless something is factually wrong against the app, in which case flag it):

*Help card* — title **How Kiroku works**
> Kiroku is a notebook, not a tutor. You learn from any AI you like, and Kiroku remembers what you've been taught so the next lesson never repeats or skips ahead.
>
> **In the AI Lesson Studio (the robot button):**
> 1. **Configure** — pick the day and options, and one of three modes:
>    - **Learn + Save** (recommended): your AI teaches the lesson, then adds a small block at the end. Paste the whole reply back in step 3.
>    - **Learn only**: just the lesson, no block. Good for follow-up questions first.
>    - **Save only**: for a lesson you already learned. Paste its text into the optional box first, because a fresh AI chat can't remember it.
> 2. **Copy prompt** — paste it into any AI.
> 3. **Import** — paste the AI's reply back; you'll see a preview before anything is saved.
>
> AIs sometimes ignore parts of a prompt, for example by replying with only the data block and no lesson. If that happens, send the same prompt again. Turning on thinking (reasoning) mode, if your AI has one, often helps. *(Added in the 14c micro phase; see `handoffs/phase-14c.md`.)*
>
> No account and no key needed. Optionally, a Gemini key can fix a failed import or save from pasted text; it stays in this browser.
> [Open AI Lesson Studio] [Show tips again] [Close]

*Tip: Studio* (id `studio`, top of the Configure step) — title **Three steps**
> Configure, copy the prompt into your AI, then paste its reply back. Learn + Save is the easy one: you learn first, and the save block comes at the end. Use Save only when you already learned a day elsewhere. AIs sometimes skip parts of a prompt: if you get only the data block and no lesson, send the same prompt again. Turning on thinking (reasoning) mode, if your AI has one, often helps. The "?" button in the header explains it all again.

*Tip: Quiz* (id `quiz`) — title **Choose what to practise**
> Use This day, All days or Day range at the top. Questions come only from lessons you've saved in Kiroku.

*Tip: Progress* (id `progress`) — title **Back up now and then**
> Everything is stored in this browser only. Export saves a backup file; Restore replaces your lessons and progress with one (you'll be asked first). Export before you clear your browser data or reset.

*Tip: Atmosphere* (id `atmosphere`) — title **Pick a reading voice**
> Tap a voice at the bottom to hear a sample and keep it for reading Japanese aloud. The list can take a second to appear.

Each card: a "Got it" button that dismisses it for good. No "don't show again" checkbox is needed because dismissing already persists.

*Style:* theme tokens only, no new colours, no new dependencies, no animation beyond what `styles.css` already provides. Reuse the existing portal pattern from `ConfirmDialog` for the help card (it must be portaled to `<body>` for the same backdrop-blur reason). Cards must not push the page layout around on first paint.

*Also in this phase (bundled by decision):* the **day-after-Restore quirk** from the known-issues list. When `BackupControls` finishes a successful Restore, the shell's `day` must become the first restored lesson's `dayNumber` (give `BackupControls`/`ProgressView` an `onRestored(firstDay: number)` callback; the shell calls `setDay`). That is the only change allowed to Phase 13's code. If the restored list is empty, leave `day` alone.

*Files this phase touches:* `src/routes/index.tsx` (header "?" button, Tips state, the three screen cards, the restore callback), `src/lib/storage.ts` (new key), `src/components/ai/LessonStudio.tsx` (the Studio card only), a **new** `src/components/tips/` folder (e.g. `TipCard.tsx`, `HelpCard.tsx`, and a tiny `useTips` hook or helper for read/dismiss/reset). Keep `index.tsx` growth small: logic goes in the new folder.

*Tests / checks the builder can do:* `tsc`, `eslint` (real rules), `npm run build`; a pure test for the read/dismiss/reset helper if it is written as a pure function (corrupt stored JSON must read as "nothing dismissed", never throw). Browser-only things for the user/verifier: fresh browser shows cards on Quiz/Progress/Atmosphere and the Studio; "Got it" persists across refresh; "Show tips again" brings them back; no card flash for a returning user who dismissed all; "?" opens the help card on every tab including the welcome screen; Restore a backup that starts at Day 5 and check the header reads D5.

*Not in scope:* analytics, backend, accounts, changes to the prompt builder or Gemini code, the welcome panel, any new tip beyond the four.

*When Phase 9 arrives:* move `kiroku_tips_v1` into account data so it means "first time in an account."

**Backup safety (Phase 13) — built (awaiting verifier); see `handoffs/phase-13.md` for as-built behavior. The section below is the original design brief.**
- *What's wrong today (checked in `ProgressView`):* export writes `{lessons, progress}` with no version. Restore does `JSON.parse`, then `if (d.lessons) setLessons(d.lessons); if (d.progress) setProgress(d.progress)`, inside a `catch` that swallows errors silently. There is no validation, no confirmation and no feedback. A file whose `lessons` isn't an array, or whose `progress` is missing fields, is accepted and can crash or corrupt the app; a good file silently overwrites everything with no "are you sure". The welcome panel's "Restore a backup" button makes this path the first thing a new-device user touches.
- *Export:* `{ app: "kiroku", version: 1, exportedAt: <ISO string>, lessons, progress }`. Same filename (`kiroku-backup.json`). **Never include the Gemini key** (BYOK rule; backup files get shared and emailed). Music, AI-studio and voice settings are not in v1 unless the user says otherwise.
- *Restore:* put the logic in a pure function, e.g. `parseBackup(text)` in a new `src/lib/backup.ts`, returning `{ ok: true, data } | { ok: false, message }`, so it can be tested without a browser. It should:
  - accept the old unversioned `{lessons, progress}` files as version 0 (the user already has these);
  - reject a `version` newer than the app knows, with a plain message ("made by a newer Kiroku");
  - validate `lessons` with the existing `dayLessonSchema` from `src/lib/lesson-schema.ts` (reuse it, don't copy it) and `progress` with a new zod schema mirroring `UserProgressState`, filling missing newer fields from the default progress;
  - never touch the app's state on failure.
- *In the UI:* an in-app message for errors (no `window.alert` / `window.confirm`; Phase 3d moved off those), then an in-app `ConfirmDialog` before replacing, showing counts ("Replace your 12 days with the backup's 20 days?"), then a short success message.
- *Rule going forward:* any later change to the lesson or progress shape bumps `version` and adds a migration step in `backup.ts`.
- *Files:* new `src/lib/backup.ts`; `src/routes/index.tsx` (only `ProgressView`'s export/restore controls); read-only `src/lib/lesson-schema.ts` and `src/types/japanese.ts`. Update `context.md`'s "README says export has no version field" bullet when done.
- *Test with:* a legacy unversioned file, a versioned file, garbage text, `lessons` that isn't an array, a progress object with a missing field, and a file with a too-new version.
- *Not in scope:* SRS data, accounts, automatic or scheduled backups, extra settings.
- *Decisions for the user:* whether music / voice / AI-studio settings should ride along in a later version.

**Astra-chan mention (Phase 12) — built with 11b (awaiting verifier). Placement and wording below are a proposed default; the user has not changed them.** One quiet line with a link to `https://astra-kanji-tutor.vercel.app` (checked live; the page is titled "Learn with Astra-chan"). Rules so it stays un-annoying: a static line, never a popup, banner, badge or nag; **not** on the Lessons or Quiz screens (that's where people are studying); no storage, no dismiss needed. Open in a new tab (`target="_blank" rel="noopener noreferrer"`).
- *Placement (proposed default):* at the very bottom of the **Atmosphere** tab, under the voice card, as a small muted line outside the glass panes' main content (a plain `<p>` in the same width container). The Progress tab is the fallback if Atmosphere feels wrong once seen.
- *Wording (proposed default):* `Also by me — Learn with Astra-chan, another Japanese-learning app.` where "Learn with Astra-chan" is the link. Use the `Atmosphere` placement and this text unless the user says otherwise before or after the build; it is trivially changeable (one string).
- It is **not** a tip card (no dismiss, not in `kiroku_tips_v1`). The proper two-way version is Phase 10.

**Particles (Phase 7, optional):** Astra-chan already owns snow/sakura/sparkles/rain/runes — copying that set would make Kiroku feel like a reskin. Since Kiroku's identity is "Moonlit Moss" glass panels (and the original working title was *Komorebi*, sunlight through leaves), a smaller, distinct set fits better: drifting fireflies or soft light motes for the night mood, and maybe a slow leaf-drift as a callback to the old name. I'd keep it to one or two signature effects rather than Astra's full wardrobe, so the two apps stay visually distinct.

**Rebrand (Phase 4) — ✅ built, see `handoffs/phase-4.md`. Original scope kept for reference:**

*Icon:* nothing for the builder to do. The only place an icon is used is `<link rel="icon" href="/favicon.ico">` in `src/routes/__root.tsx`; the app header is text only, and `components/ui/avatar.tsx` is an unused stock component. The user replaces `public/favicon.ico` by hand. (The current file is a 1.8 MB, non-square PNG named `.ico`. A small square image, ~256×256, is better. Browsers cache favicons hard, so hard-refresh after swapping.)

*Names the builder changes:*
- `__root.tsx`: `title` and `author` meta ("Komorebi" → "Kiroku").
- `index.tsx`: the route `title` and `og:title` ("Komorebi — Japanese Study Desk").
- Export filename `komorebi-backup.json` → Kiroku equivalent.
- `README.md` is the user's story: **flag** mismatches, don't rewrite it.

*Decision needed from the user before building:* the app header currently shows `木漏れ日 STUDY DESK` (木漏れ日 is *komorebi* in Japanese). Options: keep it as a subtitle, change to `記録 STUDY DESK`, or use `Kiroku` in Latin letters. The builder should ask, not pick.

*Storage keys — five, each needs a one-time migration* (on load, if the new key is empty but the old one has data, copy it over; leave the old one in place, don't delete). Otherwise saved days and settings silently vanish:
| Old key | File |
|---|---|
| `komorebi_progress_v2` | `src/routes/index.tsx` |
| `komorebi_lessons_v1` | `src/routes/index.tsx` |
| `komorebi_ai_studio_v1` | `src/components/ai/LessonStudio.tsx` |
| `komorebi_gemini_key_v1` | `src/components/ai/LessonStudio.tsx` (the user's Gemini API key: migrate it too, or they must paste it again) |
| `komorebi_music_v1` | `src/components/music/MusicPanel.tsx` |

Never write an API key into a file; the migration only copies between localStorage keys in the browser.

**Cleanup (Phase 5) — ✅ done, see `handoffs/phase-5.md`. Original notes kept for reference:**
- `AGENTS.md` is ~90% Lovable git-sync boilerplate (a warning about not rewriting published git
  history — irrelevant, since there's no git repo connected right now) plus exactly one line of
  real, still-relevant content: *"Keep the experience as a single full-screen study desk with
  URL-independent in-app modes; these modes share persistent lesson state and atmosphere."*
  That one sentence should move into `context.md`'s non-negotiables before this file gets deleted
  — don't just delete the whole thing outright.
- `package-lock.json` sitting alongside `bun.lock` is very likely a stray artifact from some AI
  session running `npm install` in an npm-based sandbox, not an intentional dual-package-manager
  setup — this project's actual package manager is Bun (`bunfig.toml`, `bun.lock`, and the
  README's own tech stack table all agree). It isn't in `.gitignore` either, so left alone it
  would get committed to GitHub as-is and could silently drift out of sync with `bun.lock` if a
  future session runs `npm install` again instead of a Bun command. Delete it, and add
  `package-lock.json` to `.gitignore` so it doesn't quietly reappear.

**Phase 9 (Accounts):** flagging now because it changes more than it sounds like — moving off pure `localStorage` touches the music player, the SRS progress, the voice preference, and the `kiroku_tips_v1` first-run flag all at once. Phase 13 (versioned, validated backups) should land first, because accounts and sync need a trustworthy file format to fall back on. When we actually start it, it should get its own short design pass rather than being squeezed into this plan.

**Leave Lovable & go GitHub/Vercel-only (unnumbered milestone, triggered by you, not scheduled):**
`vite.config.ts` currently imports `@lovable.dev/vite-tanstack-config`, which — per its own
README — does considerably more than default the build to Cloudflare: it also shapes Lovable's
sandbox preview server (host/port/HMR coordination), runs a build-exit watchdog, and generates a
route manifest Lovable's own serving layer reads. As long as this project might still get bounced
back into Lovable's own environment for further edits, replacing this wrapper risks breaking that
environment for a benefit that only matters once you've actually left it. When
you're genuinely ready to commit to GitHub: replace the wrapper with a bare `vite.config.ts` built
directly on the underlying plugins (TanStack Start, React, Tailwind, tsconfig-paths, Nitro pinned
permanently to the `vercel` preset — no more `process.env.VERCEL` conditional needed once Lovable
is out of the picture entirely), re-verify `tsc`/`eslint`/`npm run build` still pass, and only then
push to GitHub and connect Vercel via Git for auto-deploy. Also at that point: `src/lib/lovable-error-reporting.ts` is Lovable-only (imported by `src/routes/__root.tsx` via `reportLovableError`) and should be removed together with the wrapper — not before. `error-capture.ts`/`error-page.ts` are wired into `server.ts`/`start.ts` and are generic enough to keep. The wrapper's own README claims it
"still lets self-hosted projects choose their own target" — worth re-reading that package's full
docs at that time before assuming a full manual rewrite of every plugin is necessary; there may be
a documented escape hatch that's less work than reconstructing everything by hand.
