// Reinforcement plan, Phase 3 — which earlier words the AI prompt asks the tutor to weave back in.
// Pure: no React, no localStorage, no clock (the caller passes `today`), no randomness, so the same data on the same
// local day always gives the same list and the Lesson Studio prompt text never changes on a re-render.
//
// The rules (kiroku-ai-reinforcement-plan.md, Phase 3):
//  - the word comes from an EARLIER lesson (`dayNumber < the day being built`);
//  - its miss streak (Phase 2) is at least REINFORCE_MIN_STREAK;
//  - its last REAL answer (right + wrong > 0) is within REINFORCE_WINDOW_DAYS local days of today;
//  - order: highest streak, then oldest real answer, then lesson order, then word id (all stable);
//  - the same Japanese text is listed once, and at most REINFORCE_CAP words are returned.
// Nothing here changes the Leitner schedule or the stored memory. Phase 2 (`word-memory.ts`) owns the streak.
import type { DayLesson, VocabWord } from "@/types/japanese";
import {
  addDays,
  isValidDay,
  lastAnswerDay,
  memoryFor,
  missStreakOf,
  type VocabMemory,
} from "@/lib/word-memory";

/** A word needs at least this many missed answer-days in a row to be reinforced. */
export const REINFORCE_MIN_STREAK = 2;
/** "Roughly 14 days": the last real answer may be at most this many LOCAL days before today (inclusive). */
export const REINFORCE_WINDOW_DAYS = 14;
/** At most this many words go into one prompt (plan: 3 first; 5 only after real lessons have been observed). */
export const REINFORCE_CAP = 3;

/** The text a word is listed (and de-duplicated) by: its Japanese, NFC-normalised and trimmed. */
const textOf = (w: VocabWord): string => w.japanese.normalize("NFC").trim();

/** Plain code-unit comparison: no locale, so two devices can never order ids differently. */
const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

interface Candidate {
  word: VocabWord;
  text: string;
  streak: number;
  /** Time of the last real answer, in milliseconds (a real number: `lastAnswerDay` already proved it parses). */
  answeredAt: number;
  lessonDay: number;
  position: number;
}

/**
 * The words to reinforce in a prompt for lesson `day`, best first, at most REINFORCE_CAP.
 *
 * `lessons` is the whole stored curriculum; only lessons with `dayNumber < day` are looked at, so replacing an
 * early day never sees later ones. `memory` is `progress.vocabMemory`; `memoryFor` ignores a record that was written
 * for different text under the same id (an AI re-emitted the day). `today` is the local day "YYYY-MM-DD"; an invalid
 * value returns an empty list rather than guessing.
 *
 * A last real answer dated AFTER today (the device clock went backwards) still counts as recent: only answers that
 * are older than the window expire. Words that were only "Added to review" have no real answer, so they never qualify.
 */
export function selectReinforcementWords(
  day: number,
  lessons: readonly DayLesson[],
  memory: VocabMemory,
  today: string,
): VocabWord[] {
  if (!isValidDay(today)) return [];
  const oldestAllowed = addDays(today, -REINFORCE_WINDOW_DAYS);

  const candidates: Candidate[] = [];
  for (const lesson of lessons) {
    if (!(lesson.dayNumber < day)) continue;
    lesson.vocab.forEach((word, position) => {
      const text = textOf(word);
      if (text === "") return;
      const rec = memoryFor(memory, word);
      const streak = missStreakOf(rec);
      if (streak < REINFORCE_MIN_STREAK) return;
      const answeredDay = lastAnswerDay(rec);
      if (rec === undefined || answeredDay === null || answeredDay < oldestAllowed) return;
      candidates.push({
        word,
        text,
        streak,
        answeredAt: Date.parse(rec.lastAnswered),
        lessonDay: lesson.dayNumber,
        position,
      });
    });
  }

  candidates.sort(
    (a, b) =>
      b.streak - a.streak ||
      a.answeredAt - b.answeredAt ||
      a.lessonDay - b.lessonDay ||
      a.position - b.position ||
      compareText(a.word.id, b.word.id),
  );

  // The first candidate of each Japanese text is its best-ranked one; later copies (the same word saved in two
  // lessons, or a homograph with another reading) would only be a repeated line, so they are skipped BEFORE the cap.
  const seen = new Set<string>();
  const picked: VocabWord[] = [];
  for (const c of candidates) {
    if (seen.has(c.text)) continue;
    seen.add(c.text);
    picked.push(c.word);
    if (picked.length === REINFORCE_CAP) break;
  }
  return picked;
}
