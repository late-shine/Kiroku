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
    <div className="space-y-3">
      {lesson.vocab.length > 0 && (
        <div className="flex items-center justify-between text-xs">
          {notInReview.length > 0 ? (
            <button
              onClick={() => add(notInReview)}
              className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-medium text-primary transition-all hover:bg-primary/20"
            >
              Add this day's words to review ({notInReview.length})
            </button>
          ) : (
            <span className="text-muted-foreground/80">All words in review</span>
          )}
          <span className="font-mono text-[11px] text-muted-foreground">
            {lesson.vocab.length} words
          </span>
        </div>
      )}
      <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
        {lesson.vocab.map((word) => {
          const rec = memoryFor(memory, word);
          const mastery = masteryState(word, progress.masteredVocabIds, memory);
          return (
            <div
              key={word.id}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-glass/30 px-3.5 py-2.5 transition-all hover:border-border/70 hover:bg-glass/60"
            >
              <button
                onClick={() => speak(word.japanese)}
                className="group flex min-w-0 flex-1 flex-col items-start text-left"
              >
                <span className="font-display text-base font-medium tracking-wide text-foreground transition-colors group-hover:text-primary">
                  {word.japanese}
                </span>
                <span className="text-xs text-muted-foreground">
                  {showReading && (
                    <span className="font-mono text-primary/80 mr-1.5">{word.reading} ·</span>
                  )}
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
                  className={`transition-transform active:scale-90 ${
                    mastery !== "none"
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star
                    className={`size-4 ${
                      progress.masteredVocabIds.includes(word.id) ? "fill-current" : ""
                    }`}
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
