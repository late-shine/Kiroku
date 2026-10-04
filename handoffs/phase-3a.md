# Phase 3a handoff — Quiz-by-day fix, Kanji readings, furigana consistency

## Status: done, typechecked, linted, built. Small, contained fixes only.

## Bug 1: Quiz repeated the same questions / pulled from every day, not just the selected one
**Root cause (confirmed by reading the code, not guessing):** `QuizView`'s vocab pool was
`lessons.flatMap(l => l.vocab)` — *every* day's vocab, always. The `day` prop only shifted
a starting offset (`pool[(index + day*3) % pool.length]`) into that same full pool — it never
filtered anything. Since the offset formula is deterministic and the tab remounts (resetting
`index` to 0) every time you leave and come back to Quiz, the same `day` always produced the
exact same first question — hence "it repeats the same questions."

**Fix:** `dayVocab` is now `lessons.find(l => l.dayNumber === day)?.vocab ?? []` — actually
scoped to the selected day. Question order is a genuine shuffle (`sort(() => Math.random()-.5)`)
computed once per day rather than a positional walk, and the 3 wrong-answer distractors are
now a random sample from that same day's other words instead of a positional `.slice(index,
index+3)` that would have thinned out as `index` grew. Added a friendly empty state ("Day N
doesn't have any vocabulary yet") for the edge case of quizzing a day with no vocab, instead
of silently rendering nothing.

**Not done (intentionally, out of scope for this small fix):** this is still a flat quiz over
one day's words, not the SRS-linked spaced-repetition Review mode from the original plan —
that's its own, larger piece of work already tracked for later, not something this fix
tries to become.

## Bug 2 (your "optional upgrade, but worth keeping?"): Kanji on'yomi/kun'yomi never rendered
Confirmed — `lesson.kanji.onyomi` / `kunyomi` were populated on every imported lesson (your
Day 14 JSON has them) but the `Kanji` component never read those fields at all. Added an
"On: ... · Kun: ..." line. While in there, also surfaced `memoryTip` and `rendakuNote` —
same situation (real AI-generated content, already stored, never displayed) — flagging this
since you only asked about on'yomi/kun'yomi; happy to revert the memory-tip/rendaku part if
you'd rather keep this change minimal.

## Bug 3 (your question): furigana toggle not respected in Kanji/Vocab
Confirmed not intentional — just an inconsistency. `showReading` was only ever passed to
`Overview` and `Grammar`. Both `Kanji` and `Vocab` now take the same `showReading` prop
(wired from `progress.showFurigana`, same as the other two tabs) and hide the reading text
(on'yomi/kun'yomi, compound readings, vocab readings) when it's off — character, meaning,
stroke count, and radical still always show, same as Overview/Grammar still always show the
Japanese text and English meaning regardless of the toggle.

## Also fixed in passing
One pre-existing empty `catch{}` block in `ProgressView`'s restore-from-file handler
(unrelated to anything above, just tripped a lint rule while I was running a full-file
lint pass) — now `catch{/* ignore malformed backup file */}`. No behavior change.

## Verified
`tsc --noEmit` clean, `eslint` clean (including the pre-existing issue above), `npm run
build` succeeds. Not interaction-tested in a real browser — that's on you/another model,
per your last message.

## Still ahead
Gemini "Generate" wiring (paused — see the model fallback-chain question in chat), SRS,
Review mode, library backup versioning, first-run welcome, splitting `index.tsx` further,
and the Phase 1 shuffle-should-also-randomize-speed tweak.
