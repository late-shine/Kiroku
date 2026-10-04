# Kiroku (記録)

> A day-by-day Japanese SRS that doesn't teach you anything — it just makes sure the AI that *does* teach you never forgets what it already covered.

**Status:** Active personal project, still mid-build. The AI Lesson Studio works; the one-click Gemini "Generate" button doesn't exist yet.

If you know a little Japanese: 記録 (*kiroku*) means "record." That wasn't a branding decision — it's just what the app is. It doesn't correct your grammar or grade your speaking. It remembers.

---

## The Story

This didn't start as a plan. It started as a worry.

I'm learning Japanese with ChatGPT, following a 6-part daily lesson structure — the same one Kiroku stores now. I'd already built Astra-chan by this point, and it's good, genuinely — but for the actual day-to-day of being taught by an AI, it worked more like a bonus feature. The real learning was happening in an ordinary, ever-growing ChatGPT conversation.

I was on Day 13 when I got nervous. The conversation had been stretching on for a while, and the thought hit me: what if ChatGPT quietly forgets Day 3's grammar by the time we're on Day 20? Long conversations drift. So I copied out everything I'd learned so far and took it to Grok, just to get a quick `.md` file out of it — somewhere to keep the lessons that wasn't the chat itself.

The plan, at first, was small: keep updating that one markdown file, and paste the whole thing back into ChatGPT every five lessons or so, just to keep it honest about what it had and hadn't taught me.

Then the thought came back, bigger: *"What if I just made this a simple HTML file? Not something big — just enough to replay the quiz in a calm atmosphere?"* Astra-chan already did something close to that. But it didn't have quite this — the exact words, the exact day-by-day shape I was actually using with ChatGPT.

So I asked Claude to build something. Gave it some details. It made me something simple — and honestly, it wasn't very impressive. I already had Astra-chan's feature set in my head, so the bar was higher than it should've been for a first pass.

From there I went to Google AI Studio and rebuilt it with more systems and more ideas. Downloaded that zip, handed it to Lovable, and told it to redesign the whole thing from scratch. It did — simple, a little better. I took that same zip to a second Lovable session and asked for another redesign: better design, transparent glass panels, specific fonts, how the toggles should look.

All of that happened in one day.

This README picks up on day two — the exact point where I told Claude *"continue, we hit the limit at night anyway."* That's where Kiroku stopped being a from-scratch build and became a debugging-and-fixing project instead, one phase and one message-limit at a time.

## Why This Exists

I'm a CST diploma student from Bangladesh, working toward KOSEN admission and a longer path toward Japan. Astra-chan exists because my friend Ashraful once said, basically in passing, "Claude can add sound effects and stuff it seems." That was the whole spark — I built Astra-chan alone from there. He went and built his own separate Japanese-learning app around the same time, and since then we've just been borrowing ideas off each other's apps, not building them together.

Kiroku is the same kind of solo, accidental thing, just smaller and more selfish in scope: I was actually learning Japanese, today, and got scared the AI teaching me would forget what it had already taught.

Kiroku doesn't try to be a second Astra-chan. It doesn't teach anything. It's the notebook: the thing that remembers what any AI has already covered, writes the next prompt so that AI doesn't repeat itself or skip ahead, and turns whatever comes back into flashcards and quizzes you can return to. The AI is still the teacher. Kiroku just makes sure it doesn't forget.

## What Kiroku Actually Does

None of this was designed upfront. It's what fell out of two Lovable redesigns and a lot of Claude sessions fixing one bug at a time — same as Astra-chan, I was learning both Japanese and how to build the thing while I built it. Roughly, as of right now:

- **You configure a lesson** — target day, tone (Gentle & Cozy, Strict Sensei, Casual Friend, Anime Companion), JLPT level, vocab count, romaji on/off, an optional custom focus.
- **Kiroku writes one prompt**, addressed to whichever AI you're about to paste it into, by name — it introduces itself as Kiroku and explains what it's for. The prompt carries every prior day's grammar, kanji, and vocab, so the AI teaching you can't accidentally repeat itself or assume something you haven't learned yet.
- **The AI teaches you normally.** This part is being rewritten right now — the goal is that you get a real, readable lesson first, and only a small structured block at the end, clearly marked as being for Kiroku, that you don't need to read.
- **You paste the reply back in.** Kiroku pulls out just that structured block, checks it, shows you a preview, and saves it as a new day.
- **Quiz and review** are scoped to whichever day (or days) you actually studied — no more, no less.
- **A 12-track music player** sits in the corner: 4 songs, each in slowed / normal / sped-up versions, so you can pick the exact pace for a session.
- **Export/import everything** as one file, so your whole learning history is yours to keep, move, or hand to someone else.

## Current State

**Working:**
- Music player with all 12 tracks, speed switching that keeps playback position, and its own volume/loop/shuffle
- AI Lesson Studio: Configure → Copy Prompt → Import, with the day-aware prompt builder described above
- Quiz correctly scoped to the day(s) you pick, instead of pulling from everything at once
- Furigana toggle and on'yomi/kun'yomi display working consistently across Kanji and Vocab

**Being built next:**
- Rewriting the prompt so the AI teaches naturally first and appends the data block after, instead of replying with only the data block
- An optional one-click "Generate" button that calls Google Gemini directly with your own API key, with an automatic fallback across models if one hits its daily limit — manual copy/paste stays as the default, no-key path either way

**Noted for later, not started:**
- Shuffle mode also randomizing playback speed, not just the track
- A toggle to quiz across all days or a custom day range
- Possibly connecting Kiroku's data to Astra-chan

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TanStack Start (React 19 + TypeScript) |
| Styling | Tailwind CSS v4, shadcn/ui + Radix primitives |
| Validation | Zod |
| Icons | lucide-react |
| Storage | Browser localStorage (no accounts, no server database) |
| AI (planned) | Google Gemini, bring-your-own-key |
| Package manager | Bun |

## AI Tools Used in Development

Same honest answer as Astra-chan: I didn't write the code, and there was no senior-engineer workflow behind any of this. Most of it was "huh, what does this tool even do" followed immediately by using it for something real. I decided what to build, tested everything, and reported back what actually happened.

| Tool | Role |
|---|---|
| **Grok** | The very first `.md` export — the idea that started all of this |
| **Claude** | Built the first rough version; now the primary builder, working in phases across multiple sessions because of daily message limits |
| **Google AI Studio + Gemini** | Rebuilt the first version with more features and structure before it went to Lovable |
| **Lovable** | Two separate full redesigns — the second one is the current visual style |

## Built By

**Shahriya** — CST Diploma student, Bangladesh. Building this while actually using it, one day of Japanese at a time.
