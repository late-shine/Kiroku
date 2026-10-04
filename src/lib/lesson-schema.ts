import { z } from "zod";
import type { DayLesson } from "@/types/japanese";

export const grammarExampleSchema = z.object({
  japanese: z.string().min(1, "japanese text is required"),
  reading: z.string().min(1, "reading is required"),
  english: z.string().min(1, "english translation is required"),
  breakdown: z.string().optional(),
});

export const grammarPointSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  structure: z.string().min(1),
  explanation: z.string().min(1),
  negativeForm: z.string().optional(),
  questionForm: z.string().optional(),
  notes: z.array(z.string()).optional(),
  examples: z.array(grammarExampleSchema).min(3, "include at least 3 worked examples"),
});

export const kanjiCompoundSchema = z.object({
  word: z.string().min(1),
  reading: z.string().min(1),
  meaning: z.string().min(1),
});

export const kanjiItemSchema = z.object({
  character: z.string().min(1),
  meaning: z.string().min(1),
  strokes: z.number().int().positive(),
  onyomi: z.array(z.string()),
  kunyomi: z.array(z.string()),
  compounds: z.array(kanjiCompoundSchema).min(1, "include at least one compound"),
  rendakuNote: z.string().optional(),
  memoryTip: z.string().optional(),
  radical: z.string().optional(),
});

export const vocabWordSchema = z.object({
  id: z.string().regex(/^d\d+-\d+$/, "id must look like d{day}-{n}, e.g. d14-1"),
  japanese: z.string().min(1),
  reading: z.string().min(1),
  romaji: z.string().optional(),
  meaning: z.string().min(1),
  category: z.string().optional(),
  day: z.number().int().positive(),
  mastered: z.boolean().optional(),
});

export const naturalPhraseSchema = z.object({
  phrase: z.string().min(1),
  reading: z.string().min(1),
  meaning: z.string().min(1),
  context: z.string().min(1),
});

export const dayLessonSchema = z.object({
  dayNumber: z.number().int().positive(),
  title: z.string().min(1),
  topic: z.string().min(1),
  completed: z.boolean().optional(),
  dateCompleted: z.string().optional(),
  grammar: grammarPointSchema,
  kanji: kanjiItemSchema,
  vocab: z.array(vocabWordSchema).min(1, "include at least one vocab word"),
  naturalPhrase: naturalPhraseSchema,
  pattern: z.string().min(1),
  cultureCorner: z.string().optional(),
});

/**
 * Finds a JSON object inside free-form text: prefers a ```json fenced block,
 * falls back to the first "{" through the last "}" in the text.
 */
export function extractJsonBlock(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

/**
 * Best-effort read of `"dayNumber": N` from pasted text that may not be valid JSON
 * (used so "Fix with Gemini" repairs the day the text is actually for). Null if absent.
 */
export function detectDayNumber(text: string): number | null {
  const m = text.match(/"dayNumber"\s*:\s*(\d{1,4})\b/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Drops a leading "Day 14:" from a lesson title so UI that adds its own "Day N:" doesn't double it. */
export function stripDayPrefix(title: string): string {
  const stripped = title.replace(/^\s*day\s*\d+\s*[:\-\u2013\u2014.]\s*/i, "").trim();
  return stripped || title;
}

export interface LessonImportResult {
  success: boolean;
  lesson?: DayLesson;
  errors: string[];
}

/** Extracts JSON from pasted AI output and validates it against the DayLesson shape. */
export function parseLessonFromText(text: string): LessonImportResult {
  const block = extractJsonBlock(text);
  if (!block) {
    return {
      success: false,
      errors: ["No JSON object found in the pasted text — make sure the AI's reply includes a JSON code block."],
    };
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(block);
  } catch (e) {
    return { success: false, errors: [`The JSON couldn't be parsed: ${(e as Error).message}`] };
  }

  const result = dayLessonSchema.safeParse(rawJson);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return { success: false, errors };
  }

  return {
    success: true,
    lesson: { completed: false, ...result.data } as DayLesson,
    errors: [],
  };
}
