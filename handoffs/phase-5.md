# Handoff — Phase 5: Repo cleanup
Date: 2026-09-29

## Summary
Phase 5 was scoped as "delete `AGENTS.md` boilerplate (keep one line), remove the stray
`package-lock.json`". Against the `Kiroku_3d.zip` this was built from, **both files were already
absent**, and the one real `AGENTS.md` line was already carried into `context.md`'s non-negotiables.
So the only code-side work left was keeping `npm` from re-creating a second lockfile: this phase
adds `package-lock.json` to `.gitignore` and brings the docs in line. No source code changed.

I picked Phase 5 as "next" because Phase 4 (rebrand) is explicitly blocked on the user's
avatar/icon art direction, and Phase 5 is the only other unblocked, low-risk numbered phase.
If a different phase was intended, say so — nothing here blocks it.

## Files changed
- `.gitignore`: added `package-lock.json` (with a one-line comment) so an `npm install` in a
  sandbox can't quietly add a lockfile that drifts from `bun.lock`.
- `context.md`: two stale "slated for Phase 5" notes (the `AGENTS.md` line and the
  `package-lock.json` line) reworded to past tense.
- `PLAN.md`: Phase 5 status-table row marked ✅ Done; the "Cleanup (Phase 5)" notes heading marked
  done (original notes kept for reference).

## Files added
- `handoffs/phase-5.md`: this note.

## Data/schema changes
None.

## Behavior changes
None. Nothing in `src/` was touched.

## What the next phase should know
- **If `AGENTS.md` or `package-lock.json` still exist in your live project, delete them by hand.**
  They weren't in the zip, so I couldn't remove them; the docs now describe them as gone.
- **Discrepancy found, deliberately NOT changed:** `context.md` says `vite.config.ts` has a nitro
  preset guarded by `process.env.VERCEL`, and that a `vercel.json` sits beside it. In this zip,
  `vite.config.ts` is the plain Lovable wrapper config with **no** nitro/VERCEL guard, and there is
  no `vercel.json`. Either the zip was exported from an older copy, or those changes live only in
  your deployed project. Please check which is real before the Vercel/GitHub milestone. Don't
  re-add the guard from memory; the exact form matters (see `context.md`).
- README's "Being built next" list is still stale (the prompt rewrite and Gemini work it lists are
  done). Left alone per `context.md`'s rule about not silently editing the README; worth a
  decision from the user.
- Still open from earlier phases: the `lessons.length * 10` "words" metric bug in `ProgressView`,
  the export filename still being `komorebi-backup.json`, and the unbuilt SRS/first-run-welcome gap
  noted in PLAN.md.
- Phase 4's migration list is unchanged: `komorebi_progress_v2`, `komorebi_music_v1`,
  `komorebi_ai_studio_v1`, `komorebi_gemini_key_v1`, `komorebi_lessons_v1`.

## What I did NOT touch
- Everything under `src/`, `package.json`, `bun.lock`, `vite.config.ts`, and the README.
- Phase 4 (rebrand), Phase 6 (music/quiz polish) and everything after.
- No tests or builds were run, as instructed; the verifier pass should confirm the `.gitignore`
  and doc edits only.
