/**
 * Phase 22 — the crop panel shown in the Profile "You" card after a picture is chosen. The person drags the picture
 * (mouse, finger or arrow keys) and moves a zoom slider until the part they want sits inside the circle, then saves.
 * The preview is drawn by the SAME function and crop rectangle that make the saved picture (`drawAvatarSquare` +
 * `cropRect`), so what the circle shows is what gets stored. All the maths is in `src/lib/avatar-crop.ts`.
 * The caller owns the decoded `source` and closes it; this component only draws from it.
 */
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  centredView,
  cropRect,
  nudgeView,
  panView,
  zoomView,
  type CropView,
} from "@/lib/avatar-crop";
import {
  AvatarImageError,
  drawAvatarSquare,
  renderAvatar,
  type AvatarSource,
} from "@/lib/avatar-image";

/** Canvas pixels for the 240 px panel (twice, so it stays sharp on dense screens). */
const PREVIEW_PIXELS = 480;
/** One arrow-key press moves the picture by this fraction of the window. */
const KEY_STEP = 0.05;

export function AvatarCropper({
  source,
  onSave,
  onCancel,
}: {
  source: AvatarSource;
  /** Receives the small `data:` address to store. */
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const { width, height } = source;
  const [view, setView] = useState<CropView>(() => centredView(width, height));
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawAvatarSquare(context, source, cropRect(width, height, view), PREVIEW_PIXELS);
  }, [source, width, height, view]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    current.x = event.clientX;
    current.y = event.clientY;
    const size = event.currentTarget.getBoundingClientRect().width;
    setView((v) => panView(width, height, v, dx, dy, size));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  // Arrow keys move the picture the way the arrow points, like dragging does (so the window moves the other way).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let fx = 0;
    let fy = 0;
    if (event.key === "ArrowLeft") fx = KEY_STEP;
    else if (event.key === "ArrowRight") fx = -KEY_STEP;
    else if (event.key === "ArrowUp") fy = KEY_STEP;
    else if (event.key === "ArrowDown") fy = -KEY_STEP;
    else return;
    event.preventDefault();
    setView((v) => nudgeView(width, height, v, fx, fy));
  };

  const save = () => {
    setError(null);
    try {
      onSave(renderAvatar(source, cropRect(width, height, view)));
    } catch (caught) {
      setError(
        caught instanceof AvatarImageError
          ? caught.message
          : "Couldn't use that picture. Try a different one.",
      );
    }
  };

  return (
    <div className="mt-3">
      <div
        role="group"
        tabIndex={0}
        aria-label="Picture position. Drag the picture, or use the arrow keys, to place it inside the circle."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="relative mx-auto aspect-square w-60 max-w-full cursor-grab touch-none overflow-hidden rounded-xl border border-border/60 outline-none select-none focus-visible:ring-2 focus-visible:ring-primary/60 active:cursor-grabbing"
      >
        <canvas
          ref={canvasRef}
          width={PREVIEW_PIXELS}
          height={PREVIEW_PIXELS}
          className="block size-full"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full border border-primary/60"
          style={{ boxShadow: "0 0 0 999px color-mix(in oklab, var(--scrim) 62%, transparent)" }}
        />
      </div>

      <label className="mx-auto mt-3 flex w-60 max-w-full items-center gap-3 text-xs text-muted-foreground">
        Zoom
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(e) => setView((v) => zoomView(width, height, v, Number(e.target.value)))}
          className="min-w-0 flex-1 accent-primary"
        />
      </label>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Drag the picture to move it. Only the part inside the circle is kept.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-center text-[11px] text-destructive">
          {error}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={save}
          className="hit-area rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Use this picture
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="hit-area rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
