# Handoff — Phase 8: Voice selection
Date: 2026-09-30

## Summary
The user can now pick which browser voice reads Japanese aloud, and the choice is saved. PLAN.md gave this
phase one row and no spec, so the scope is deliberately small: choose a voice, save it, use it everywhere
`speak()` was already used (the Kanji "Listen" button and each vocab row). Rate is still the fixed 0.88 it
always was. Checked with `tsc`, `eslint` and `npm run build` (all clean). Nothing was tested in a browser,
and the voice list only exists in a real browser.

## Files added
- `src/lib/voice.ts`: `speak()` (moved here from `index.tsx`, now honours the saved voice), `loadVoicePref` /
  `saveVoicePref`, `listJapaneseVoices()`, the `useJapaneseVoices()` hook, `VOICE_SAMPLE_TEXT`.
- `src/components/voice/VoicePicker.tsx`: the picker card. One row for "Automatic" plus one row per Japanese
  voice the browser offers (name, language, "on this device" / "online"). Tapping a row saves it and plays a
  short sample. Selected row uses `border-primary` / `bg-primary/10` and a check; tokens only, no hardcoded colors.
- `handoffs/phase-8.md`: this note.

## Files changed
- `src/routes/index.tsx`: imports `speak` from `@/lib/voice` and `VoicePicker`; the old `speak()` at the bottom
  of the file is deleted; `AtmosphereView` renders a second `GlassPane` (`<VoicePicker/>`) under the
  scene/contrast pane. Nothing else in the file changed.
- `src/lib/storage.ts`: new `STORAGE_KEYS.voice = "kiroku_voice_v1"`. `migrateLegacyStorage()` now loops over
  `LEGACY_STORAGE_KEYS` instead of `STORAGE_KEYS` (same five keys, same behavior), because the new key has no
  `komorebi_*` twin and would otherwise not typecheck.
- `PLAN.md` (status row), `context.md` (storage-key list, file map).

## Data/schema changes
- One new `localStorage` key, `kiroku_voice_v1`, holding the chosen voice's `voiceURI`. Absent = Automatic.
  No migration needed (new key). No change to `UserProgressState`, the zod schema, or the export/backup shape.
- Deliberately **not** in `progress` or the backup: voices are per browser and per device (a macOS voice is
  not available on Android), so syncing the raw value would often point at nothing.

## Behavior changes
- Atmosphere tab has a "声 · voice" card. Selecting a voice changes every Listen button immediately (`speak()`
  reads the saved value on each call, so no state is shared between the picker and the lesson screens).
- Automatic (the default, and what existing users get) behaves exactly as before: `lang = "ja-JP"`, no
  explicit voice.
- If the saved voice isn't available in the current browser, `speak()` falls back to Automatic, the card shows
  a one-line note, and the saved value is kept (it works again if the voice comes back).
- If the browser has no speech support at all, or no Japanese voices, the card says so instead of a list.
- Android Chrome reports languages as `ja_JP`; both `ja_JP` and `ja-JP` are matched.
- "Reset all progress" does not touch the voice choice (it is a device setting, not progress).

## What the next phase should know
- **Phase 9 (accounts/sync):** if the voice preference is ever synced, sync a preference *by name/language*,
  not the raw `voiceURI`, and expect it to be missing on other devices. `speak()` already degrades to Automatic.
- `speak()` is now the single place that talks to `speechSynthesis`. Any new audio feature (a quiz "Listen"
  button, say) should call it rather than creating its own utterance.
- The picker sits in the Atmosphere tab because that is the app's only preferences-style screen. If it feels out of place
  there, moving it is one line in `AtmosphereView` (or drop `<VoicePicker/>` into `ProgressView`).
- Voice list loading is asynchronous in Chrome (`voiceschanged`); the hook waits up to 1.5 s before concluding
  there are no Japanese voices.
- README.md does not mention voices, so nothing there is stale because of this phase. It is still stale in the
  ways listed in `handoffs/phase-6.md`.

## What I did NOT touch
- Speech rate/pitch controls, a "Listen" button anywhere new, the quiz, music player, prompt/Gemini code,
  `vite.config.ts`, `README.md`, the backup/export shape.
- No `prettier --fix` on `index.tsx` (still the same 185 prettier-only errors as before; 0 real lint errors).
  Both new files are prettier-clean.

## Needs the user's eyes in a real browser (not verifiable here)
1. Atmosphere tab → the voice card lists the voices you expect; tap one: the sample plays in that voice.
2. Reload the page: the same voice is still highlighted.
3. Lessons → Vocab → tap a word, and Kanji → Listen: both use the chosen voice.
4. Pick "Automatic": sound matches what you had before Phase 8.
5. Try a second browser if you have one; the list will differ, and a voice saved in another browser is not carried over.
