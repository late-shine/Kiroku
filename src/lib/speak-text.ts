// Phase 16c: what to hand the speech engine for a kanji. Pure (no React, no DOM), so it is testable from a plain
// script (handoffs/phase-16c-speak-check.ts).
//
// A bare character such as 力 can be read with any of its readings (リョク, リキ, ちから), and the engine picks one.
// Kana is unambiguous, so the Listen button speaks a clean reading instead.
import type { KanjiItem } from "@/types/japanese";

// Marks that belong to dictionary notation, not to the sound: the okurigana dot ("つと.める", "まな・ぶ"), a leading
// or trailing hyphen for suffix/prefix readings ("-ぎ"), and anything in brackets ("(お)ちる"). The long-vowel
// mark ー is NOT stripped: it is part of the reading.
const BRACKETED = /[(（][^)）]*[)）]/g;
const NOTATION = /[.．・\-‐－]/g;
// A single entry sometimes holds several readings ("ひと、にん"); the first one is enough.
const SEPARATORS = /[、,，/／;；\s]+/;

/** One stored reading cleaned for speech ("つと.める" → "つとめる"); "" if nothing speakable is left. */
export function cleanReading(raw: string): string {
  const cleaned = raw.replace(BRACKETED, "").replace(NOTATION, "").trim();
  return cleaned.split(SEPARATORS).find((part) => part !== "") ?? "";
}

/**
 * The text to speak for a kanji: the first usable kun'yomi, else the first usable on'yomi, else the character
 * itself (so the button still does something for a lesson with no readings at all).
 */
export function speakableReading(
  kanji: Pick<KanjiItem, "character" | "onyomi" | "kunyomi">,
): string {
  for (const reading of kanji.kunyomi) {
    const cleaned = cleanReading(reading);
    if (cleaned !== "") return cleaned;
  }
  for (const reading of kanji.onyomi) {
    const cleaned = cleanReading(reading);
    if (cleaned !== "") return cleaned;
  }
  return kanji.character;
}
