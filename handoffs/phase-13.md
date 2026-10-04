# Handoff — Phase 13: Backup safety (versioned export, validated restore)
Date: 2026-10-01

## Summary
Export now writes a versioned file and Restore no longer trusts whatever it is given. All checking lives in a
new pure module, `src/lib/backup.ts`; the Progress tab's controls show the result through in-app messages and
a ConfirmDialog with day counts. A bad file never touches app state. Old unversioned `{lessons, progress}` files
(everything the user has exported so far) still restore.

## Files changed
- `src/routes/index.tsx`: `ProgressView` lost its inline `exportData` / `importData` and the two buttons; it now
  renders `<BackupControls .../>` in their place. New `BackupControls` component added just above `ResetControl`
  (export, file picker, error/success line, ConfirmDialog). New import from `@/lib/backup`. Nothing else in the
  file changed (`ConfirmDialog`, `emptyProgress`, `ResetControl`, shell state all reused as-is).
- `context.md`: new "Backup format is versioned" section, new file-map line, README-mismatch bullet updated.
- `PLAN.md`: 11a marked verified; Phase 13 row/section marked built; stale "no version field" wording fixed.

## Files added
- `src/lib/backup.ts`: `BACKUP_VERSION` (1), `buildBackup()`, `parseBackup(text, defaultProgress)`, `MIGRATIONS`.
- `handoffs/phase-13-backup-check.ts`: 38 no-browser test cases for `parseBackup` (see "How it was tested").
  Run: `npx tsx --tsconfig tsconfig.json handoffs/phase-13-backup-check.ts`. Sits outside tsconfig's `include`.

## Data/schema changes
- Export file: `{ app: "kiroku", version: 1, exportedAt: <ISO>, lessons, progress }`, same filename
  `kiroku-backup.json`. No Gemini key, no music / AI-studio / voice settings.
- No `localStorage` key added or changed; no migration of stored data.
- Backup versions: v0 = old unversioned file (accepted), v1 = current. Newer than v1 is refused.

## Behavior changes
- Export: same button; file now carries `app`/`version`/`exportedAt`.
- Restore (picking a file) now: parse → on failure show a red in-app message and change nothing → on success open a
  ConfirmDialog ("Replace your N days with the backup's M days?", plus the export date if the file has one) →
  on Replace, set lessons + progress and show a green "Restored M days" line. Cancel changes nothing.
- Refused with a plain message: not JSON, not an object, another app's file, too-new version, bad version number,
  `lessons`/`progress` missing or wrong type, any damaged lesson (named by day, first 3 problems then "and N more"),
  duplicate day numbers, a progress field with the wrong type.
- Accepted: missing progress fields (filled from `emptyProgress`), an empty `lessons` list, lessons in any order
  (sorted by day on restore), unknown extra keys (silently dropped, never stored).
- The same file can be picked twice in a row (the input is reset after each pick).
- Restore never writes to the legacy `komorebi_*` keys; it only calls the existing `setLessons`/`setProgress`.

## What the next phase should know
- **Rule going forward (also in `context.md`):** any change to `DayLesson` or `UserProgressState` bumps
  `BACKUP_VERSION` and adds a `MIGRATIONS` step. `fillProgress()` is written field by field on purpose: adding a
  field to `UserProgressState` makes `backup.ts` fail to compile until it is handled.
- **Restore uses a looser lesson schema than AI import.** `restoredLessonSchema` = `dayLessonSchema` with the
  "at least 3 grammar examples" minimum removed. Reason (measured, not guessed): 11 of the 13 archived sample days
  have fewer than 3 examples, so with the strict schema the user's own older backups would have been refused.
  Everything else is reused from `lesson-schema.ts` (nothing copied). `lesson-schema.ts` itself is unchanged.
- Phase 9 (accounts) can reuse `parseBackup` as the import path for a "bring my local data into my account" step.
- **Test script dependency:** `phase-13-backup-check.ts` imports `src/data/initialLessons.ts` as real-world test
  data. If the user decides to delete that archive file (PLAN's open 11a question), move that data out first or the
  script stops running. The app build does not depend on it.
- ESLint: `eslint .` reports hundreds of `prettier/prettier` errors across the project; that was already true before
  this phase (the existing files are compact-formatted). Counting only real rules there are 0 errors and 6
  pre-existing `react-refresh` warnings in `components/ui`. The two new files are prettier-clean; the new
  `BackupControls` block in `index.tsx` follows that file's compact style, so it adds to the same pre-existing noise.

## Known limitations / for the verifier
- Not tried in a real browser (the sandbox has none). Please click through: export, then restore that same file
  (confirm dialog shows right counts, success line appears); restore a legacy unversioned file; restore a garbage
  `.txt` renamed to `.json` (red message, data untouched); restore a file with `"version": 99`; cancel the dialog;
  restore from the welcome screen's "Restore a backup" button on a fresh browser (welcome should disappear once lessons load).
- Possible pre-existing quirk this phase makes easier to reach: after a restore, the shell's `day` state is not
  reset. If the restored backup has no Day 1 (e.g. starts at Day 5) the workspace falls back to the first
  lesson but the header's day number can read 1. The import path (`onImport`) sets `day`; Restore can't without
  touching the shell, which was out of scope. A one-line `setDay(...)` in the shell would fix it — verifier's call.
- Large backups are read with `File.text()` in memory; no size cap (a backup is a few hundred KB at most).
- Restore replaces everything. There is no merge mode by design (spec said "replace").

## How it was tested (builder sandbox)
- `tsc --noEmit`: clean. `npm run build`: succeeds. `eslint` real rules: 0 errors.
- 38 pure-function cases pass: legacy file, versioned round trip, garbage, array/string roots, `lessons`
  missing/not-array/damaged/duplicate/empty/unsorted, `progress` missing/wrong-type/bad-enum/partial/empty,
  too-new / non-integer / string / negative version, wrong `app`, key stripping (a planted fake Gemini key does not
  survive), no-throw on hostile JSON, and "export never contains a gemini field".
- Not tested: anything that needs a browser (the buttons, dialog, message styling, file picker, welcome flow).

## What I did NOT touch
`lesson-schema.ts`, `japanese.ts`, the prompt builder, Gemini code, `storage.ts` (no new key), the welcome panel,
`EmptyLessons`, music/voice, the README (flag only: its "one file" sentence is still looser than the code),
`initialLessons.ts` (still unimported and still on disk), SRS, accounts, scheduled backups, extra settings.
