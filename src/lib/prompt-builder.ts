import type { DayLesson, UserProgressState, VocabWord } from "@/types/japanese";
import { selectReinforcementWords } from "@/lib/reinforcement";

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
// Phase 17: how many kanji / grammar points one day teaches (the lesson holds arrays of 1–5 and 1–3).
export const KANJI_COUNTS = [1, 3, 5] as const;
export type KanjiCount = (typeof KANJI_COUNTS)[number];
export const GRAMMAR_COUNTS = [1, 2, 3] as const;
export type GrammarCount = (typeof GRAMMAR_COUNTS)[number];
/** The exact number of entries a Learn prompt asks for. `null` (Save only, repair) means "one per item actually present". */
type PointCounts = { kanji: KanjiCount; grammar: GrammarCount } | null;

export interface PromptOptions {
  day: number;
  tone: Tone;
  style: LessonStyle;
  level: JlptLevel;
  vocabCount: VocabCount;
  /** Phase 17: kanji per day (1 / 3 / 5). */
  kanjiCount: KanjiCount;
  /** Phase 17: grammar points per day (1 / 2 / 3). */
  grammarCount: GrammarCount;
  romaji: boolean;
  customFocus: string;
  lessons: DayLesson[];
  mode: PromptMode;
  /** Only read when mode is "save-only" — see buildSaveOnlyPrompt. */
  existingLessonText: string;
  /**
   * Reinforcement plan, Phase 3: only `progress.vocabMemory` is read, and only to build the reinforcement list (the
   * earlier-lessons tracker itself still ignores it: the one-miss weak paragraph and the Phase 14c due-review block
   * are gone). Save only never reads it.
   */
  progress: UserProgressState;
  /**
   * Reinforcement plan, Phase 3: today's LOCAL calendar day, "YYYY-MM-DD", the reference point for the 14-day window.
   * A pure function must not read the clock, so the caller supplies it. When it is missing (or not a real date) the
   * prompt simply has no reinforcement block; nothing else changes.
   */
  today?: string | undefined;
}

// ---- Reinforcement plan, Phase 1: the earlier-lessons tracker -----------------------------------------------------

/** The key two vocabulary entries must share to count as the same word: Japanese text AND reading (so homographs stay apart). */
const vocabKey = (v: VocabWord): string =>
  `${v.japanese.normalize("NFC").trim()}\u0000${v.reading.normalize("NFC").trim()}`;

/**
 * One entry per distinct word, in the order first seen. Two entries are the same word only when BOTH the Japanese text and
 * the reading match (after trimming and NFC normalisation); an entry with no Japanese text is skipped. Pure.
 */
export function dedupeVocab(words: readonly VocabWord[]): VocabWord[] {
  const seen = new Set<string>();
  const out: VocabWord[] = [];
  for (const v of words) {
    if (v.japanese.normalize("NFC").trim() === "") continue;
    const key = vocabKey(v);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * The real day numbers as a short label, gaps included: [1,2,3,5,6,8] -> "Days 1-3, 5-6, 8"; [4] -> "Day 4".
 * Sorted and de-duplicated first, so the label never claims a day that is not there (a deleted Day 6 is a gap, not "1 to 7"). Pure.
 */
export function describeDays(days: readonly number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 0) return "none";
  const parts: string[] = [];
  let from = sorted[0] as number;
  let prev = from;
  for (const d of sorted.slice(1)) {
    if (d === prev + 1) {
      prev = d;
      continue;
    }
    parts.push(from === prev ? String(from) : `${from}-${prev}`);
    from = d;
    prev = d;
  }
  parts.push(from === prev ? String(from) : `${from}-${prev}`);
  return `${sorted.length === 1 ? "Day" : "Days"} ${parts.join(", ")}`;
}

/**
 * The progress tracker the AI reads before teaching. It covers every STORED earlier lesson (`dayNumber < day`), not only the
 * days marked Done: Done is a manual toggle, and an unticked day would otherwise be taught again. Vocabulary is Japanese only
 * (no reading, no meaning, no romaji) and de-duplicated by Japanese + reading; grammar and kanji are listed in full.
 * There is deliberately no weak-word or due-review text here any more (see kiroku-ai-reinforcement-plan.md). Pure.
 */
function priorKnowledgeBlock(day: number, lessons: DayLesson[]): string {
  const prior = lessons.filter((l) => l.dayNumber < day).sort((a, b) => a.dayNumber - b.dayNumber);

  if (day <= 1 || prior.length === 0) {
    return `This is the learner's very first lesson. Assume ZERO prior Japanese knowledge — no hiragana, no katakana, no grammar, nothing. As part of today's material, briefly introduce hiragana and katakana just enough for the learner to read what you teach, and make です (polite copula, "is/am/are") and だ (its plain-form counterpart) the core grammar point of the day.`;
  }

  // Phase 17: a day can teach several grammar points / kanji — every one is listed (one grammar line per point).
  const grammarSummary = prior
    .flatMap((l) => l.grammar.map((g) => `Day ${l.dayNumber}: ${g.title} (${g.structure})`))
    .join("\n");
  const kanjiSummary = prior
    .flatMap((l) => l.kanji)
    .map((k) => `${k.character} (${k.meaning} — On: ${k.onyomi.join("/") || "—"} / Kun: ${k.kunyomi.join("/") || "—"})`)
    .join(", ");
  const knownVocab = dedupeVocab(prior.flatMap((l) => l.vocab));
  const vocabSummary = knownVocab.map((v) => v.japanese.trim()).join(", ");
  const vocabLabel = `Known vocabulary (${knownVocab.length} word${knownVocab.length === 1 ? "" : "s"}, Japanese only)`;

  return `To ensure you never assume grammar or vocabulary the learner hasn't been taught yet, here is their exact progress tracker so far:

=== LESSONS SO FAR (${describeDays(prior.map((l) => l.dayNumber))}) ===
Grammar covered:
${grammarSummary}

Kanji taught:
${kanjiSummary}

${vocabLabel}:
${vocabSummary || "(none recorded)"}

IMPORTANT: Do NOT skip ahead or assume any grammatical form or vocabulary beyond what's listed above.`;
}

// ---- Reinforcement plan, Phase 3: the reinforcement list ------------------------------------------------------------

/**
 * The earlier words this prompt asks the tutor to weave back in (see `selectReinforcementWords`: earlier lesson, miss
 * streak of at least 2, last real answer within about 14 days, at most 3). Empty for Save only, for a prompt with no
 * earlier lesson (Day 1 / an empty curriculum, which has no tracker either) and when `today` is missing.
 * `buildLessonPrompt` and the Lesson Studio's note both call this, so what the user is told is what the prompt holds. Pure.
 */
export function reinforcementWordsForPrompt(
  opts: Pick<PromptOptions, "day" | "mode" | "lessons" | "progress" | "today">,
): VocabWord[] {
  if (opts.mode === "save-only" || opts.today === undefined) return [];
  if (!(opts.day > 1 && opts.lessons.some((l) => l.dayNumber < opts.day))) return [];
  return selectReinforcementWords(opts.day, opts.lessons, opts.progress.vocabMemory, opts.today);
}

/**
 * The reinforcement block: the words, Japanese only (no reading, meaning, romaji or miss count), and what the tutor may
 * and may not do with them. They are NOT new words: they stay out of today's vocabulary list and the lesson stays a
 * new lesson. Empty string when there is nothing to reinforce. DRAFT WORDING, awaiting the user's approval. Pure.
 */
function reinforcementBlock(words: readonly VocabWord[], vocabCount: number): string {
  if (words.length === 0) return "";
  const list = words.map((w) => `- ${w.japanese.trim()}`).join("\n");
  return `=== WORDS TO REINFORCE (${words.length} earlier word${words.length === 1 ? "" : "s"}, Japanese only) ===
The learner got these earlier words wrong on at least two different days recently:
${list}

Use them where they fit today's topic naturally, for example in example sentences, breakdowns or the natural phrase. They are NOT new words: do not teach them again, do not put them in today's vocabulary list (it still holds exactly ${vocabCount} new words), and do not turn today's lesson into a review lesson. If one does not fit naturally, leave it out rather than forcing it.`;
}

function schemaAndExampleBlock(day: number, vocabCount: number, counts: PointCounts): string {
  // Phase 17: "grammar" and "kanji" are lists. A Learn prompt asks for an exact number; Save only and repair must never
  // invent, so they ask for one entry per item actually present in the text.
  const grammarNote = counts
    ? `exactly ${counts.grammar} ${counts.grammar === 1 ? "entry" : "entries"}`
    : "one entry per grammar point actually present in the text (1 to 3), never invent one";
  const kanjiNote = counts
    ? `exactly ${counts.kanji} ${counts.kanji === 1 ? "entry" : "entries"}`
    : "one entry per kanji actually present in the text (1 to 5), never invent one";
  const compoundsNote = !counts
    ? "every compound the text lists for that kanji, at least 1"
    : counts.kanji === 1
      ? "5 or more"
      : "at least 3 per kanji";
  const examplesNote = counts && counts.grammar > 1 ? "at least 3 in each grammar point" : "at least 3";
  const listsNote =
    !counts || counts.grammar > 1 || counts.kanji > 1
      ? `\nThe example shows ONE entry in each of "grammar" and "kanji" to save space — follow the entry counts above, not the example.`
      : "";

  return `Return the lesson as exactly ONE JSON code block (\`\`\`json ... \`\`\`) matching this structure exactly — no extra prose inside the code block, and no fields beyond these:

{
  "dayNumber": number,
  "title": string,
  "topic": string,
  "grammar": [  // ${grammarNote}
    {
      "title": string, "summary": string, "structure": string, "explanation": string,
      "negativeForm": string, "questionForm": string, "notes": string[],
      "examples": [ { "japanese": string, "reading": string, "english": string, "breakdown": string } ]  // ${examplesNote}
    }
  ],
  "kanji": [  // ${kanjiNote}
    {
      "character": string, "meaning": string, "strokes": number, "radical": string,
      "onyomi": string[], "kunyomi": string[],
      "compounds": [ { "word": string, "reading": string, "meaning": string } ],  // ${compoundsNote}
      "rendakuNote": string, "memoryTip": string
    }
  ],
  "vocab": [ { "id": "d${day}-1", "japanese": string, "reading": string, "meaning": string, "day": ${day} } ],  // exactly ${vocabCount} entries, ids d${day}-1 through d${day}-${vocabCount}
  "naturalPhrase": { "phrase": string, "reading": string, "meaning": string, "context": string },
  "pattern": string,
  "cultureCorner": string
}

Example below shows the FORMAT only — write real Day ${day} content, not this placeholder text:${listsNote}
\`\`\`json
{
  "dayNumber": ${day},
  "title": "<short title — no 'Day N' prefix, the app adds that>",
  "topic": "<one-line topic>",
  "grammar": [ { "title": "...", "summary": "...", "structure": "...", "explanation": "...", "negativeForm": "...", "questionForm": "...", "notes": ["..."], "examples": [ { "japanese": "...", "reading": "...", "english": "...", "breakdown": "..." } ] } ],
  "kanji": [ { "character": "力", "meaning": "Power / Strength", "strokes": 2, "radical": "力", "onyomi": ["リョク", "リキ"], "kunyomi": ["ちから"], "compounds": [ { "word": "努力", "reading": "どりょく", "meaning": "effort" } ], "rendakuNote": "...", "memoryTip": "..." } ],
  "vocab": [ { "id": "d${day}-1", "japanese": "...", "reading": "...", "meaning": "...", "day": ${day} } ],
  "naturalPhrase": { "phrase": "...", "reading": "...", "meaning": "...", "context": "..." },
  "pattern": "...",
  "cultureCorner": "..."
}
\`\`\``;
}

// Shared by "learn-save" and "learn-only" — the actual teaching ask, in prose (not a data-form request).
// Phase 17: with one grammar point / one kanji the wording is exactly what it was before; with more, items 1 and 2 ask for N of each.
function teachingInstructionsBlock(day: number, vocabCount: number, grammarCount: number, kanjiCount: number): string {
  const grammarItem =
    grammarCount === 1
      ? "Grammar Point — structure, a clear explanation, the negative form, the question form, any extra notes, and at least 3 worked examples (Japanese, reading, English, and a short breakdown of each)."
      : `${grammarCount} Grammar Points — for EACH one: structure, a clear explanation, the negative form, the question form, any extra notes, and at least 3 worked examples (Japanese, reading, English, and a short breakdown of each). Teach them one after another, clearly separated.`;
  const kanjiItem =
    kanjiCount === 1
      ? "Kanji of the Day — one character with its meaning, stroke count, radical, on'yomi, kun'yomi, 5 or more common compounds (word, reading, meaning), a rendaku/sound-change note if relevant, and a vivid memory tip."
      : `${kanjiCount} Kanji of the Day — for EACH one: the character with its meaning, stroke count, radical, on'yomi, kun'yomi, at least 3 common compounds (word, reading, meaning), a rendaku/sound-change note if relevant, and a vivid memory tip. Teach them one after another, clearly separated.`;
  return `Teach me Day ${day} like a real tutor would — in your own natural voice, not as a
data form. Cover exactly these six things, each fully explained, in plain
readable prose with real examples:
1. ${grammarItem}
2. ${kanjiItem}
3. ${vocabCount} Themed Vocabulary Words — Japanese, reading, English meaning, matching today's topic.
4. A Natural Japanese Phrase / colloquial reaction — phrase, reading, meaning, and the natural context where it's used.
5. Pattern of the Day — one key structural or phonetic takeaway.
6. Tiny Culture Corner — a brief, authentic cultural insight related to today's topic.

Keep everything beginner-appropriate for someone who only knows what's listed above — do not skip ahead.`;
}

/**
 * Phase 17 — the analysis-first block (DRAFT WORDING, awaiting the user's approval; see handoffs/phase-17.md). It makes
 * the AI read the progress tracker and show its working before it teaches. `extractJsonBlock` ignores prose around the
 * JSON, so the Check section never affects an import. Only Learn + Save and Learn only carry it, and only when there IS
 * a tracker above it (Day 1 / an empty curriculum has nothing to check against).
 *
 * Reinforcement plan, Phase 1: the grammar part of the wording was softened (exact repeats are still avoided; a meaningful revisit
 * is allowed if it is named as one). DRAFT WORDING, awaiting the user's approval; see handoffs/reinforcement-phase-1.md.
 */
function analysisFirstBlock(grammarCount: number, kanjiCount: number): string {
  const grammar = `${grammarCount} grammar point${grammarCount === 1 ? "" : "s"}`;
  return `BEFORE YOU WRITE ANYTHING — start your reply with a short "Check" section (at most 8 lines, plain text, no JSON): (1) the highest earlier day listed above; (2) how many grammar points, kanji and vocabulary words are already known, and the titles of the five most recent grammar points; (3) today's ${grammar} and ${kanjiCount} kanji, named. State that none of the kanji appear in the lists above (including other readings of the same kanji) and that no grammar point repeats an earlier one exactly. A grammar form or particle may be revisited only when today's use adds a new function, nuance or contrast: if so, name it as a revisit and say what is new. If a kanji would repeat, or a grammar point would repeat with nothing new, choose a different one first. If the progress tracker above looks missing or cut off, stop and ask me to paste it instead of guessing. Only then start the lesson.`;
}

// The bridge from "done teaching" into the data block — only used by mode: "learn-save".
function teachThenSaveBridge(day: number, vocabCount: number, counts: PointCounts): string {
  return `When you're done teaching, add one short natural sentence letting me know
what's coming next — for example: "Since you're using Kiroku to save your
progress, here's the block to paste back into Kiroku's Import screen." Then
output the same lesson as one JSON code block, exactly as specified below.

${schemaAndExampleBlock(day, vocabCount, counts)}`;
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

${schemaAndExampleBlock(day, vocabCount, null)}`;
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

${schemaAndExampleBlock(day, vocabCount, null)}`;
}

/** Pure function: builds the full copy-paste prompt for a given day and set of options. */
export function buildLessonPrompt(opts: PromptOptions): string {
  const { day, tone, style, level, vocabCount, kanjiCount, grammarCount, romaji, customFocus, lessons, mode, existingLessonText } = opts;

  if (mode === "save-only") {
    return buildSaveOnlyPrompt(day, vocabCount, existingLessonText);
  }

  const romajiLine = romaji
    ? "Include romaji alongside every Japanese word and phrase (vocab, examples, natural phrase)."
    : "Do not include romaji anywhere — Japanese script plus readings and English meaning only.";
  const focusLine = customFocus.trim()
    ? `Custom focus for today, if it fits naturally alongside the required grammar/vocab progression: ${customFocus.trim()}.`
    : "";

  const counts: PointCounts = { kanji: kanjiCount, grammar: grammarCount };
  const teaching = teachingInstructionsBlock(day, vocabCount, grammarCount, kanjiCount);
  const requestBody =
    mode === "learn-save" ? `${teaching}\n\n${teachThenSaveBridge(day, vocabCount, counts)}` : teaching;

  // Phase 17: the "Check" block sits right after the progress tracker, so it only exists when a tracker does.
  const hasTracker = day > 1 && lessons.some((l) => l.dayNumber < day);
  const checkBlock = hasTracker ? `\n\n${analysisFirstBlock(grammarCount, kanjiCount)}` : "";

  // Phase 3: the reinforcement list sits between the tracker and the Check block (empty when there is nothing to reinforce).
  const reinforcement = reinforcementBlock(reinforcementWordsForPrompt(opts), vocabCount);
  const reinforcementPart = reinforcement ? `\n\n${reinforcement}` : "";

  return `I am learning Japanese with you following a progressive daily method. Act as my teacher for today's lesson.

Role & tone: You are my Japanese tutor for Day ${day}. Target level: JLPT ${level}. ${TONE_INSTRUCTIONS[tone]}
${STYLE_INSTRUCTIONS[style].replace("{vocabCount}", String(vocabCount))}
${romajiLine}
${focusLine ? focusLine + "\n" : ""}
${priorKnowledgeBlock(day, lessons)}${reinforcementPart}${checkBlock}

=== TODAY'S LESSON REQUEST: DAY ${day} ===
${requestBody}`;
}
