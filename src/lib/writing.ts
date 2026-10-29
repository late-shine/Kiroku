// Writing quests, Phase Q1 — the pure rules behind the optional pen-and-paper writing pages. No React, no
// localStorage, no DOM, no network, so everything here is testable from a plain script
// (handoffs/phase-Q1-writing-check.ts).
//
// The idea (kiroku-quest-plan-merged.md, sections 2.1, 2.3 and 2.5): Kiroku chooses three kanji from the learner's own
// lessons, shows meaning + readings + a blanked compound, the learner writes them on PAPER from memory, and then marks
// each one "Wrote it right" or "Not yet". The learner's own mark is the record. Nothing here judges strokes, and
// nothing here touches the Leitner schedule (`vocabMemory`), the quiz counters or the study log.
//
// Days are LOCAL calendar days ("YYYY-MM-DD"), the same ones `word-memory.ts` uses; `today` is always passed in so
// every function is deterministic (no clock reads, no randomness).
//
// Storage shape (the types live in `src/types/japanese.ts`):
//   progress.writing:    Record<kanjiKey, WritingRecord>   kanjiKey = "u" + lowercase hex code point (力 -> "u529b")
//   progress.writingLog: Record<day, WritingDay>           the last 120 days only
//   progress.badges:     Record<badgeId, day>              nothing grants these until Phase Q6
// Both the backup (v6) and the localStorage reader go through the schemas below. Sync does not carry them until Q10.
import { z } from "zod";
import { addDays, isValidDay } from "@/lib/word-memory";
import type { DayLesson, KanjiItem, WritingDay, WritingRecord } from "@/types/japanese";

// ---------------------------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------------------------

/** Kanji on one automatic page. */
export const WRITING_PAGE_SIZE = 3;
/** A never-attempted kanji is "fresh" while its lesson is among the newest this many lessons (by count, not by date). */
export const WRITING_FRESH_LESSONS = 4;
/** A kanji is carved once it was written right on this many DIFFERENT local days. */
export const CARVE_DAYS = 2;
/** How many recent days a record keeps for `ok` and for `miss` each. */
export const WRITING_KEEP_DAYS = 3;
/** `writingLog` keeps this many local days (today and the days before it), like the study log. */
export const WRITING_LOG_KEEP = 120;
/** What replaces the kanji in a compound cue: 努力 becomes 努＿ when 力 is the one being written. */
export const WRITING_BLANK = "＿";

// ---------------------------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------------------------

// "u" + 4 to 6 lowercase hex digits. This is also what the Q10 database rule will require, and it contains none of
// the characters Firebase forbids in a key (. $ # [ ] /).
const KEY_RE = /^u[0-9a-f]{4,6}$/;
// Exactly one CJK ideograph code point (so 々 〆 〇, kana, Latin and emoji are all refused).
const ONE_IDEOGRAPH = /^\p{Unified_Ideograph}$/u;
const IDEOGRAPH = /\p{Unified_Ideograph}/u;

export const isWritingKey = (s: string): boolean => KEY_RE.test(s);

/**
 * The record key for a character: "u" + its lowercase hex code point (力 -> "u529b"), or null unless the text is
 * exactly one CJK ideograph. The text is trimmed and NFC-normalised first, so a stray space or a compatibility form
 * from the AI maps to the ordinary character's key.
 */
export function kanjiKey(ch: string): string | null {
  const s = ch.trim().normalize("NFC");
  if (!ONE_IDEOGRAPH.test(s)) return null;
  const cp = s.codePointAt(0);
  return cp === undefined ? null : `u${cp.toString(16)}`;
}

// ---------------------------------------------------------------------------------------------
// Schemas (backup restore uses these strictly; localStorage uses the `parseStored…` readers)
// ---------------------------------------------------------------------------------------------

const dayStringSchema = z.string().refine(isValidDay, "days look like 2026-10-13");

/** Distinct valid days, ascending, only the last `WRITING_KEEP_DAYS`. */
function normaliseDays(days: readonly string[]): string[] {
  return [...new Set(days.filter(isValidDay))].sort().slice(-WRITING_KEEP_DAYS);
}

/**
 * The one definition of a valid writing record. Its output is canonical: `ok` and `miss` are always present (a missing
 * one reads as none), distinct, ascending and at most 3 long; `v` is present only when it is `true`, never `undefined`
 * (the Firebase SDK throws on an undefined value, and `exactOptionalPropertyTypes` forbids it).
 */
export const writingRecordSchema = z
  .object({
    ok: z.array(dayStringSchema).transform(normaliseDays).optional(),
    miss: z.array(dayStringSchema).transform(normaliseDays).optional(),
    v: z.literal(true).optional(),
  })
  .transform(({ ok, miss, v }): WritingRecord => ({
    ok: ok ?? [],
    miss: miss ?? [],
    ...(v === true ? { v: true as const } : {}),
  }));

const hasMarks = (rec: WritingRecord): boolean => rec.ok.length > 0 || rec.miss.length > 0;

function dropEmptyRecords(map: Record<string, WritingRecord>): Record<string, WritingRecord> {
  const out: Record<string, WritingRecord> = {};
  for (const [key, rec] of Object.entries(map)) if (hasMarks(rec)) out[key] = rec;
  return out;
}

/** `progress.writing` in a backup: keys look like u529b; a record with no day at all is dropped (the canonical form). */
export const writingSchema = z
  .record(z.string().regex(KEY_RE, "writing keys look like u529b"), writingRecordSchema)
  .transform(dropEmptyRecords);

/** One day of the log. `p` is omitted when 0; `ok <= n` and `p <= ok` must hold. */
export const writingDaySchema = z
  .object({
    n: z.number().int().nonnegative(),
    ok: z.number().int().nonnegative(),
    p: z.number().int().nonnegative().optional(),
  })
  .refine((d) => d.ok <= d.n, "ok can't be more than n")
  .refine((d) => (d.p ?? 0) <= d.ok, "p can't be more than ok")
  .transform(({ n, ok, p }): WritingDay => (p !== undefined && p > 0 ? { n, ok, p } : { n, ok }));

/** `progress.writingLog` in a backup: keys are real local days like 2026-10-13. */
export const writingLogSchema = z.record(dayStringSchema, writingDaySchema);

/** `progress.badges` in a backup: badge id -> the local day it was first earned. (Phase Q6 grants them.) */
export const badgesSchema = z.record(
  z.string().regex(/^[a-z0-9-]{1,40}$/, "badge ids look like first-carve"),
  dayStringSchema,
);

const isPlainObject = (raw: unknown): raw is Record<string, unknown> =>
  typeof raw === "object" && raw !== null && !Array.isArray(raw);

/**
 * Lenient read for localStorage: anything that isn't a valid record is dropped, and it never throws. The one exception
 * is a damaged `v` on an otherwise valid record: that reads as "no photo tick", so a bad optional field can't cost a
 * kanji its days (the same way a damaged `streak` is handled for words).
 */
export function parseStoredWriting(raw: unknown): Record<string, WritingRecord> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, WritingRecord> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!KEY_RE.test(key)) continue;
    let result = writingRecordSchema.safeParse(value);
    if (!result.success && isPlainObject(value) && "v" in value) {
      const { v: _v, ...withoutV } = value;
      result = writingRecordSchema.safeParse(withoutV);
    }
    if (result.success && hasMarks(result.data)) out[key] = result.data;
  }
  return out;
}

/** Lenient read of `writingLog` for localStorage: invalid days and invalid entries are dropped; never throws. */
export function parseStoredWritingLog(raw: unknown): Record<string, WritingDay> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, WritingDay> = {};
  for (const [day, value] of Object.entries(raw)) {
    if (!isValidDay(day)) continue;
    const result = writingDaySchema.safeParse(value);
    if (result.success) out[day] = result.data;
  }
  return out;
}

/** Lenient read of `badges` for localStorage: anything that isn't `id -> valid day` is dropped; never throws. */
export function parseStoredBadges(raw: unknown): Record<string, string> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!/^[a-z0-9-]{1,40}$/.test(id)) continue;
    if (typeof value === "string" && isValidDay(value)) out[id] = value;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The pool: every distinct kanji in the stored lessons
// ---------------------------------------------------------------------------------------------

/** One distinct kanji of the curriculum, taken from the NEWEST lesson that teaches it. */
export interface PoolKanji {
  key: string;
  kanji: KanjiItem;
  /** `dayNumber` of that newest lesson. */
  day: number;
}

/**
 * Every distinct kanji in `lessons`, keyed by code point. If one character appears in two lessons, the later
 * `dayNumber` wins (its meaning, strokes, readings and compounds). A character that is not exactly one ideograph
 * has no key and is skipped. Sorted by key, so the result does not depend on the order of the lessons.
 */
export function poolKanji(lessons: readonly DayLesson[]): PoolKanji[] {
  const byKey = new Map<string, PoolKanji>();
  const ordered = [...lessons].sort((a, b) => a.dayNumber - b.dayNumber);
  for (const lesson of ordered) {
    for (const kanji of lesson.kanji) {
      const key = kanjiKey(kanji.character);
      if (key !== null) byKey.set(key, { key, kanji, day: lesson.dayNumber });
    }
  }
  return [...byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** The keys of every kanji the learner has been taught (the set `compoundCue` checks against). */
export function knownKanji(lessons: readonly DayLesson[]): Set<string> {
  return new Set(poolKanji(lessons).map((p) => p.key));
}

/** `dayNumber`s of the newest `WRITING_FRESH_LESSONS` lessons, counted by lessons (a gap in day numbers costs nothing). */
function freshDays(lessons: readonly DayLesson[]): Set<number> {
  const days = [...new Set(lessons.map((l) => l.dayNumber))].sort((a, b) => b - a);
  return new Set(days.slice(0, WRITING_FRESH_LESSONS));
}

// ---------------------------------------------------------------------------------------------
// Compound cue
// ---------------------------------------------------------------------------------------------

export interface CompoundCue {
  /** The compound with every copy of the kanji replaced by `＿`, e.g. 努＿. Never contains the kanji. */
  cue: string;
  /** The compound's whole reading, as the lesson stores it (e.g. どりょく). */
  reading: string;
  meaning: string;
}

/**
 * The one compound to show as a cue for `item`: the FIRST compound in the lesson that contains the kanji, has at least
 * one other character, and whose every other ideograph is a kanji the learner has been taught (`known` = `knownKanji`).
 * A compound that would lean on an untaught kanji is skipped; with none left this returns null and the cue line is
 * dropped. Deterministic; never contains the character being written.
 */
export function compoundCue(item: KanjiItem, known: ReadonlySet<string>): CompoundCue | null {
  const targetKey = kanjiKey(item.character);
  if (targetKey === null) return null;
  for (const compound of item.compounds) {
    const word = compound.word.trim().normalize("NFC");
    let cue = "";
    let hasTarget = false;
    let hasOther = false;
    let usable = true;
    for (const ch of word) {
      if (IDEOGRAPH.test(ch)) {
        const key = kanjiKey(ch);
        if (key === targetKey) {
          cue += WRITING_BLANK;
          hasTarget = true;
          continue;
        }
        if (key === null || !known.has(key)) {
          usable = false;
          break;
        }
      }
      cue += ch;
      hasOther = true;
    }
    if (usable && hasTarget && hasOther) {
      return { cue, reading: compound.reading.trim(), meaning: compound.meaning.trim() };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Records: carved, last attempt, picking a page
// ---------------------------------------------------------------------------------------------

/** True once the kanji was written right on at least `CARVE_DAYS` distinct local days. */
export function isCarved(rec: WritingRecord | undefined): boolean {
  return rec !== undefined && new Set(rec.ok).size >= CARVE_DAYS;
}

const latest = (days: readonly string[]): string | undefined =>
  days.reduce<string | undefined>((a, d) => (a === undefined || d > a ? d : a), undefined);

/**
 * True when the most recent attempt was a miss. A miss on the same day as the latest right mark counts as the most
 * recent (a miss never removes an `ok`, so the miss is what happened last). No record, or no miss at all: false.
 */
export function lastAttemptMissed(rec: WritingRecord | undefined): boolean {
  if (rec === undefined) return false;
  const lastMiss = latest(rec.miss);
  if (lastMiss === undefined) return false;
  const lastOk = latest(rec.ok);
  return lastOk === undefined || lastMiss >= lastOk;
}

const attempted = (rec: WritingRecord | undefined): rec is WritingRecord =>
  rec !== undefined && hasMarks(rec);

/** Written right or missed on `today` (an attempted kanji is left out of every page for the rest of that day). */
const attemptedOn = (rec: WritingRecord | undefined, today: string): boolean =>
  rec !== undefined && (rec.ok.includes(today) || rec.miss.includes(today));

export type WritingBucket = 0 | 1 | 2 | 3;

/** One kanji chosen for a page, and why. */
export interface WritingPick {
  key: string;
  kanji: KanjiItem;
  /** `dayNumber` of the newest lesson that teaches it. */
  day: number;
  /**
   * 0 = last attempt was a miss (also for already-carved kanji); 1 = never attempted, from the newest lessons;
   * 2 = written right once, on an earlier day (the "second carve"); 3 = never attempted, older (the silent backlog).
   */
  bucket: WritingBucket;
}

/** Which bucket a kanji is in, or null when it is not eligible (carved and last written right). */
function bucketOf(rec: WritingRecord | undefined, fresh: boolean): WritingBucket | null {
  if (!attempted(rec)) return fresh ? 1 : 3;
  if (lastAttemptMissed(rec)) return 0;
  if (isCarved(rec)) return null;
  return 2;
}

/** Inside a bucket: more strokes first, then the newest source lesson, then the key (all ties broken, no randomness). */
function byDifficulty(a: WritingPick, b: WritingPick): number {
  if (a.kanji.strokes !== b.kanji.strokes) return b.kanji.strokes - a.kanji.strokes;
  if (a.day !== b.day) return b.day - a.day;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** The order a page takes from the buckets. (Taking all of bucket 1 first would starve bucket 2 and nothing would ever be carved.) */
const PAGE_ORDER: readonly WritingBucket[] = [0, 2, 1, 3];

/**
 * The kanji for one page, deterministically. The pool is every distinct kanji in the lessons; anything attempted
 * `today` is left out, and so is anything already carved whose last attempt was right. A page takes ONE kanji per
 * bucket in the order 0 → 2 → 1 → 3, skipping empty buckets, and goes round that order again until it is full (or
 * nothing is left, so a page may be shorter than `size`, or empty). Inputs are never changed.
 */
export function pickPage(
  lessons: readonly DayLesson[],
  writing: Readonly<Record<string, WritingRecord>>,
  today: string,
  size: number = WRITING_PAGE_SIZE,
): WritingPick[] {
  const limit = Number.isFinite(size) ? Math.max(0, Math.floor(size)) : WRITING_PAGE_SIZE;
  if (limit === 0) return [];
  const fresh = freshDays(lessons);
  const queues: Record<WritingBucket, WritingPick[]> = { 0: [], 1: [], 2: [], 3: [] };
  for (const entry of poolKanji(lessons)) {
    const rec = writing[entry.key];
    if (attemptedOn(rec, today)) continue;
    const bucket = bucketOf(rec, fresh.has(entry.day));
    if (bucket !== null) queues[bucket].push({ ...entry, bucket });
  }
  for (const bucket of PAGE_ORDER) queues[bucket].sort(byDifficulty);

  const page: WritingPick[] = [];
  const next: Record<WritingBucket, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let progressed = true;
  while (page.length < limit && progressed) {
    progressed = false;
    for (const bucket of PAGE_ORDER) {
      if (page.length >= limit) break;
      const pick = queues[bucket][next[bucket]];
      if (pick === undefined) continue;
      next[bucket]++;
      page.push(pick);
      progressed = true;
    }
  }
  return page;
}

/**
 * The keys of the fresh kanji (taught in the newest `WRITING_FRESH_LESSONS` lessons) that have no writing record yet:
 * what the dot on the Write pill (Phase Q2) is based on. Each new lesson pushes older kanji out of "fresh", so the dot
 * expires by lessons, never by the calendar. `today` is accepted so the call matches the other picking functions; the
 * answer does not depend on it (anything attempted today already has a record).
 */
export function freshUnwritten(
  lessons: readonly DayLesson[],
  writing: Readonly<Record<string, WritingRecord>>,
  today: string,
): string[] {
  void today;
  const fresh = freshDays(lessons);
  return poolKanji(lessons)
    .filter((entry) => fresh.has(entry.day) && !attempted(writing[entry.key]))
    .map((entry) => entry.key);
}

/**
 * How many kanji are carved, counted THROUGH the lessons: a record whose lesson was deleted is ignored, so this is
 * bounded by the curriculum. A later miss never lowers it (the `ok` days stay); it can only fall when a lesson goes.
 */
export function carvedCount(
  lessons: readonly DayLesson[],
  writing: Readonly<Record<string, WritingRecord>>,
): number {
  let count = 0;
  for (const entry of poolKanji(lessons)) if (isCarved(writing[entry.key])) count++;
  return count;
}

// ---------------------------------------------------------------------------------------------
// Saving a page
// ---------------------------------------------------------------------------------------------

/** One mark on a saved page. `photoMatch` = a photo check matched this kanji (Q5); it only counts together with `right`. */
export interface PageResult {
  key: string;
  right: boolean;
  photoMatch?: boolean;
}

const addDay = (days: readonly string[], day: string): string[] => normaliseDays([...days, day]);

const sameDays = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((d, i) => d === b[i]);

/**
 * The writing records after a saved page on `today`. For each result: right adds `today` to `ok` (keeping the last 3)
 * and removes `today` from `miss`; a miss adds `today` to `miss` and never removes an `ok`; `v` is set only when the
 * result is right AND carries a photo match, and is never cleared. Saving the same result twice changes nothing, so a
 * double tap cannot farm anything. Results with a malformed key are ignored. The input is never changed; when nothing
 * would change, the SAME object comes back.
 */
export function applyPage(
  writing: Readonly<Record<string, WritingRecord>>,
  results: readonly PageResult[],
  today: string,
): Record<string, WritingRecord> {
  if (!isValidDay(today)) return writing;
  let out: Record<string, WritingRecord> | null = null;
  for (const result of results) {
    if (!KEY_RE.test(result.key)) continue;
    const prev = (out ?? writing)[result.key];
    const ok = result.right ? addDay(prev?.ok ?? [], today) : (prev?.ok ?? []);
    const miss = result.right
      ? (prev?.miss ?? []).filter((d) => d !== today)
      : addDay(prev?.miss ?? [], today);
    const v = prev?.v === true || (result.right && result.photoMatch === true);
    if (
      prev !== undefined &&
      sameDays(prev.ok, ok) &&
      sameDays(prev.miss, miss) &&
      (prev.v === true) === v
    ) {
      continue;
    }
    out ??= { ...writing };
    out[result.key] = { ok, miss, ...(v ? { v: true as const } : {}) };
  }
  return out ?? writing;
}

// ---------------------------------------------------------------------------------------------
// The day log
// ---------------------------------------------------------------------------------------------

/**
 * Drops days older than the last `keep` days ending at `today` (so `today` and the `keep - 1` days before it stay).
 * Days after `today` are kept (a device clock that was ahead must not erase anything). Returns the SAME object when
 * nothing was dropped.
 */
export function pruneWritingLog(
  log: Readonly<Record<string, WritingDay>>,
  today: string,
  keep: number = WRITING_LOG_KEEP,
): Record<string, WritingDay> {
  const oldest = addDays(today, -(keep - 1));
  const days = Object.keys(log);
  if (days.every((day) => day >= oldest)) return log;
  const out: Record<string, WritingDay> = {};
  for (const day of days) {
    const entry = log[day];
    if (entry && day >= oldest) out[day] = entry;
  }
  return out;
}

/**
 * The log after a saved page on `day`: that day's `n` (marks saved), `ok` (marks right) and `p` (right marks that
 * carry a photo tick) grow by what the page holds, so two pages on one day add up. `p` stays out of the entry while
 * it is 0. Results with a malformed key are not counted (the same ones `applyPage` ignores). Days older than the last
 * 120 are dropped. An empty page returns the SAME object. The input is never changed.
 */
export function recordWritingDay(
  log: Readonly<Record<string, WritingDay>>,
  day: string,
  results: readonly PageResult[],
): Record<string, WritingDay> {
  if (!isValidDay(day)) return log;
  const counted = results.filter((r) => KEY_RE.test(r.key));
  if (counted.length === 0) return log;
  const prev = log[day] ?? { n: 0, ok: 0 };
  const n = prev.n + counted.length;
  const ok = prev.ok + counted.filter((r) => r.right).length;
  const p = (prev.p ?? 0) + counted.filter((r) => r.right && r.photoMatch === true).length;
  const entry: WritingDay = p > 0 ? { n, ok, p } : { n, ok };
  return pruneWritingLog({ ...log, [day]: entry }, day);
}
