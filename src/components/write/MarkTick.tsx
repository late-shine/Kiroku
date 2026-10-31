import { Check } from "lucide-react";

export function MarkTick({ checked }: { checked: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      {checked ? (
        <span className="grid size-5 place-items-center rounded-full bg-success/15 text-success">
          <Check className="size-3.5" aria-hidden />
        </span>
      ) : (
        <Check className="size-4 text-muted-foreground opacity-60" aria-hidden />
      )}
      <span className={checked ? "text-success" : "text-muted-foreground"}>
        {checked ? "Checked by photo" : "Marked by you"}
      </span>
    </span>
  );
}
