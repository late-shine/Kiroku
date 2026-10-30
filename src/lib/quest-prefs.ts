// Writing quests, Phase Q2 — this device's quest preferences and the page being written. Pure (the storage is passed
// in; no React, no DOM), so it is checked from a plain script (handoffs/phase-Q2-quest-prefs-check.ts).
//
// Device-only, like the voice and atmosphere choices: never in a backup, never synced (plan 2.5). The stored shape is
//   kiroku_quests_v1 = { v: 1, on?: boolean, draft?: { day, keys, step, marks } }
//
// `on` is a TRI-STATE. Absent = the learner never touched the switch: quests count as on only if writing records
// already exist (a restored backup). An explicit true or false always wins. While quests are off nothing writing-related
// shows anywhere.
//
// `draft` is the page that is open right now, so a reload keeps it. It holds the kanji KEYS (never the characters, and
// never an image), which step the learner is on, and the marks made so far. It belongs to one local day: the next day it
// is simply not used (`draftForDay`), and saving the page clears it.
//
// This file also holds the small pure helpers for the cue cards (`cueReadings`, `hideCharacter`, `speakReading`), so the
// check script can reach them without React.
import { cleanReading } from "@/lib/speak-text";
import { isValidDay } from "@/lib/word-memory";
import { WRITING_BLANK, isWritingKey, type PageResult, type PoolKanji } from "@/lib/writing";
import type { KanjiItem, WritingRecord } from "@/types/japanese";

export const QUEST_PREFS_VERSION = 1;
/** A page holds at most this many kanji (an automatic page has 3; Phase Q3 lets the learner choose up to 5). */
export const DRAFT_MAX_KEYS = 5;
/** Readings shown on a cue card, per kind (On, Kun): a prompt, not the whole dictionary entry. */
export const CUE_READINGS_MAX = 3;

export type WritingMark = "right" | "miss";
/** `write` = step 1 (cues, characters hidden); `reveal` = step 3 (characters shown, the learner marks them). */
export type DraftStep = "write" | "reveal";

export interface WritingDraft {
  /** The local day the page was made ("YYYY-MM-DD"). */
  day: string;
  /** The kanji on the page, in page order (item 1 is keys[0]). Distinct `kanjiKey`s. */
  keys: string[];
  step: DraftStep;
  /** The learner's marks so far, only for keys that are on the page. */
  marks: Record<string, WritingMark>;
}

export interface QuestPrefs {
  /** Tri-state: absent (never touched), true, false. */
  on?: boolean;
  draft?: WritingDraft;
}

// ---------------------------------------------------------------------------------------------
// Reading and writing the stored value
// ---------------------------------------------------------------------------------------------

const isRecord = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

/**
 * A stored draft, or undefined when it is not usable. All or nothing on the keys: a page is numbered on paper, so a
 * page with a bad or repeated key is dropped rather than quietly renumbered. A missing or bad `step` reads as `write`
 * (the step that keeps the characters hidden). Marks for keys that are not on the page are dropped. Never throws.
 */
export function parseDraft(raw: unknown): WritingDraft | undefined {
  if (!isRecord(raw)) return undefined;
  const day = raw["day"];
  if (typeof day !== "string" || !isValidDay(day)) return undefined;
  const rawKeys = raw["keys"];
  if (!Array.isArray(rawKeys) || rawKeys.length === 0 || rawKeys.length > DRAFT_MAX_KEYS) {
    return undefined;
  }
  const keys: string[] = [];
  for (const key of rawKeys) {
    if (typeof key !== "string" || !isWritingKey(key) || keys.includes(key)) return undefined;
    keys.push(key);
  }
  const step: DraftStep = raw["step"] === "reveal" ? "reveal" : "write";
  const marks: Record<string, WritingMark> = {};
  const rawMarks = raw["marks"];
  if (isRecord(rawMarks)) {
    for (const key of keys) {
      const mark = rawMarks[key];
      if (mark === "right" || mark === "miss") marks[key] = mark;
    }
  }
  return { day, keys, step, marks };
}

/** Stored prefs as an object. Anything that is not valid is dropped; never throws. */
export function parseQuestPrefs(raw: unknown): QuestPrefs {
  if (!isRecord(raw)) return {};
  const out: QuestPrefs = {};
  const on = raw["on"];
  if (typeof on === "boolean") out.on = on;
  const draft = parseDraft(raw["draft"]);
  if (draft !== undefined) out.draft = draft;
  return out;
}

type Reader = { getItem(key: string): string | null };
type Writer = {
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** The stored text as prefs: absent, not JSON, or not an object all read as "nothing stored". */
export function parseQuestPrefsText(raw: string | null): QuestPrefs {
  if (raw === null) return {};
  try {
    return parseQuestPrefs(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** This device's prefs; a blocked or empty storage reads as nothing stored. */
export function readQuestPrefs(storage: Reader, key: string): QuestPrefs {
  try {
    return parseQuestPrefsText(storage.getItem(key));
  } catch {
    return {};
  }
}

/**
 * The text to store, or null when there is nothing worth keeping (no explicit `on`, no draft): the key is then removed
 * instead of holding an empty shell, so "Reset everything" and a fresh app leave no trace.
 */
export function serialiseQuestPrefs(prefs: QuestPrefs): string | null {
  const { on, draft } = prefs;
  if (on === undefined && draft === undefined) return null;
  return JSON.stringify({
    v: QUEST_PREFS_VERSION,
    ...(on !== undefined ? { on } : {}),
    ...(draft !== undefined
      ? { draft: { day: draft.day, keys: draft.keys, step: draft.step, marks: draft.marks } }
      : {}),
  });
}

/** Stores the prefs (or removes the key when there is nothing to keep). A blocked or full storage is not an error. */
export function writeQuestPrefs(storage: Writer, key: string, prefs: QuestPrefs): void {
  try {
    const text = serialiseQuestPrefs(prefs);
    if (text === null) storage.removeItem(key);
    else storage.setItem(key, text);
  } catch {
    /* storage blocked or full: the choice just won't survive a reload */
  }
}

// ---------------------------------------------------------------------------------------------
// The switch
// ---------------------------------------------------------------------------------------------

/**
 * Whether writing practice is on. An explicit choice (true or false) always wins; with no choice stored, it is on only
 * if writing records already exist (for example a restored backup), so that data never hides itself.
 */
export function questsEnabled(
  prefs: QuestPrefs,
  writing: Readonly<Record<string, WritingRecord>>,
): boolean {
  if (prefs.on !== undefined) return prefs.on;
  return Object.keys(writing).length > 0;
}

// ---------------------------------------------------------------------------------------------
// The draft page
// ---------------------------------------------------------------------------------------------

/** A new page for `day`: step 1, nothing marked. Repeated keys are dropped and the page is capped at `DRAFT_MAX_KEYS`. */
export function newDraft(day: string, keys: readonly string[]): WritingDraft {
  return { day, keys: [...new Set(keys)].slice(0, DRAFT_MAX_KEYS), step: "write", marks: {} };
}

/** The draft only while it belongs to `today`: after local midnight yesterday's page is not used. */
export function draftForDay(draft: WritingDraft | undefined, today: string): WritingDraft | null {
  return draft !== undefined && draft.day === today ? draft : null;
}

/** Step 3. The same object comes back when the page is already there. */
export function revealDraft(draft: WritingDraft): WritingDraft {
  return draft.step === "reveal" ? draft : { ...draft, step: "reveal" };
}

/**
 * Sets (or, with `null`, clears) the mark for one kanji. A key that is not on the page changes nothing (the same
 * object comes back).
 */
export function markDraft(
  draft: WritingDraft,
  key: string,
  mark: WritingMark | null,
): WritingDraft {
  if (!draft.keys.includes(key)) return draft;
  const marks = { ...draft.marks };
  if (mark === null) delete marks[key];
  else marks[key] = mark;
  return { ...draft, marks };
}

/** One card on the page: its number on paper (1-based, the key's place on the page) and the kanji it shows. */
export interface DraftCard {
  n: number;
  entry: PoolKanji;
}

/**
 * The page's cards, in page order, each keeping its ORIGINAL number. A kanji whose lesson was deleted since the page was
 * made is left out (the numbers on the learner's paper stay true for the others).
 */
export function resolveDraft(draft: WritingDraft, pool: readonly PoolKanji[]): DraftCard[] {
  const byKey = new Map(pool.map((entry) => [entry.key, entry]));
  const cards: DraftCard[] = [];
  draft.keys.forEach((key, index) => {
    const entry = byKey.get(key);
    if (entry !== undefined) cards.push({ n: index + 1, entry });
  });
  return cards;
}

/** True when there is something to save and every one of `keys` has a mark. */
export function allMarked(draft: WritingDraft, keys: readonly string[]): boolean {
  return keys.length > 0 && keys.every((key) => draft.marks[key] !== undefined);
}

/** How many of `keys` carry a mark. */
export function markedCount(draft: WritingDraft, keys: readonly string[]): number {
  return keys.filter((key) => draft.marks[key] !== undefined).length;
}

/**
 * The results to save, in page order, for the marked ones among `keys`. There is no photo in Phase Q2, so no result
 * carries `photoMatch` (Phase Q5 adds it).
 */
export function draftResults(draft: WritingDraft, keys: readonly string[]): PageResult[] {
  const results: PageResult[] = [];
  for (const key of keys) {
    const mark = draft.marks[key];
    if (mark !== undefined) results.push({ key, right: mark === "right" });
  }
  return results;
}

// ---------------------------------------------------------------------------------------------
// Cue-card text
// ---------------------------------------------------------------------------------------------

/**
 * `text` with every copy of the character swapped for the blank (＿), so nothing on a cue card can give the answer away
 * before the reveal (the lesson's own meaning or reading text is AI-written, so this is a safety net, not a rule the
 * data is expected to break).
 */
export function hideCharacter(text: string, character: string): string {
  const target = character.trim().normalize("NFC");
  if (target === "") return text;
  return text.normalize("NFC").split(target).join(WRITING_BLANK);
}

const cleanedList = (raw: readonly string[]): string[] => {
  const out: string[] = [];
  for (const reading of raw) {
    const cleaned = cleanReading(reading);
    if (cleaned !== "" && !out.includes(cleaned)) out.push(cleaned);
    if (out.length >= CUE_READINGS_MAX) break;
  }
  return out;
};

/** The readings to show on a cue card: each entry through `cleanReading`, empty ones dropped, at most 3 of each kind. */
export function cueReadings(item: Pick<KanjiItem, "onyomi" | "kunyomi">): {
  on: string[];
  kun: string[];
} {
  return { on: cleanedList(item.onyomi), kun: cleanedList(item.kunyomi) };
}

/**
 * What the speaker button says after the reveal: the first usable kun'yomi, else the first usable on'yomi, else "" (the
 * button then hides). Unlike `speakableReading` it never falls back to the character: quests use `cleanReading` only.
 */
export function speakReading(item: Pick<KanjiItem, "onyomi" | "kunyomi">): string {
  const { on, kun } = cueReadings(item);
  return kun[0] ?? on[0] ?? "";
}
