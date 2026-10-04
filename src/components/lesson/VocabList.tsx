// Phase 14b-fix — the Lessons "Vocab" tab (moved out of routes/index.tsx so the shell doesn't grow).
// Same word list and the same star as before, plus the two ways a word joins review:
//   - a small "+" on each word that isn't in review yet, and
//   - one "Add this day's words to review (N)" button.
// Adding is the only way in besides answering a word in a quiz. The star keeps its own meaning ("I already
// know this") and is deliberately a separate control. Theme tokens only.
import type { Dispatch, SetStateAction } from "react";
import { Check, Plus, Star } from "lucide-react";
import { speak } from "@/lib/voice";
import { addToReview, masteryState, memoryFor, notInReview } from "@/lib/word-memory";
import type { DayLesson, UserProgressState } from "@/types/japanese";

export function VocabList({
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
  const { vocabMemory, masteredVocabIds } = progress;
  const toAdd = notInReview(lesson.vocab, vocabMemory).length;
  const addWords = (words: DayLesson["vocab"]) =>
    setProgress((p) => ({ ...p, vocabMemory: addToReview(p.vocabMemory, words) }));
  const toggleStar = (id: string) =>
    setProgress((p) => ({
      ...p,
      masteredVocabIds: p.masteredVocabIds.includes(id)
        ? p.masteredVocabIds.filter((x) => x !== id)
        : [...p.masteredVocabIds, id],
    }));

  return (
    <div>
      {lesson.vocab.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
          {toAdd > 0 ? (
            <button
              onClick={() => addWords(lesson.vocab)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-primary hover:bg-accent"
            >
              Add this day's words to review ({toAdd})
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              All of this day's words are in review.
            </span>
          )}
        </div>
      )}
      <div className="max-h-[360px] space-y-1 overflow-y-auto">
        {lesson.vocab.map((word) => {
          const rec = memoryFor(vocabMemory, word);
          const mastery = masteryState(word, masteredVocabIds, vocabMemory);
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
              <div className="flex shrink-0 items-center gap-1">
                {rec ? (
                  <span
                    role="img"
                    aria-label="In review"
                    title={`In review · box ${rec.box}, due ${rec.due}`}
                    className="p-1 text-muted-foreground"
                  >
                    <Check className="size-4" />
                  </span>
                ) : (
                  <button
                    onClick={() => addWords([word])}
                    aria-label={`Add ${word.japanese} to review`}
                    title="Add to review"
                    className="rounded p-1 text-muted-foreground hover:text-primary"
                  >
                    <Plus className="size-4" />
                  </button>
                )}
                <button
                  aria-label="Toggle mastery"
                  onClick={() => toggleStar(word.id)}
                  title={mastery === "earned" ? "Mastered through review" : undefined}
                  className={mastery !== "none" ? "text-primary" : "text-muted-foreground"}
                >
                  <Star
                    className={`size-4 ${masteredVocabIds.includes(word.id) ? "fill-current" : ""}`}
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
