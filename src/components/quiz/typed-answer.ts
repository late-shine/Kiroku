// Phase 14d — checking a typed reading ("type C"). Pure: no React, no DOM, no storage, so every rule here
// is testable from a plain script (handoffs/phase-14d-quiz-check.ts).
//
// What counts as a right answer (PLAN.md, Phase 14d):
//  - both sides are compared after Unicode NFKC, with spaces and punctuation removed and katakana turned into
//    hiragana, so ｶﾀｶﾅ / カタカナ / かたかな all match;
//  - romaji is never accepted (a reading that is not kana cannot be asked at all, see `canTypeReading`);
//  - a stored `reading` that holds several readings ("わたし/あたし", "かた、うで") accepts any one of them.
import type { VocabWord } from "@/types/japanese";

/** What a normalised reading must be made of: hiragana, the two iteration marks, and the long-vowel mark ー. */
const KANA_ONLY = /^[ぁ-ゖゝゞー]+$/;
/** Dropped from both sides before comparing: whitespace of every kind, punctuation and symbols (・ 〜 。 …). */
const IGNORED = /[\s\p{P}\p{S}]/u;
/**
 * Where one stored reading ends and the next begins. These are matched AFTER NFKC, which has already turned
 * ／ ， ； ｜ ･ into / , ; | ・.
 */
const ALTERNATIVE_SEPARATORS = /[/、,;|・]/;
const HARD_SEPARATORS = /[/、,;|]/;

/**
 * The comparison form of a reading: NFKC, no spaces or punctuation, katakana as hiragana. The long-vowel mark ー
 * is kept, because it is part of the spelling (らーめん).
 */
export function normalizeReading(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFKC")) {
    if (IGNORED.test(ch)) continue;
    const code = ch.codePointAt(0) ?? 0;
    // ァ..ヶ -> ぁ..ゖ and the katakana iteration marks ヽヾ -> ゝゞ (all exactly 0x60 apart)
    const isKatakana = (code >= 0x30a1 && code <= 0x30f6) || code === 0x30fd || code === 0x30fe;
    out += isKatakana ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

/**
 * Every typed answer that is right for a stored `reading`, in comparison form. Empty when the stored reading
 * is not usable (nothing left after cleaning, or it contains something that is not kana, such as romaji or
 * kanji), which is how a word that cannot be asked as "type the reading" is recognised.
 *
 * "・" is ambiguous in the wild: it separates two readings ("かた・うで") but also sits inside a katakana
 * name ("ジョン・スミス"). So each side of a "・" is accepted alone AND the whole thing with the dot removed.
 * Notes in brackets, "たべる (to eat)", are ignored.
 */
export function readingAnswers(reading: string): string[] {
  const text = reading.normalize("NFKC").replace(/\([^)]*\)/g, "");
  const candidates = text.split(ALTERNATIVE_SEPARATORS);
  if (text.includes("・") && !HARD_SEPARATORS.test(text)) candidates.push(text.replace(/・/g, ""));
  const answers: string[] = [];
  for (const candidate of candidates) {
    const normal = normalizeReading(candidate);
    if (normal !== "" && KANA_ONLY.test(normal) && !answers.includes(normal)) answers.push(normal);
  }
  return answers;
}

/** True when `typed` is one of the readings stored for the word. Nothing typed is never right. */
export function isReadingCorrect(reading: string, typed: string): boolean {
  const normal = normalizeReading(typed);
  return normal !== "" && readingAnswers(reading).includes(normal);
}

/**
 * Can this word be asked as "type the reading"? Not when its reading is unusable (see `readingAnswers`), and
 * not when the written form already IS an accepted answer: ありがとう, or ノート with the reading のーと,
 * would just be copied from the screen. Those get "choose the word" instead.
 */
export function canTypeReading(word: Pick<VocabWord, "japanese" | "reading">): boolean {
  const answers = readingAnswers(word.reading);
  if (answers.length === 0) return false;
  return !answers.includes(normalizeReading(word.japanese));
}

/** The bits of a keyboard event the Enter rule needs (a real `KeyboardEvent` fits). */
export interface KeyLike {
  readonly key: string;
  readonly isComposing?: boolean;
  readonly keyCode?: number;
  readonly repeat?: boolean;
}

/**
 * Should this key press submit the typed answer? Enter does, EXCEPT while a Japanese keyboard (IME) is still
 * converting: that Enter only confirms the conversion. Browsers report that as `isComposing`, and Safari
 * ends the composition just before the key event, so it reports keyCode 229 instead. A held-down Enter
 * (`repeat`) never submits, so it cannot race through several questions.
 */
export function isSubmitKey(e: KeyLike): boolean {
  return e.key === "Enter" && e.isComposing !== true && e.keyCode !== 229 && e.repeat !== true;
}
