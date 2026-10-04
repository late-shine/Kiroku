# context.md — read this in full before touching anything

This file is the baseline every implementing AI needs *regardless* of which phase you're
assigned. PLAN.md tells you what to build; this file tells you what you're building it
inside of, and what will quietly break if you don't know it going in. Read this in full —
it's short on purpose. PLAN.md's Rule 1 ("read only the phase's files") only makes sense
once this context is loaded; without it, a narrow file list is just a blind spot.

## What Kiroku is, in one paragraph
Kiroku is a personal Japanese-learning SRS. It does not teach. The user learns from
whatever AI they paste a Kiroku-generated prompt into (ChatGPT, Claude, Gemini, whatever);
Kiroku's job is to remember what's already been taught (so the next prompt doesn't repeat
or skip ahead), store the structured result, and quiz/review it. If a phase's spec ever
seems to be asking you to make the app "teach" something itself, that's very likely a
misread — flag it rather than build it.

## ⚠️ README.md is the story, not the spec — it runs slightly ahead of the code
The README is the user's human-facing story and it partly describes *intended* behavior, so
some of it is a bit of an assumption. **When README and code disagree, the code is the truth
for what exists today, and PLAN.md is the truth for what's in scope.** Don't "fix" the code to
match a README sentence, and don't silently edit the README either — flag the mismatch.
Known ones right now:
- README says the prompt "introduces itself as Kiroku... by name." In reality Kiroku is only
  named in the `learn-save` bridge sentence, the `save-only` prompt, and the in-app mode hints.
  The opening framing (everything before `=== TODAY'S LESSON REQUEST ===`) and `learn-only`
  don't mention it — Phase 3b was deliberately scoped to leave that part untouched.
- README says quiz and review cover "whichever day (or days)." The quiz now has a This day / All days /
  Day range toggle (Phase 6), and since Phase 14a a quiz is a *round* (10/20/all words, score, missed list, retry), and since Phase 14b every answer updates a per-word Leitner record (`progress.vocabMemory`, `src/lib/word-memory.ts`) and the quiz has a **Due today** scope (plus a due-count badge on the Quiz tab, capped at "99+"). **Calm intake (Phase 14b-fix): a word is in review only if it has a record**, which it gets when the user adds it (the "+" on a word or "Add this day's words to review (N)" on the Vocab tab), answers it in any quiz, or misses it. An untouched word is just lesson content and is never due, so a restored course starts with 0 due. Due rounds ask the most overdue words first. Marking a day Done does **not** add its words. The star ("I already know this") is separate from review. Since Phase 14d a Due today round asks each word the way its box earns (boxes 1–2 pick the meaning, box 3 choose the Japanese word, boxes 4–5 type the reading in kana; practice scopes stay plain), and a **Question style** row (By progress / Meaning / Choose the word / Type the reading) can force one style in any scope. A round asks each *word* (same Japanese + reading, even under two ids) once. There is still no separate Review *tab* — Due today is the review mode. `weakVocabIds` (quiz misses) is independent of the boxes.
- README says "export/import everything as one file." Since Phase 13 the export is
  `{app, version, exportedAt, lessons, progress}` (`src/lib/backup.ts`) and Restore is validated and confirmed,
  but it still carries no music, AI-studio, voice or Gemini-key settings (the key must never be added).
  (The filename is `kiroku-backup.json`.)
- README's stack table still says the package manager is Bun and its AI-tools text predates Phase 15. Both are fixed in Phase 15b
  (the README refresh), not by a builder phase.
- README's "being built next" list will go stale quickly (the prompt rewrite it lists is
  already done). Check `handoffs/` and PLAN.md's status table for what's actually current.

## Naming: the rebrand is done (Phase 4)
"Kiroku" is the name everywhere now. The app was originally called Komorebi, and Phase 4 renamed
the page titles, the header (now `記録 STUDY DESK`), the export filename and every `localStorage` key
(see `src/lib/storage.ts`). The old `komorebi_*` keys appear in the code in exactly one place —
`LEGACY_STORAGE_KEYS`, read once by the migration — and must never be written to. Use
`STORAGE_KEYS` for any new storage. Still true: don't rename things beyond what a phase's scope
says — that's the kind of unscoped drift Rule 1 exists to prevent.

## New visitors start empty (Phase 11a)
There is no sample course any more. `src/routes/index.tsx` loads `[]` (not the 13 sample days) and
an all-zero progress shape; `src/data/initialLessons.ts` is kept on disk purely as an archive and is
imported nowhere. Whenever the curriculum is empty (a new visitor, a reset, or every day deleted), the Lessons tab shows
`src/components/welcome/WelcomePanel.tsx`; its "Skip intro" button swaps in `EmptyLessons` for the current
visit only (plain React state, nothing stored, so a refresh brings the welcome back). There is no
"welcome seen" flag in `localStorage` (one existed briefly during 11a and was removed). Because the server render now always sees zero lessons, both screens are gated behind a `mounted`
flag so an existing user never flashes the welcome panel.

## Backup format is versioned (Phase 13)
`src/lib/backup.ts` owns the export shape and `parseBackup()` (pure, no browser needed). **Any change to
`DayLesson` or `UserProgressState` must bump `BACKUP_VERSION` and add a step to `MIGRATIONS` there**, so older backup files
keep restoring. Old unversioned `{lessons, progress}` files are version 0 and still load. Restore checks the *shape* of
saved lessons, not the stricter AI-import bar (so days with fewer than 3 grammar examples still restore). Never put a
key or setting in the export that the BYOK rule forbids.
**Current format: v2** (Phase 14b added `progress.vocabMemory`; v0/v1 files restore with an empty memory).

## Non-negotiables (don't change these without flagging it first)
- **The product shape:** a single full-screen study desk with URL-independent in-app modes
  that share persistent lesson state and atmosphere. (Carried over from `AGENTS.md`, which Phase 5
  removed — this was the one line in it that was real.)
- **Manual copy/paste is the permanent, zero-key default path.** Every AI-key-powered
  feature (Gemini "Generate," repair-on-failure, etc.) is strictly additive on top of it,
  never a replacement. If a change would make the app require a key to function at all,
  stop and ask.
- **API keys are BYOK, client-side only.** Live in `localStorage`, entered by the user into
  a settings field, never hardcoded, never committed, never persisted server-side. A server
  route may relay a request per-call but must not store the key.
- **Styling is token-only** — everything comes from `src/styles.css` (`bg-glass`,
  `bg-glass-strong`, `primary`, `success`, `destructive`, etc.). Never hardcode a color.
  Aesthetic is "Moonlit Moss": translucent glass panels, scenery always visible behind them,
  Libre Baskerville (display) + IBM Plex Sans (body). Reduced-motion is already handled
  globally in `styles.css` — don't re-solve it per component.
- **`noUncheckedIndexedAccess: true` is on** (see `tsconfig.json`), along with
  `exactOptionalPropertyTypes` and `noPropertyAccessFromIndexSignature`. Plain `array[i]`
  with a variable `i` types as `T | undefined`, even for a fixed-length array. Use a safe
  accessor (see `trackAt()` in `src/lib/tracks.ts`) instead of `!` littered everywhere. For
  optional inputs, follow the existing pattern: a required `string` that defaults to `""`
  (like `customFocus`), or a JS default parameter, rather than `?:` on an object field.
- **npm is the package manager** (decided by the user, 2026-10-04, Phase 15). `package-lock.json` is the one
  lockfile and **is committed**. There is no `bun.lock` and no `bunfig.toml` any more. Do not add `bun.lock`,
  `yarn.lock` or `pnpm-lock.yaml`: a second lockfile silently drifts from the first. Install with `npm install`
  (or `npm ci` for a clean, exact install).
- **Build and deploy (Phase 15: Lovable is gone).** `vite.config.ts` is a plain Vite config on the ordinary plugins
  (Tailwind, tsconfig-paths, TanStack Start with `server: { entry: "server" }` so `src/server.ts` is the SSR entry,
  Nitro pinned to the `vercel` preset, React). The dev address is still `localhost:8080`. There is no `vercel.json` and no
  `process.env.VERCEL` guard: the Nitro `vercel` preset writes the whole Vercel output (`.vercel/output/`) itself, so
  `npm run build` always targets Vercel. Do not reintroduce a Lovable package. `vite-tsconfig-paths` still works; Vite 8
  prints a notice that `resolve.tsconfigPaths: true` could replace it. That is a later one-line tidy, not part of any
  other phase. `src/server.ts` and `src/start.ts` are generic now (the old "Lovable inspects them" restriction no longer applies).
  Deploy path: push to GitHub, Vercel (connected to the repo) builds with `npm run build`. The Gemini relay runs as a Vercel Function;
  its worst-case model chain is about 225 s and Vercel Hobby allows 300 s.
- **Git (from Phase 15).** The project is a git repo from Phase 15's first commit, pushed to the user's private GitHub
  repo `late-shine/Kiroku`; before that there was no history. Still copy a file before a risky edit if you are working
  from a zip. The user still relays files between AI sessions manually (builder and verifier sessions have no shared
  live repo access); once the repo is live, `git diff` between phases replaces unzipping builds.
- **`extractJsonBlock()` (`src/lib/lesson-schema.ts`) already searches the whole reply**
  for a fenced ` ```json ` block, falling back to first-`{`-to-last-`}`. Prose before or
  after the JSON has never broken imports — this is *why* Phase 3b's teach-then-save prompt
  rewrite was a pure wording change, not a parser change. Don't "fix" the parser to justify
  a prompt change; check whether it's already handled first.
- **`save-only` must never rely on "our conversation above" alone.** A fresh AI chat (including
  the "Open Gemini/ChatGPT/Claude" links, which always start empty) has no memory of what was
  taught elsewhere, and can fabricate a plausible lesson instead of saying so. That's why
  `buildSaveOnlyPrompt` takes optional `existingLessonText` and carries an explicit
  "if you don't have it, stop and ask" guard. The Gemini "Save with Gemini" path (Phase 3c, built) only runs when the user has pasted the lesson text,
  and its result still goes through the preview card.

## File map (pointers, not exhaustive — see PLAN.md's phase section for what to actually open)
- `PLAN.md` — roadmap, phase specs, status table. `handoffs/phase-<id>.md` — what each finished
  phase actually changed. Read the handoffs for as-built behavior; PLAN.md sections for
  finished phases are the original design brief and may differ.
- `src/routes/index.tsx` — the shell. All top-level state (lessons, progress, current day/tab)
  lives here and gets threaded down as props. No router-level code-splitting yet.
- `src/components/quiz/QuizView.tsx`, `round.ts` — the quiz (Phase 14a): state/markup and the pure round logic (checked by `handoffs/phase-14a-quiz-check.ts`). Phase 14d added question kinds (`recognise` / `choose` / `type`) to `round.ts`, the typed-reading rules in `typed-answer.ts` (pure; NFKC, katakana = hiragana, multi-reading, IME-safe Enter), and the answer box `TypedAnswer.tsx` (checked by `handoffs/phase-14d-quiz-check.ts` and `phase-14d-quiz-ui-check.tsx`).
- `src/lib/word-memory.ts` — Leitner boxes, due dates, mastery rules, the record schema, and since 14b-fix the review-intake helpers, and since 14c `dueWordsInOrder` (the due list in a fixed order, no shuffle, for the prompt) (`isInReview`, `addToReview`, `notInReview`, `reviewCount`, `badgeText`). Checked by `handoffs/phase-14b-memory-check.ts` and `handoffs/phase-14b-fix-check.ts`.
- `src/components/lesson/VocabList.tsx` — the Lessons Vocab tab: word list, star, and the Add-to-review controls (Phase 14b-fix; moved out of `index.tsx`).
- `src/lib/backup.ts` — backup export/restore format, version and validation (Phase 13).
- `src/components/tips/` — first-run tip cards, the header "?" help card and the one hook (`useTips`) that touches `kiroku_tips_v1` (Phase 11b). All tip wording lives in `tips.ts`.
- `src/types/japanese.ts` — `DayLesson`, `VocabWord`, `UserProgressState`, etc. Source of
  truth for shape; `src/lib/lesson-schema.ts`'s zod schema mirrors this by hand (not derived
  from it), so a type change here needs a matching schema change.
- `src/lib/tracks.ts`, `src/components/music/MusicPanel.tsx` — the 8-song player (Phase 1, extended in Phase 6;
  a song may lack a speed version — see `handoffs/phase-6.md`).
- `src/lib/prompt-builder.ts`, `src/lib/lesson-schema.ts`, `src/components/ai/LessonStudio.tsx`
  (Phase 14c: the Learn prompts also carry a "Words due for review" paragraph — up to `REVIEW_PROMPT_CAP` = 10 due words
  from EARLIER days, most overdue first, built by `reviewWordsForPrompt`; the Studio shows how many. Save only never has it.
  Approved wording (by the user, 2026-10-03), in one place: `reviewSummary` inside `priorKnowledgeBlock`.)
  — the AI Lesson Studio: Configure → Copy prompt → Import, with three prompt modes
  (`learn-save` default, `learn-only`, `save-only`).
- `src/lib/voice.ts`, `src/components/voice/VoicePicker.tsx` — text-to-speech (Phase 8). `speak()` lives in `voice.ts` (it used to be
  at the bottom of `index.tsx`) and reads the saved voice on every call. The picker is rendered at the bottom of the Atmosphere tab.
- `src/styles.css` — every design token. `--destructive` was added in Phase 1 alongside the
  pre-existing `--success`, following the same pattern — if you need a new semantic color,
  that's the precedent to follow, not a one-off hardcoded value.
- Each major component keeps its own versioned `localStorage` key as a local constant.
  **Actual keys in the code today** (all defined in `src/lib/storage.ts` → `STORAGE_KEYS`):
  `kiroku_progress_v2`, `kiroku_music_v1`, `kiroku_ai_studio_v1`, `kiroku_gemini_key_v1`,
  `kiroku_tips_v1` (added Phase 11b: `{"dismissed": [tip ids]}`, no legacy twin; Phase 9 should fold it into account data), `kiroku_lessons_v1` (added Phase 3d —
  `lessons` didn't persist before this; see that phase's handoff). `kiroku_voice_v1` (added Phase 8: the chosen
  TTS voice's `voiceURI`, `""`/absent = Automatic; it has no legacy `komorebi_*` twin, so `LEGACY_STORAGE_KEYS` has no entry for it). (The original spec proposed a `_v3` progress key with a migration;
  that was never built — don't assume v3 exists.) A schema change to any of them needs a
  migration-on-load (check new key empty → check old key → copy over), not a silent rename,
  or existing users lose their saved days.

## What's actually confirmed working (by the user, in the real running app — not just a clean build)
- Music player: all 12 tracks, speed-switching, screenshot-confirmed.
- The AI Lesson Studio round trip with a real AI: Configure → Copy prompt → paste into Gemini →
  Gemini teaches normally, adds the bridge sentence, then the JSON → paste back → Import. Confirmed
  with real Day 14 lessons, including after the Phase 3b prompt rewrite.
- `save-only` guard: ChatGPT, given the save-only prompt in a chat that never taught Day 14,
  declined to invent it and asked for the lesson text instead — exactly the intended behavior.
- Pasting non-JSON text into Import is handled cleanly (a "no JSON found" error, no false import).
- Quiz scoped to the selected day, and the furigana / on'yomi / kun'yomi fixes (Phase 3a): the
  user reported the updated app works cleanly. (No separate screenshot of the Kanji tab specifically.)
- Gemini smart import (Phase 3c): "Fix with Gemini" on a failed import and "Save with Gemini" for save-only, with
  a 5-model fallback chain and a "tried X → Y" trail. Live-tested by the user (Day 14 in ~40s). There is no
  one-click "Generate" button, by design. The Gemini key lives in `localStorage["kiroku_gemini_key_v1"]`
  (now `kiroku_gemini_key_v1`, migrated in Phase 4). Repair uses the `dayNumber` found in the pasted text, falling back to
  step 1's day (Phase 3c2).
- Delete a day / reset all progress (Phase 3d, built, extended in 3d2): the curriculum list has a
  "Select" mode for multi-day delete alongside the per-row trash icon, both going through the same
  in-app `ConfirmDialog` (no `window.confirm` remains in this flow). `ProgressView` separately has a
  type-"reset"-to-confirm control next to Export/Restore. Deleting any set of days also strips
  their `d{day}-*` ids out of `masteredVocabIds`/`weakVocabIds`. Deleting the last remaining day (or
  resetting) leaves a real empty-curriculum screen now, not a blank page — see the migration note
  above.

## A sandbox limitation worth knowing before you trust your own testing
Browser-based E2E (Playwright, screenshots) may simply not be available in your sandbox's
network allowlist — it wasn't in at least one prior session. `tsc --noEmit`, `eslint`, and
`npm run build` are reliable; a real browser click-through is not something to assume you
can do yourself. Say so plainly if you hit the same wall rather than spending a lot of turns
fighting it — the user (or the verifier pass) will confirm visual/interaction correctness.

## How this project's multi-AI setup works
One session builds a phase, writes files + `handoffs/phase-<id>.md`, and stops. The user
manually carries those files to a second, **verifier** session, which checks the diff against
what the phase actually asked for (no more, no less), runs the same clean-build checks, and
confirms (or sends specific, itemized fixes back) before the user carries it forward again.
Small, well-contained fixes can be made directly by the verifier. This file should be updated by
whoever notices it's gone stale — not every phase, only when something foundational actually
changes (a rebrand landing, a new non-negotiable convention, a schema migration) — not a running
diary. That's what `handoffs/` is for.
