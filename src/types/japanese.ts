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
  grammar: GrammarPoint;
  kanji: KanjiItem;
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
  lastQuizScore?: { correct: number; total: number; date: string };
  backgroundIndex: number;
  bgZoomSpeed: "slow" | "medium" | "still";
  showFurigana: boolean;
}
