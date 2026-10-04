// The Lessons → Vocab list. Moved out of routes/index.tsx in Phase 14b-fix so it can be tested on its own.
// Each word has two small controls: the star ("I already know this") and "Add to review" (puts the word in
// the Due today list). Adding never touches the star, and the star never adds. Theme tokens only.
import type { Dispatch, SetStateAction } from "react";
import { BookmarkCheck, BookmarkPlus, Star } from "lucide-react";
import { speak } from "@/lib/voice";
import { addToReview, masteryState, memoryFor } from "@/lib/word-memory";
import type { DayLesson, UserProgressState, VocabWord } from "@/types/japanese";

export function Vocab({
  lesson,
  progress,
  setProgress,
  showReading,
}: {
  lesson: DayLesson;
  progress: UserProgressState;
  setProgress: Dispatch<SetStateAction<UserProgressState>>;
  showReading: boolean;
}) {
  const memory = progress.vocabMemory;
  const notInReview = lesson.vocab.filter((w) => !memoryFor(memory, w));

  const add = (words: VocabWord[]) => {
    const now = new Date(); // read once, outside the updater, so the updater stays pure
    setProgress((p) => {
      const next = addToReview(p.vocabMemory, words, now);
      return next === p.vocabMemory ? p : { ...p, vocabMemory: next };
    });
  };

  return (
    <div>
      {lesson.vocab.length > 0 && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          {notInReview.length > 0 ? (
            <button
              onClick={() => add(notInReview)}
              className="rounded-md border border-border bg-glass px-3 py-1.5 font-semibold transition-colors hover:bg-accent"
            >
              Add this day's words to review ({notInReview.length})
            </button>
          ) : (
            <span className="text-muted-foreground">All of this day's words are in review.</span>
          )}
        </div>
      )}
      <div className="max-h-[360px] space-y-1 overflow-y-auto">
        {lesson.vocab.map((word) => {
          const rec = memoryFor(memory, word);
          const mastery = masteryState(word, progress.masteredVocabIds, memory);
          return (
            <div
              key={word.id}
              className="flex items-center justify-between border-b border-border py-2"
            >
              <button onClick={() => speak(word.japanese)} className="text-left">
                <span className="font-display text-base">{word.japanese}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {showReading ? `${word.reading} · ` : ""}
                  {word.meaning}
                </span>
              </button>
              <div className="flex items-center gap-3">
                {rec ? (
                  <span
                    aria-label="In review"
                    title={`In review · next: ${rec.due}`}
                    className="text-primary"
                  >
                    <BookmarkCheck className="size-4" />
                  </span>
                ) : (
                  <button
                    aria-label="Add to review"
                    title="Add to review"
                    onClick={() => add([word])}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    <BookmarkPlus className="size-4" />
                  </button>
                )}
                <button
                  aria-label="Toggle mastery"
                  onClick={() =>
                    setProgress((p) => ({
                      ...p,
                      masteredVocabIds: p.masteredVocabIds.includes(word.id)
                        ? p.masteredVocabIds.filter((id) => id !== word.id)
                        : [...p.masteredVocabIds, word.id],
                    }))
                  }
                  title={mastery === "earned" ? "Mastered through review" : undefined}
                  className={mastery !== "none" ? "text-primary" : "text-muted-foreground"}
                >
                  <Star
                    className={`size-4 ${progress.masteredVocabIds.includes(word.id) ? "fill-current" : ""}`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
