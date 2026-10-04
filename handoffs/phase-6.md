# Handoff — Phase 6: Music & quiz polish
Date: 2026-09-29

## Summary
Three things, per the roadmap row: shuffle now randomizes playback speed as well as the track, the
Quiz tab can cover one day / all days / a chosen day range, and four new songs were added to the
player (4 → 8 songs). Not run through `tsc`, `eslint` or `npm run build`, as the user asked; the
verifier pass should do all three. Nothing was tested in a browser.

## Follow-up applied after the user's answers
- **Normal versions for Death Bed and Yume to Hazakura.** The user confirmed all uploads were already
  real slowed / normal / sped-up files and that the nightcore uploads are their "normal" versions.
  They are now `public/audio/death-bed-normal.mp3` and `yume-to-hazakura-normal.mp3`, mapped as
  `normal` in `src/lib/tracks.ts`. All 8 songs now have all 3 speeds (24 files), and nothing is
  disabled. (`hasVersion`/`resolveSpeed` and the greyed-out pill logic stay in place as a safety net.)
- **Playback speed is never changed by code.** Each speed is a separate audio file; the player only
  switches which file it loads. No `playbackRate`, `preservesPitch` or Web Audio is used anywhere.
- **Words metric fixed.** `ProgressView`'s "words" is now the sum of every lesson's `vocab.length`
  (was `lessons.length * 10`). One expression in `src/routes/index.tsx`.

## Still open for the user
- **Shuffle randomizes speed with no separate switch.** Someone who picks "Slowed" for studying and
  turns shuffle on gets a random speed on each skip or auto-advance. A second toggle is a small
  follow-up if unwanted.

## Files changed
- `src/lib/tracks.ts`: `Track.versions` is now `Partial<Record<SpeedMode, string>>` (so a song can lack a speed). Added 4 songs
  (`say-yes-to-heaven`, `cardigan`, `death-bed`, `yume-to-hazakura`) and two helpers, `hasVersion()`
  and `resolveSpeed()` (wanted speed if the song has it, else normal → sped-up → slowed).
- `src/components/music/MusicPanel.tsx`:
  - New `preferredSpeed` ref = the speed the user last picked by hand. `speedMode` state is what is
    actually playing (can differ because of fallback or shuffle).
  - New `pickSpeed(index, randomize)`: random speed among the song's existing, not-known-broken
    versions when `randomize` is true (only for shuffle-driven skip / auto-advance, never when the
    user taps a song), otherwise the preferred speed resolved against what the song has.
  - Speed pills with no file are `disabled` with a tooltip. Shuffle button tooltip now reads
    "Shuffle on — random track and speed".
  - `loadSrc` returns early if a version has no file; mount restores via the resolved speed.
- `src/routes/index.tsx`: `QuizView` rewritten (still a single component, other code untouched).
  Scope toggle: This day (default, so "Quiz this day" behaves as before) / All days / Day range with
  two `<select>`s of existing day numbers. If From > To the range is treated as min–max. The header
  shows "Day 3", "All days" or "Days 2–5". Changing scope restarts from question 1. Distractor
  options are now de-duplicated by meaning (wider scopes can repeat one, which would have produced
  duplicate React keys). Empty-scope and no-lessons messages added.
- `context.md`, `PLAN.md`: quiz/track-count notes and the Phase 6 status row updated.

## Files added
- `public/audio/`: `say-yes-to-heaven-{slowed,normal,sped-up}.mp3`, `cardigan-{slowed,normal,sped-up}.mp3`,
  `death-bed-{slowed,normal,sped-up}.mp3`, `yume-to-hazakura-{slowed,normal,sped-up}.mp3`. Renamed from
  the user's originals to ASCII slugs.
- `handoffs/phase-6.md`: this note.

## Data/schema changes
None. No `localStorage` keys added. The quiz scope and range are in-memory only, so they reset on
reload (deliberate: a new key would need adding to the Phase 4 migration list). `komorebi_music_v1`
is unchanged; a saved `trackId` or `speedMode` that a song lacks is resolved on load.

## Behavior changes
- Skipping or auto-advancing with shuffle on can change the speed too. Tapping a song, or a speed
  pill, does not.
- If a song ever lacks a speed, the player falls back (normal → sped-up → slowed) and the user's own
  speed choice comes back on the next song that has it. (Today every song has all three.)
- Quiz: see above. Quiz progress counters (`totalQuizzesTaken` etc.) behave exactly as before.

## What the next phase should know
- `README.md` still says "12-track music player, 4 songs" (lines ~48 and ~54) and lists shuffle+speed
  and the quiz range toggle under "noted for later". Left alone per `context.md`'s README rule.
- The audio adds ~56 MB to `public/audio` (the slowed Say Yes To Heaven file alone is 9.7 MB). Fine
  for Vercel's static hosting, but worth knowing for repo size once it goes to GitHub.
- Shuffle is still "random different song", not a no-repeat-until-exhausted bag. With 8 songs a
  recent one can come back quickly; upgrade if that annoys the user.
- Also still open: SRS / first-run welcome / versioned backup have no phase number.

## What I did NOT touch
- Phase 4 (rebrand), all `komorebi_*` keys and UI strings, the rest of `ProgressView`, the prompt/Gemini code,
  `vite.config.ts`, the README, and the "Atmosphere" tab.
- No `tsc`, `eslint`, `npm run build` or browser check was run.

## Verifier addendum (separate session)
- **Bug found by the user in live testing:** the quiz's Day range `From`/`to` dropdown opened as a near-white list with barely readable light text. Cause: a native `<select>` popup is drawn by the OS, not the page. It ignored the theme's translucent `bg-glass` and used the system's white background, while the option text still inherited the theme's light foreground colour.
- **Fix (one file, `src/styles.css`, no `index.tsx` change):** `select { color-scheme: dark; }` plus `select option { background-color: var(--background); color: var(--foreground); }`. It is global, so any future `<select>` gets the same treatment.
- Typecheck, eslint (prettier off) and `npm run build` are clean, and the new rule is present in the built CSS.
- **Not verifiable in the sandbox:** how the popup actually renders. Native dropdown popups are not part of the page, so a screenshot tool would not capture them either. The user needs to confirm this in their real browser.
