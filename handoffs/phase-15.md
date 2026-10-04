# Handoff — Phase 15: Leave Lovable, go GitHub + Vercel
Date: 2026-10-04

## Summary
Removed every dependency on Lovable's build wrapper so the project builds with plain Vite and deploys to Vercel from a normal git repo.
No feature, UI, backup or storage change. **Built in a sandbox with no network: `npm install`, `tsc`, `lint`, `build` and `dev` were NOT run by me.**
Everything below still has to pass on the user's machine before the first commit.

## Files changed
- `vite.config.ts`: replaced the `@lovable.dev/vite-tanstack-config` wrapper with the verifier's reference config (Tailwind, tsconfig-paths, TanStack Start with `server: { entry: "server" }` and import protection, Nitro `preset: "vercel"`, React). Dev server stays on `::` / port 8080. No `process.env.VERCEL` guard.
- `src/routes/__root.tsx`: removed the `reportLovableError` import and the `useEffect` that called it, and the now-unused `useEffect` import (`import type { ReactNode } from "react"`). Error and 404 screens look the same.
- `package.json`: removed the devDependency `@lovable.dev/vite-tanstack-config`. Nothing else touched.
- `.gitignore`: removed `package-lock.json` (and its Bun comment); added `.env`, `.env.*`, `!.env.example`, `.vercel`.
- `.prettierignore`: removed the `bun.lock` line (`package-lock.json` was already there).
- `src/lib/gemini-relay.ts`: comment only (no longer mentions Cloudflare or the `process.env.VERCEL` guard).
- `context.md`: npm rule replaces the Bun rule; new "Build and deploy" bullet replaces the guard bullet; Git bullet updated; one extra README mismatch note.
- `PLAN.md`: Phase 15 status row; the Phase 3c "don't touch server.ts/start.ts because Lovable inspects them" rule struck through.

## Files added
- `handoffs/phase-15.md`: this note.

## Files deleted
- `src/lib/lovable-error-reporting.ts`, `bun.lock`, `bunfig.toml`.

## Data/schema changes
None. Backup stays v2; localStorage keys unchanged.

## Behavior changes
None intended. If `npm run dev` or the app looks or behaves differently in any way, stop and report it.

## What the next phase should know
- `package-lock.json` does not exist yet: it is created by the user's first `npm install` and must be committed.
- The `bunfig.toml` 24-hour release-age guard is gone with the file (the user chose npm, which has no `bunfig`). Re-adding an equivalent is optional and not part of this phase.
- `src/server.ts` and `src/start.ts` were not edited.
- README still says "Bun" in its stack table and mentions Lovable in its story text; that is Phase 15b.
- Open check after deploy: one real Gemini import on the Vercel preview URL (worst case about 225 s; Hobby allows 300 s).

## What I did NOT touch
`src/server.ts`, `src/start.ts`, `src/lib/error-capture.ts`, `src/lib/error-page.ts`, `README.md`, `public/audio/`, every other dependency, `vite-tsconfig-paths` (left in on purpose).
