import type { DayLesson, UserProgressState, VocabWord } from "@/types/japanese";
import { dueWordsInOrder, localDay } from "@/lib/word-memory";

export type Tone = "gentle" | "strict" | "casual" | "anime";
export type LessonStyle = "balanced" | "grammar-heavy" | "kanji-deep" | "conversational";
export type JlptLevel = "N5" | "N4" | "N3";
export type PromptMode = "learn-save" | "learn-only" | "save-only";

export const TONE_LABELS: Record<Tone, string> = {
  gentle: "Gentle & Cozy",
  strict: "Strict Sensei",
  casual: "Casual Japanese Friend",
  anime: "Anime / Manga Companion",
};

// Ported verbatim from the original ChatGPTBridgeModal.tsx (lines ~54-59).
const TONE_INSTRUCTIONS: Record<Tone, string> = {
  gentle: "Tone: Friendly, encouraging, cozy, and clear like a patient mentor.",
  strict: "Tone: Precise, academic, disciplined sensei with exact grammatical breakdown.",
  casual: "Tone: Ultra-conversational, like a Japanese close friend speaking in modern Tokyo youth Japanese.",
  anime: "Tone: Energetic anime/manga companion, using fun sound effects and real anime dialogue examples.",
};

export const STYLE_LABELS: Record<LessonStyle, string> = {
  balanced: "Balanced 6-Part",
  "grammar-heavy": "Grammar-Heavy",
  "kanji-deep": "Kanji Deep Dive",
  conversational: "Colloquial & Aizuchi",
};

// Ported verbatim from the original ChatGPTBridgeModal.tsx (lines ~61-66), {vocabCount} substituted in.
const STYLE_INSTRUCTIONS: Record<LessonStyle, string> = {
  balanced: "Focus: Standard 6-part balanced daily lesson (Grammar, Kanji, {vocabCount} Vocab, Natural Phrase, Pattern, Culture Corner).",
  "grammar-heavy": "Focus: Provide in-depth grammatical nuances, contrast with similar particles, and 4+ clear example sentences.",
  "kanji-deep": "Focus: Provide a detailed kanji stroke breakdown, the radical's origin story, and 6+ high-frequency compound words.",
  conversational: "Focus: Heavily prioritize everyday spoken contractions, aizuchi reactions, and casual spoken phrasing.",
};

export const MODE_LABELS: Record<PromptMode, string> = {
  "learn-save": "Learn + Save",
  "learn-only": "Learn only",
  "save-only": "Save only",
};

// Shown as static reference copy under the mode toggle in LessonStudio's Configure step.
export const MODE_HINTS: Record<PromptMode, string> = {
  "learn-save":
    "Teaches you the full lesson, then adds a small block at the end for Kiroku. Paste the whole reply back in.",
  "learn-only": "Just the lesson, no data block. Good for follow-up questions before saving.",
  "save-only": "Turns a lesson you already have into Kiroku's format. Paste your existing lesson in first, then copy this prompt.",
};

export const JLPT_LEVELS: JlptLevel[] = ["N5", "N4", "N3"];
export const VOCAB_COUNTS = [5, 10, 15] as const;
export type VocabCount = (typeof VOCAB_COUNTS)[number];

export interface PromptOptions {
  day: number;
  tone: Tone;
  style: LessonStyle;
  level: JlptLevel;
  vocabCount: VocabCount;
  romaji: boolean;
  customFocus: string;
  lessons: DayLesson[];
  progress: UserProgressState;
  mode: PromptMode;
  /** Only read when mode is "save-only" — see buildSaveOnlyPrompt. */
  existingLessonText: string;
  /** Phase 14c: today's date as YYYY-MM-DD, used to decide which words are due. Defaults to the real local day; tests pass a fixed one. */
  today?: string;
}

/** Phase 14c: the most review words one prompt will carry. Most overdue first, so the longest-waiting words win. */
export const REVIEW_PROMPT_CAP = 10;

/**
 * Phase 14c: the words the Learn prompt asks the AI to use again — words from EARLIER days that are due for review
 * (most overdue first, at most REVIEW_PROMPT_CAP). Words already named in the "still finds difficult" list are left out
 * so no word is listed twice, and so is a word whose Japanese is already in the list (the same word can be taught on two
 * different days under two ids). Pure and deterministic. The Lesson Studio calls this too, to tell the user how many go in.
 */
export function reviewWordsForPrompt(
  day: number,
  lessons: DayLesson[],
  progress: UserProgressState,
  today: string = localDay(),
): VocabWord[] {
  const prior = lessons.filter((l) => l.dayNumber < day).sort((a, b) => a.dayNumber - b.dayNumber);
  const priorVocab: VocabWord[] = prior.flatMap((l) => l.vocab);
  const seen = new Set<string>();
  return dueWordsInOrder(priorVocab, progress.vocabMemory, today)
    .filter((v) => !progress.weakVocabIds.includes(v.id))
    .filter((v) => (seen.has(v.japanese) ? false : (seen.add(v.japanese), true)))
    .slice(0, REVIEW_PROMPT_CAP);
}

function priorKnowledgeBlock(day: number, lessons: DayLesson[], progress: UserProgressState, today: string): string {
  const prior = lessons.filter((l) => l.dayNumber < day).sort((a, b) => a.dayNumber - b.dayNumber);

  if (day <= 1 || prior.length === 0) {
    return `This is the learner's very first lesson. Assume ZERO prior Japanese knowledge — no hiragana, no katakana, no grammar, nothing. As part of today's material, briefly introduce hiragana and katakana just enough for the learner to read what you teach, and make です (polite copula, "is/am/are") and だ (its plain-form counterpart) the core grammar point of the day.`;
  }

  const highestPriorDay = Math.max(...prior.map((l) => l.dayNumber));
  const grammarSummary = prior.map((l) => `Day ${l.dayNumber}: ${l.grammar.title} (${l.grammar.structure})`).join("\n");
  const kanjiSummary = prior
    .map((l) => `${l.kanji.character} (${l.kanji.meaning} — On: ${l.kanji.onyomi.join("/") || "—"} / Kun: ${l.kanji.kunyomi.join("/") || "—"})`)
    .join(", ");
  const allVocab: VocabWord[] = prior.flatMap((l) => l.vocab);
  const vocabSummary = allVocab.map((v) => `${v.japanese} (${v.reading}) — ${v.meaning}`).join(", ");
  const weakVocab = allVocab.filter((v) => progress.weakVocabIds.includes(v.id));
  const weakSummary = weakVocab.length
    ? `\n\nWords the learner still finds difficult — weave a light, natural review of these into today's examples or natural phrase where it genuinely fits, without turning today into a review lesson: ${weakVocab
        .map((v) => `${v.japanese} (${v.meaning})`)
        .join(", ")}.`
    : "";

  // Phase 14c — wording approved by the user (2026-10-03). The only place this sentence lives.
  const reviewWords = reviewWordsForPrompt(day, lessons, progress, today);
  const reviewSummary = reviewWords.length
    ? `\n\nWords due for review — the learner's own review schedule says these are ready to be seen again. Use them again in new example sentences and phrases today (not sentences from earlier lessons), wherever they genuinely fit. They are NOT new vocabulary: keep today's vocabulary list entirely new words, and do not re-teach them or turn today into a review lesson: ${reviewWords
        .map((v) => `${v.japanese} (${v.meaning})`)
        .join(", ")}.`
    : "";

  return `To ensure you never assume grammar or vocabulary the learner hasn't been taught yet, here is their exact progress tracker so far:

=== COMPLETED LESSONS (Days 1 to ${highestPriorDay}) ===
Grammar covered:
${grammarSummary}

Kanji taught:
${kanjiSummary}

Known vocabulary:
${vocabSummary || "(none recorded)"}${weakSummary}${reviewSummary}

IMPORTANT: Do NOT skip ahead or assume any grammatical form or vocabulary beyond what's listed above.`;
}

function schemaAndExampleBlock(day: number, vocabCount: number): string {
  return `Return the lesson as exactly ONE JSON code block (\`\`\`json ... \`\`\`) matching this structure exactly — no extra prose inside the code block, and no fields beyond these:

{
  "dayNumber": number,
  "title": string,
  "topic": string,
  "grammar": {
    "title": string, "summary": string, "structure": string, "explanation": string,
    "negativeForm": string, "questionForm": string, "notes": string[],
    "examples": [ { "japanese": string, "reading": string, "english": string, "breakdown": string } ]  // at least 3
  },
  "kanji": {
    "character": string, "meaning": string, "strokes": number, "radical": string,
    "onyomi": string[], "kunyomi": string[],
    "compounds": [ { "word": string, "reading": string, "meaning": string } ],  // 5 or more
    "rendakuNote": string, "memoryTip": string
  },
  "vocab": [ { "id": "d${day}-1", "japanese": string, "reading": string, "meaning": string, "day": ${day} } ],  // exactly ${vocabCount} entries, ids d${day}-1 through d${day}-${vocabCount}
  "naturalPhrase": { "phrase": string, "reading": string, "meaning": string, "context": string },
  "pattern": string,
  "cultureCorner": string
}

Example below shows the FORMAT only — write real Day ${day} content, not this placeholder text:
\`\`\`json
{
  "dayNumber": ${day},
  "title": "<short title — no 'Day N' prefix, the app adds that>",
  "topic": "<one-line topic>",
  "grammar": { "title": "...", "summary": "...", "structure": "...", "explanation": "...", "negativeForm": "...", "questionForm": "...", "notes": ["..."], "examples": [ { "japanese": "...", "reading": "...", "english": "...", "breakdown": "..." } ] },
  "kanji": { "character": "力", "meaning": "Power / Strength", "strokes": 2, "radical": "力", "onyomi": ["リョク", "リキ"], "kunyomi": ["ちから"], "compounds": [ { "word": "努力", "reading": "どりょく", "meaning": "effort" } ], "rendakuNote": "...", "memoryTip": "..." },
  "vocab": [ { "id": "d${day}-1", "japanese": "...", "reading": "...", "meaning": "...", "day": ${day} } ],
  "naturalPhrase": { "phrase": "...", "reading": "...", "meaning": "...", "context": "..." },
  "pattern": "...",
  "cultureCorner": "..."
}
\`\`\``;
}

// Shared by "learn-save" and "learn-only" — the actual teaching ask, in prose (not a data-form request).
function teachingInstructionsBlock(day: number, vocabCount: number): string {
  return `Teach me Day ${day} like a real tutor would — in your own natural voice, not as a
data form. Cover exactly these six things, each fully explained, in plain
readable prose with real examples:
1. Grammar Point — structure, a clear explanation, the negative form, the question form, any extra notes, and at least 3 worked examples (Japanese, reading, English, and a short breakdown of each).
2. Kanji of the Day — one character with its meaning, stroke count, radical, on'yomi, kun'yomi, 5 or more common compounds (word, reading, meaning), a rendaku/sound-change note if relevant, and a vivid memory tip.
3. ${vocabCount} Themed Vocabulary Words — Japanese, reading, English meaning, matching today's topic.
4. A Natural Japanese Phrase / colloquial reaction — phrase, reading, meaning, and the natural context where it's used.
5. Pattern of the Day — one key structural or phonetic takeaway.
6. Tiny Culture Corner — a brief, authentic cultural insight related to today's topic.

Keep everything beginner-appropriate for someone who only knows what's listed above — do not skip ahead.`;
}

// The bridge from "done teaching" into the data block — only used by mode: "learn-save".
function teachThenSaveBridge(day: number, vocabCount: number): string {
  return `When you're done teaching, add one short natural sentence letting me know
what's coming next — for example: "Since you're using Kiroku to save your
progress, here's the block to paste back into Kiroku's Import screen." Then
output the same lesson as one JSON code block, exactly as specified below.

${schemaAndExampleBlock(day, vocabCount)}`;
}

/**
 * Pure function: builds the short "convert an already-learned lesson" prompt (mode: "save-only").
 *
 * `existingLessonText` is the structural fix for the cross-AI case: if the user learned Day X in
 * one AI's chat and is converting it in a *different, fresh* chat (e.g. via the "Open Gemini"
 * link, which always starts empty), relying on "our conversation above" silently fails — the
 * target AI has no such conversation, and may fabricate a plausible-sounding lesson instead of
 * saying so. Embedding the actual lesson text removes that failure mode entirely rather than
 * just warning about it. When it's empty, we fall back to the same-conversation case, but with
 * an explicit instruction not to invent content it doesn't actually have.
 */
export function buildSaveOnlyPrompt(day: number, vocabCount: VocabCount, existingLessonText = ""): string {
  const lessonText = existingLessonText.trim();

  const sourceAndGuard = lessonText
    ? `Here is the lesson exactly as it was taught to me — convert ONLY this into Kiroku's format. Do not add, invent, or fill in anything that isn't actually present in the text below:

"""
${lessonText}
"""`
    : `I already learned Day ${day} earlier in this same conversation — convert it into Kiroku's format using only what was actually taught above.

IMPORTANT: If you don't genuinely have Day ${day}'s lesson in this conversation's history (for example, if this is a fresh chat that never taught it), stop and ask me to paste the lesson text instead of inventing a plausible-sounding Day ${day} lesson from general knowledge.`;

  return `${sourceAndGuard}

${schemaAndExampleBlock(day, vocabCount)}`;
}

/**
 * Pure function: builds the "fix this failed import" prompt used by Phase 3c's Gemini repair
 * (failed text + the schema + the validation errors). Same anti-fabrication stance as
 * `buildSaveOnlyPrompt`: an automated call has no conversation history to lean on, so the model
 * is told to fix only what's present and to answer `{"error": ...}` rather than invent content.
 * Reuses `schemaAndExampleBlock()` so the schema text is never duplicated.
 */
export function buildRepairPrompt(day: number, vocabCount: VocabCount, failedText: string, errors: string[]): string {
  const errorList = errors.length ? errors.map((e) => `- ${e}`).join("\n") : "- (no specific errors were listed)";

  return `The text below was supposed to contain a Japanese lesson for Day ${day} in Kiroku's JSON format, but it failed validation. Fix it.

Validation errors found:
${errorList}

Rules:
- Use ONLY what is actually present in the text below. You may restructure it, rename fields, fix types and clean up formatting, but do not invent, add, or fill in lessons, examples, vocabulary, readings or anything else that isn't there.
- If the text does not contain a usable Day ${day} lesson, or a required part can't be produced without inventing content, do NOT make one up. Reply with only this JSON instead: {"error": "<one short sentence saying what is missing>"}

Text to fix:
"""
${failedText.trim()}
"""

${schemaAndExampleBlock(day, vocabCount)}`;
}

/** Pure function: builds the full copy-paste prompt for a given day and set of options. */
export function buildLessonPrompt(opts: PromptOptions): string {
  const { day, tone, style, level, vocabCount, romaji, customFocus, lessons, progress, mode, existingLessonText } = opts;

  if (mode === "save-only") {
    return buildSaveOnlyPrompt(day, vocabCount, existingLessonText);
  }

  const romajiLine = romaji
    ? "Include romaji alongside every Japanese word and phrase (vocab, examples, natural phrase)."
    : "Do not include romaji anywhere — Japanese script plus readings and English meaning only.";
  const focusLine = customFocus.trim()
    ? `Custom focus for today, if it fits naturally alongside the required grammar/vocab progression: ${customFocus.trim()}.`
    : "";

  const requestBody =
    mode === "learn-save"
      ? `${teachingInstructionsBlock(day, vocabCount)}\n\n${teachThenSaveBridge(day, vocabCount)}`
      : teachingInstructionsBlock(day, vocabCount);

  return `I am learning Japanese with you following a progressive daily method. Act as my teacher for today's lesson.

Role & tone: You are my Japanese tutor for Day ${day}. Target level: JLPT ${level}. ${TONE_INSTRUCTIONS[tone]}
${STYLE_INSTRUCTIONS[style].replace("{vocabCount}", String(vocabCount))}
${romajiLine}
${focusLine ? focusLine + "\n" : ""}
${priorKnowledgeBlock(day, lessons, progress, opts.today ?? localDay())}

=== TODAY'S LESSON REQUEST: DAY ${day} ===
${requestBody}`;
}
