# Handoff — Phase 15: Leave Lovable, go GitHub + Vercel
Date: 2026-10-04

## Summary
Removed every dependency on Lovable's build wrapper so the project builds with plain Vite and deploys to Vercel from a normal git repo.
No feature, UI, backup or storage change. **Built in a sandbox with no network: `npm install`, `tsc`, `lint`, `build` and `dev` were NOT run by me.**
Everything below still had to pass on the user's machine before the first commit. **Update (2026-10-04, same day): the user ran the checks, they passed, the code was pushed to the private repo `late-shine/Kiroku` (tag `v-phase-15`), and the Vercel deploy is live. See "Post-build addendum".**

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

## Post-build addendum (2026-10-04): TanStack security upgrade
Vercel refused the first deploy: `@tanstack/react-start@1.168.32` is in the range affected by CVE-2026-102989 (critical reflected XSS in server-function responses, disclosed 2026-09-30; fixed in `@tanstack/react-start` 1.168.60 and `@tanstack/start-server-core` 1.169.39). The override env var was deliberately **not** used: Kiroku has a server function (the Gemini relay) and the browser holds the user's lessons and Gemini key in localStorage.
- Fix: `npm install @tanstack/react-start@latest @tanstack/react-router@latest @tanstack/router-plugin@latest`. This replaced the three exact pins in `package.json` and regenerated `package-lock.json`. Result: `react-start` 1.168.60, a single `start-server-core` 1.169.39, `npm audit` 0 vulnerabilities.
- One code change forced by the new types: `ErrorComponent` in `src/routes/__root.tsx` now takes `ErrorComponentProps` (`error` is `unknown`, not `Error`). Same screen, same behavior.
- Verified by the user: `tsc`, build, dev click-through, a real Gemini import locally (fallback chain worked: two models busy, third succeeded), push, and a successful Vercel deploy.
- Still worth confirming on the live Vercel URL: restore a backup, re-enter the Gemini key, run one real Gemini import (Hobby allows 300 s; worst-case chain about 225 s).
- Lesson for later phases: Vercel blocks known-vulnerable TanStack Start versions at build time, so a future deploy can fail on a new advisory. The fix is the same: bump the three `@tanstack/*` packages together.
