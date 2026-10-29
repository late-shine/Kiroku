export interface VocabWord {
  id: string;
  japanese: string;
  reading: string;
  romaji?: string;
  meaning: string;
  category?: string;
  day: number;
  mastered?: boolean;
}

export interface KanjiCompound {
  word: string;
  reading: string;
  meaning: string;
}

export interface KanjiItem {
  character: string;
  meaning: string;
  strokes: number;
  onyomi: string[];
  kunyomi: string[];
  compounds: KanjiCompound[];
  rendakuNote?: string;
  memoryTip?: string;
  radical?: string;
}

export interface GrammarExample {
  japanese: string;
  reading: string;
  english: string;
  breakdown?: string;
}

export interface GrammarPoint {
  title: string;
  summary: string;
  structure: string;
  explanation: string;
  negativeForm?: string;
  questionForm?: string;
  notes?: string[];
  examples: GrammarExample[];
}

export interface NaturalPhrase {
  phrase: string;
  reading: string;
  meaning: string;
  context: string;
}

export interface DayLesson {
  dayNumber: number;
  title: string;
  topic: string;
  completed: boolean;
  dateCompleted?: string;
  /** Phase 17: 1–3 grammar points per day (was a single object before). Always an array in memory; see `normalizeLessonShape`. */
  grammar: GrammarPoint[];
  /** Phase 17: 1–5 kanji per day (was a single object before). */
  kanji: KanjiItem[];
  vocab: VocabWord[];
  naturalPhrase: NaturalPhrase;
  pattern: string;
  cultureCorner?: string;
}

export interface QuizQuestion {
  id: string;
  type:
    | "vocab-meaning"
    | "vocab-reading"
    | "kanji-meaning"
    | "kanji-reading"
    | "grammar"
    | "natural-reaction";
  prompt: string;
  subPrompt?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  day: number;
  itemText: string;
  audioText?: string;
}

/**
 * Phase 14b — what Kiroku remembers about one word (Leitner box). Keyed by vocab id in
 * `UserProgressState.vocabMemory`. `japanese` is the word's text when the record was written: if an AI
 * re-emits a day with the same ids but different words, the old record no longer matches and is ignored.
 * `due` is a LOCAL calendar day, "YYYY-MM-DD"; `lastAnswered` is an ISO timestamp.
 */
export interface WordMemory {
  japanese: string;
  box: number; // 1..5
  due: string;
  right: number;
  wrong: number;
  lastAnswered: string;
  /**
   * Reinforcement Phase 2 — the miss streak: on how many LOCAL days in a row the word's first real answer of
   * the day was a miss. OPTIONAL and omitted while 0 (never stored as `undefined` or 0), so a record with no
   * `streak` — every record written before Phase 2, every old backup — means 0. Not to be confused with
   * `streak()` in `study-log.ts`, which counts consecutive STUDY days. See `applyAnswer` in `word-memory.ts`.
   */
  streak?: number;
}

/** Phase 18a: what was answered on one local calendar day (`correct` never exceeds `answered`). */
export interface StudyDay {
  answered: number;
  correct: number;
}

/**
 * Writing quests, Phase Q1 — what Kiroku remembers about writing ONE kanji from memory on paper. Keyed by
 * `kanjiKey` ("u" + lowercase hex code point, 力 -> "u529b") in `UserProgressState.writing`. The learner's own
 * mark is the record. Days are LOCAL calendar days, "YYYY-MM-DD", the same ones `word-memory.ts` uses.
 */
export interface WritingRecord {
  /** The last <=3 distinct local days this kanji was written right, ascending. */
  ok: string[];
  /** The last <=3 distinct local days it was missed, ascending. */
  miss: string[];
  /** A photo check once matched this kanji AND the final mark was right. Present only when true, never `undefined`. */
  v?: true;
}

/** Writing quests, Phase Q1: one local day of saved marks. `p` (marks that carry a green tick) is omitted when 0. */
export interface WritingDay {
  /** Marks saved that day (right or not yet). */
  n: number;
  /** Marks that were "Wrote it right". Never more than `n`. */
  ok: number;
  /** Right marks that carry a photo-check tick. Never more than `ok`. */
  p?: number;
}

export interface UserProgressState {
  completedDays: number[];
  currentDay: number;
  masteredVocabIds: string[];
  weakVocabIds: string[];
  /** Phase 14b: per-word review records, keyed by vocab id. Empty for new users and old backups. */
  vocabMemory: Record<string, WordMemory>;
  totalQuizzesTaken: number;
  totalCorrectAnswers: number;
  /**
   * Phase 18a: quiz activity per LOCAL calendar day, keyed "YYYY-MM-DD", at most the last 120 days. The data
   * under the 7-day graph (18b). Empty for new users and for backups made before 18a.
   */
  studyLog: Record<string, StudyDay>;
  /**
   * Writing quests, Phase Q1: per-kanji writing records, keyed by `kanjiKey` (see `WritingRecord`). Empty for new
   * users and for backups made before v6. Counts always read through the lessons, so a record whose lesson was
   * deleted is simply ignored.
   */
  writing: Record<string, WritingRecord>;
  /** Writing quests, Phase Q1: marks saved per LOCAL day, keyed "YYYY-MM-DD", at most the last 120 days. */
  writingLog: Record<string, WritingDay>;
  /** Writing quests, Phase Q1: badge id -> the local day it was first earned. Nothing grants badges until Q6. */
  badges: Record<string, string>;
  lastQuizScore?: { correct: number; total: number; date: string };
  backgroundIndex: number;
  bgZoomSpeed: "slow" | "medium" | "still";
  showFurigana: boolean;
}
