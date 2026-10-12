// Phase 16c: the small speaker button used next to Japanese text (kanji compounds, grammar examples, the
// Overview example and phrase). It calls the existing `speak()`, which already uses the voice saved in the
// Atmosphere tab. The icon is small; the 44 px tap target comes from the shared `hit-area` utility (Phase 16e),
// so the button takes no extra room in the row.
import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { speak } from "@/lib/voice";
import { useSpeechSupported } from "@/hooks/use-speech-supported";

export function SpeakButton({
  text,
  label,
  className,
}: {
  /** What the engine says. */
  text: string;
  /** What the button is called for a screen reader: "Listen to 努力". */
  label: string;
  className?: string;
}) {
  const supported = useSpeechSupported();
  if (!supported || text.trim() === "") return null;
  return (
    <button
      type="button"
      onClick={() => speak(text)}
      aria-label={`Listen to ${label}`}
      className={cn(
        "hit-area grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <Volume2 className="size-4" aria-hidden />
    </button>
  );
}
