# Handoff — Phase 4: Rebrand (Komorebi → Kiroku)
Date: 2026-09-30

## Summary
The code now says Kiroku everywhere it used to say Komorebi, and existing users keep their data
through a one-time `localStorage` migration. The user chose the header text: **`記録 STUDY DESK`**.
Tested this time (the user allowed it): `tsc --noEmit` passes, ESLint reports no real errors, and
`vite build` succeeds. The migration helper was also run against a fake `localStorage` (10 checks,
all pass). Not tested in a browser: the header and tab title should be eyeballed.

## Files changed
- `src/routes/__root.tsx`: `<title>` and `author` meta → "Kiroku".
- `src/routes/index.tsx`: route `title` and `og:title` → "Kiroku — Japanese Study Desk"; header
  木漏れ日 → 記録 (the "study desk" label beside it is unchanged and already uppercased by CSS);
  export filename `komorebi-backup.json` → `kiroku-backup.json`; progress/lessons keys now come from
  `STORAGE_KEYS`; `migrateLegacyStorage()` runs before both initial reads.
- `src/components/ai/LessonStudio.tsx`: AI-studio and Gemini-key keys come from `STORAGE_KEYS`;
  migration runs before both reads; "Remove key" now also removes the old Komorebi copy (see below).
- `src/components/music/MusicPanel.tsx`: music key comes from `STORAGE_KEYS`; migration before the read.
- `context.md`, `PLAN.md`: naming section, storage-key list, status row, and two stale known-issue lines.

## Files added
- `src/lib/storage.ts`: `STORAGE_KEYS` (new), `LEGACY_STORAGE_KEYS` (old, read-only) and
  `migrateLegacyStorage()`.
- `handoffs/phase-4.md`: this note.

## Data/schema changes
Five keys renamed with a one-time copy migration (nothing deleted):

| Old | New |
|---|---|
| `komorebi_progress_v2` | `kiroku_progress_v2` |
| `komorebi_lessons_v1` | `kiroku_lessons_v1` |
| `komorebi_ai_studio_v1` | `kiroku_ai_studio_v1` |
| `komorebi_gemini_key_v1` | `kiroku_gemini_key_v1` |
| `komorebi_music_v1` | `kiroku_music_v1` |

A sixth key, `kiroku_storage_migrated_v1`, is a marker meaning "the migration already ran in this
browser". The migration copies an old value only if the new key is empty, then sets the marker.
Nothing about the data's shape changed. The API key is only ever copied between browser keys; it is
not written to any file or sent anywhere.

## Behavior changes
- Tab title, share title, header and export filename say Kiroku / 記録. Old exports named
  `komorebi-backup.json` still import fine (the importer never looked at the filename).
- **The marker is deliberate.** Without it, anything the user clears on purpose would come back from
  the old key on the next load (e.g. removing the Gemini key). With it, old keys are read exactly once.
- **Small addition beyond the plan:** the old Komorebi keys are left in place as the plan asked, but
  that would leave a copy of the Gemini API key behind after the user presses "Remove key". So
  `removeGeminiKey` now clears the old key as well. Other old keys are untouched.

## What the next phase should know
- Use `STORAGE_KEYS` from `src/lib/storage.ts` for any new storage key and add the migration there
  if you ever rename one. Never write to `LEGACY_STORAGE_KEYS`.
- Old `komorebi_*` values stay in users' browsers forever (harmless, small). A future cleanup could
  delete them once the user is sure no rollback is needed; that is their call.
- `public/favicon.ico` is the user's manual swap and is not in this zip. Browsers cache favicons, so
  hard-refresh (Ctrl+Shift+R) after replacing it.
- **README.md was not edited**, per `context.md`. I grepped it and it has no "Komorebi" or 木漏れ日
  text, so nothing there is left over from the old name. It is still stale in other ways (12-track /
  4-song music text, "being built next" list); the user said they will update it after everything.
- Lint: `eslint` on the changed files reports 0 real errors but many `prettier/prettier` formatting
  errors. These are the existing dense one-line style, not new: `index.tsx` has 185 before and after.
  Don't run `--fix` inside a feature phase; it would rewrite whole files.
- Still open: SRS review mode, first-run welcome and a versioned full backup have no phase number.
  Phase 7 (atmosphere/particles) and 8 (voice) are optional.

## What I did NOT touch
- `README.md`, `public/`, `vite.config.ts`, audio, prompts/Gemini code, quiz and music behavior.
- `package.json` (its `name` field was not "komorebi", so nothing to rename) and `bun.lock`.
- No `package-lock.json` was created; the sandbox install used `--no-package-lock`.
