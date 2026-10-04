// Phase 14d — the answer box for a "type the reading" question. Only state + markup; the checking rules are
// pure and live in ./typed-answer.ts. Theme tokens only.
//
// Japanese-keyboard safety: Enter must NOT submit while the player is still converting kana (that Enter only
// confirms the conversion), so the key handler goes through `isSubmitKey`, which looks at `isComposing` and at
// Safari's keyCode 229.
import { useEffect, useRef, useState } from "react";
import type { VocabWord } from "@/types/japanese";
import { DONT_KNOW } from "./round";
import { isReadingCorrect, isSubmitKey, normalizeReading } from "./typed-answer";

export function TypedAnswer({
  word,
  answer,
  onSubmit,
  onNext,
}: {
  word: VocabWord;
  /** `undefined` until the question is answered; `DONT_KNOW` if the player gave up; otherwise what was typed. */
  answer: string | undefined;
  onSubmit: (value: string) => void;
  /** Enter, once the question has been answered, goes to the next question (same as the Next button). */
  onNext: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const locked = answer !== undefined;
  const right = answer !== undefined && isReadingCorrect(word.reading, answer);
  // Only punctuation or spaces is "nothing typed": it cannot be checked, "I don't know" is the way out.
  const canCheck = normalizeReading(value) !== "";

  // The parent gives each question its own copy of this box (a `key`), so this runs once per question.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const check = () => {
    if (!locked && canCheck) onSubmit(value.trim());
  };

  const tone = !locked
    ? "border-border bg-glass focus:border-primary"
    : right
      ? "border-success bg-success/15"
      : "border-destructive bg-destructive/15";

  return (
    <div className="mx-auto mt-8 max-w-md">
      <input
        ref={inputRef}
        type="text"
        lang="ja"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (!isSubmitKey(e.nativeEvent)) return;
          e.preventDefault();
          if (locked) onNext();
          else check();
        }}
        readOnly={locked}
        aria-label="Type the reading in kana"
        aria-invalid={locked && !right}
        placeholder="ひらがなで入力"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        className={`w-full rounded-md border px-4 py-3 text-center font-display text-2xl outline-none transition-colors placeholder:text-base placeholder:text-muted-foreground ${tone}`}
      />

      {!locked ? (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={check}
            disabled={!canCheck}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Check
          </button>
          <button
            onClick={() => onSubmit(DONT_KNOW)}
            className="rounded-md border border-border bg-glass px-4 py-2 text-sm hover:bg-accent"
          >
            I don't know
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-1 text-center text-sm">
          {!right &&
            (answer === DONT_KNOW ? (
              <p className="text-muted-foreground">You skipped this one.</p>
            ) : (
              <p>
                <span className="text-muted-foreground">You typed </span>
                <span lang="ja" className="font-display text-lg text-destructive">
                  {answer}
                </span>
              </p>
            ))}
          <p>
            <span className="text-muted-foreground">Reading </span>
            <span lang="ja" className="font-display text-lg text-success">
              {word.reading}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
