# Phase 1 handoff — Music player rebuild

## Status: done, typechecked, built. Not yet visually confirmed by the user.

## What changed
- **New** `src/lib/tracks.ts` — the 4-song × 3-speed track list (paths under `/audio/...`,
  matching the real files already in `public/audio/`), plus `formatTime`, `versionKey`,
  and a `trackAt(i)` safe-indexing helper (see "Why trackAt" below).
- **New** `src/components/music/MusicPanel.tsx` — full player: persistent collapsed pill
  (always visible bottom-right) that expands into track list / speed switch / seek bar /
  volume / shuffle / loop / equalizer.
- **Modified** `src/routes/index.tsx` — deleted the old placeholder `SoundPanel` function
  entirely, wired in `<MusicPanel expanded={soundOpen} onToggleExpanded={...}/>` (always
  rendered now, not conditionally mounted — see below), trimmed now-unused icon imports
  (`Pause`, `Play`, `CirclePlay`, `Waves` were dead after removing `SoundPanel`; `CirclePlay`
  and `Waves` were already unused dead imports *before* this change too).
- **Modified** `src/styles.css` — added one token, `--destructive` (+ `--color-destructive`
  mapping), following the exact pattern of the existing `--success` token. Needed for the
  "track file not found" state; there was no error/warning color in the theme before.

## Key decisions (confirmed with the user first)
- **No ambient tab.** `useAmbientSound.ts` was intentionally *not* ported — user decided
  the music player only needs the 12 real tracks, ambient sound is dropped from scope.
  If this ever changes, `MusicPanel` would need a Music/Ambient tab split re-added.
- **Shuffle added** (wasn't in the original `MusicPlayer.tsx` at all, only loop existed).
  Simple implementation: picks a random *different* track on skip/auto-advance when
  shuffle is on. Not a true no-repeat-until-exhausted shuffle bag — fine for 4 tracks,
  worth upgrading if the track count grows a lot.
- **Persistent pill, lifted expand state.** The old `MusicPlayer.tsx` managed its own
  `isExpanded` state internally and had no open/close prop at all (always mounted).
  The current codebase's header button toggles a `soundOpen` boolean at the parent level.
  Resolved by keeping `soundOpen` as the single source of truth for "is the panel expanded,"
  passed down as `expanded`/`onToggleExpanded` — so the header music icon *and* the pill's
  own tap-to-expand do the same thing, and the pill itself (with mini equalizer + play/pause)
  is now always visible regardless of expanded state, matching the original's better UX.
- **Missing-file detection is lazy, not eager.** Per spec ("show 'Track file not found' on
  that row instead of failing silently"), a `Set<string>` of `trackId__speed` keys is built
  up as each combination is *attempted* (on `<audio>` `error` event) — it does not proactively
  HEAD-check all 12 files on mount. Once a combo fails once, it's remembered for the session
  (and that speed pill grays out) so the user doesn't keep re-triggering a dead file.
- **`trackAt()` helper exists because this project builds with `noUncheckedIndexedAccess: true`**
  (see `tsconfig.json`) — plain `TRACKS[i]` types as `Track | undefined` under that setting.
  Rather than sprinkling `!` assertions, added one safe accessor that falls back to `TRACKS[0]`.
  Worth knowing for Phase 2 too, since `lesson-schema.ts`/`srs.ts` will likely index arrays
  by variable too.

## Verified
- `npx tsc --noEmit -p tsconfig.json` — clean.
- `npx eslint` on the new/changed files — clean (ignoring pre-existing whole-file Prettier
  style noise in `index.tsx` that predates this change and isn't worth a drive-by reformat).
- `npm run build` — succeeds (Cloudflare/nitro preset, same as before this change).
- **Not verified: visual/interaction correctness in an actual browser.** This sandbox's
  network allowlist blocks Playwright's browser download, so no screenshot/E2E pass was
  possible here. Waiting on the user to run it (Lovable preview or local `npm run dev`)
  and confirm the collapsed pill + expanded panel look and behave as intended.

## Not touched in this phase (still ahead)
Everything else from the original plan: AI Lesson Studio + prompt builder (with the
Gemini BYOK "Generate" option + same-key model fallback + manual copy/paste as the
always-available default), SRS (`srs.ts`, Review mode), library backup export/import,
first-run welcome flow, splitting the rest of `index.tsx` into `src/components/desk/*`.
`ChatGPTBridgeModal.tsx` (uploaded, not yet used) has the tone/style option text to port
into `src/lib/prompt-builder.ts` in the next phase.
