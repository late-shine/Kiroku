// Writing quests, Phase Q2 — one numbered cue card on a writing page. (Phase Q3 adds `ChoiceRow`, one row of the
// "Choose by meaning" list.)
//
// Step 1 (`revealed` = false) shows only the cue: meaning, readings and one compound with the kanji blanked. The
// CHARACTER IS NOT IN THE DOM at all until `revealed` (CSS hiding would still be read out by a screen reader), and no
// id, key or attribute here is built from it. Step 3 (`revealed` = true) shows the character, the lesson's own stroke
// count and radical (labelled "from your lesson"), the memory tip if there is one, a speak button, and the two marks.
import { Check } from "lucide-react";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { cueReadings, hideCharacter, speakReading, type WritingMark } from "@/lib/quest-prefs";
import { compoundCue, type WritingChoiceState } from "@/lib/writing";
import type { KanjiItem } from "@/types/japanese";

const markButton =
  "hit-area inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

export function PageCard({
  n,
  item,
  known,
  revealed,
  mark,
  onMark,
}: {
  /** The number the learner writes next to the answer on paper. */
  n: number;
  item: KanjiItem;
  /** `knownKanji(lessons)`: a compound is shown only if every other kanji in it has been taught. */
  known: ReadonlySet<string>;
  revealed: boolean;
  mark: WritingMark | undefined;
  onMark: (mark: WritingMark) => void;
}) {
  // Before the reveal every piece of text goes through the blank-out, so a stray copy of the character in the lesson's
  // own wording can never leak the answer.
  const safe = (text: string) => (revealed ? text : hideCharacter(text, item.character));
  const cue = compoundCue(item, known);
  const strokes = Number.isFinite(item.strokes) && item.strokes > 0 ? item.strokes : null;
  const radical = item.radical?.trim() ?? "";

  return (
    <li className="rounded-xl border border-border/60 bg-glass/50 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full border border-primary/40 font-display text-sm text-primary"
        >
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl text-foreground">
            <span className="sr-only">Number {n}: </span>
            {safe(item.meaning)}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            <Readings item={item} safe={safe} />
          </p>
          {cue && (
            <p className="mt-2 text-xs text-muted-foreground">
              Seen in:{" "}
              <span lang="ja" className="font-display text-base text-foreground">
                {cue.cue}
              </span>{" "}
              (<span lang="ja">{safe(cue.reading)}</span> · {safe(cue.meaning)})
            </p>
          )}
        </div>
      </div>

      {revealed && (
        <>
          <div className="mt-4 flex items-center gap-4 border-t border-border/50 pt-4">
            <p lang="ja" className="font-display text-6xl leading-none text-primary">
              <span className="sr-only">The kanji is </span>
              {item.character}
            </p>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {(strokes !== null || radical !== "") && (
                <p>
                  {strokes !== null && `${strokes} ${strokes === 1 ? "stroke" : "strokes"}`}
                  {strokes !== null && radical !== "" && " · "}
                  {radical !== "" && (
                    <>
                      Radical <span lang="ja">{radical}</span>
                    </>
                  )}
                  <span className="block text-[11px] opacity-80">from your lesson</span>
                </p>
              )}
              {item.memoryTip && <p className="mt-2 text-xs">{item.memoryTip}</p>}
            </div>
            <SpeakButton text={speakReading(item)} label={item.character} />
          </div>
          <div role="group" aria-label={`Mark number ${n}`} className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={mark === "right"}
              onClick={() => onMark("right")}
              className={`${markButton} ${
                mark === "right"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {mark === "right" && <Check className="size-4" aria-hidden />}
              Wrote it right
            </button>
            <button
              type="button"
              aria-pressed={mark === "miss"}
              onClick={() => onMark("miss")}
              className={`${markButton} ${
                mark === "miss"
                  ? "border-foreground/40 bg-foreground/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {mark === "miss" && <Check className="size-4" aria-hidden />}
              Not yet
            </button>
          </div>
        </>
      )}
    </li>
  );
}

/** The On | Kun readings of a kanji, each entry cleaned for display; a dash (never the character) when there are none. */
function Readings({ item, safe }: { item: KanjiItem; safe: (text: string) => string }) {
  const { on, kun } = cueReadings(item);
  if (on.length === 0 && kun.length === 0) {
    return (
      <>
        <span aria-hidden>—</span>
        <span className="sr-only">No readings saved for this kanji</span>
      </>
    );
  }
  return (
    <>
      {on.length > 0 && (
        <span>
          On <span lang="ja">{safe(on.join("、"))}</span>
        </span>
      )}
      {on.length > 0 && kun.length > 0 && <span aria-hidden> | </span>}
      {kun.length > 0 && (
        <span>
          Kun <span lang="ja">{safe(kun.join("、"))}</span>
        </span>
      )}
    </>
  );
}

const STATE_LABEL: Record<WritingChoiceState, string> = {
  new: "Not tried yet",
  once: "Written right once",
  missed: "Missed last time",
  carved: "Carved",
};

/**
 * One row of the "Choose by meaning" list (Phase Q3): a checkbox with the kanji's meaning, readings and where it
 * stands. NEVER the character, and no id, name or value built from it (a key is an encoding of the character), so
 * nothing in the markup can give the answer away before step 3. The whole row is the tap target.
 */
export function ChoiceRow({
  item,
  state,
  checked,
  disabled,
  onToggle,
}: {
  item: KanjiItem;
  state: WritingChoiceState;
  checked: boolean;
  /** True when 5 are already picked and this one is not among them. */
  disabled: boolean;
  onToggle: () => void;
}) {
  const safe = (text: string) => hideCharacter(text, item.character);
  return (
    <li>
      <label
        className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors motion-reduce:transition-none ${
          checked ? "border-primary/60 bg-primary/10" : "border-border/60 bg-glass/40"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-accent/50"}`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base text-foreground">{safe(item.meaning)}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            <Readings item={item} safe={safe} />
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground opacity-80">
            {STATE_LABEL[state]}
          </span>
        </span>
      </label>
    </li>
  );
}
