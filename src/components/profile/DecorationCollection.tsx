import { useId, type ReactNode } from "react";
import { Check, Lock, RotateCcw } from "lucide-react";
import { BADGES } from "@/lib/rewards";
import { decorationUnlocked } from "@/lib/friends";
import { decorationDefinition, decorationIds, type DecorationId } from "@/lib/friend-decorations";

type CollectionSlot = "frame" | "border" | "charm" | "effect";
export function DecorationCollection<S extends CollectionSlot>({
  slot,
  label,
  hint,
  selected,
  badges,
  disabled,
  onSelect,
  thumbnail,
  onReplay,
}: {
  slot: S;
  label: string;
  hint: string;
  selected: DecorationId<S>;
  badges: Readonly<Record<string, string>>;
  disabled: boolean;
  onSelect: (id: DecorationId<S>) => void;
  thumbnail: (id: DecorationId<S>) => ReactNode;
  onReplay?: () => void;
}) {
  const groupId = useId();
  const ids = decorationIds(slot);
  const available = ids.filter((id) => decorationUnlocked(slot, id, badges));
  const locked = ids.filter((id) => !decorationUnlocked(slot, id, badges));
  available.sort((a, b) => Number(b === selected) - Number(a === selected));
  const tile = (id: DecorationId<S>, isLocked: boolean) => {
    const definition = decorationDefinition(slot, id)!;
    const task = BADGES.find((badge) => badge.id === definition.requiredBadge)?.how;
    const descriptionId = `${groupId}-${id}`;
    return (
      <div key={id} className="studio-decoration-tile">
        <button
          type="button"
          className="studio-frame-choice studio-decoration-choice"
          aria-disabled={isLocked}
          aria-pressed={id === selected}
          aria-describedby={isLocked ? descriptionId : undefined}
          onClick={() => {
            if (!isLocked) onSelect(id);
          }}
        >
          {thumbnail(id)}
          <span className="studio-choice-name">{definition.name}</span>
          <span className="studio-choice-caption">
            {isLocked ? (
              <>
                <Lock aria-hidden="true" className="size-3" />
                {id === selected ? "Saved choice · locked" : "Locked"}
              </>
            ) : id === selected ? (
              <>
                <Check aria-hidden="true" className="size-3" />
                Selected
              </>
            ) : (
              "Available"
            )}
          </span>
          {isLocked && (
            <span id={descriptionId} className="studio-choice-task">
              {task ?? "Still to discover."}
            </span>
          )}
        </button>
        {slot === "effect" && !isLocked && id === selected && id !== "none" && onReplay && (
          <button
            type="button"
            className="studio-effect-replay"
            onClick={onReplay}
            aria-label={`Replay ${definition.name}`}
          >
            <RotateCcw aria-hidden="true" className="size-3" /> Replay
          </button>
        )}
      </div>
    );
  };
  return (
    <fieldset disabled={disabled} className="studio-fieldset">
      <legend className="studio-field-label">{label}</legend>
      <p className="studio-field-hint">{hint}</p>
      {!decorationUnlocked(slot, selected, badges) && (
        <p className="mt-2 text-xs text-muted-foreground">
          Your saved choice is kept. Its plain fallback is shown until it unlocks.
        </p>
      )}
      <div className="studio-frame-grid">{available.map((id) => tile(id, false))}</div>
      {locked.length > 0 && (
        <details className="studio-unlock-list studio-decoration-discover">
          <summary>
            Still to discover <span>{locked.length}</span>
          </summary>
          <div className="studio-frame-grid">{locked.map((id) => tile(id, true))}</div>
        </details>
      )}
    </fieldset>
  );
}
