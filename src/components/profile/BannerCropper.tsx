import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  bannerCropRect,
  centeredBannerCrop,
  clampBannerCrop,
  nudgeBannerCrop,
  panBannerCrop,
  type BannerCrop,
} from "@/lib/banner-crop";
import { drawBanner, renderBanner, type BannerSource } from "@/lib/friend-banner";

/** The parent owns and releases source; preview and export share the exact rectangle calculation. */
export function BannerCropper({
  source,
  initialCrop,
  onSave,
  onCancel,
  disabled = false,
}: {
  source: BannerSource;
  initialCrop: BannerCrop;
  onSave: (value: { data: string; crop: BannerCrop }) => void;
  onCancel: () => void;
  disabled?: boolean;
}) {
  const [crop, setCrop] = useState(() => clampBannerCrop(source.width, source.height, initialCrop));
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (context) drawBanner(context, source, crop, 960, 360);
  }, [source, crop]);
  useEffect(() => {
    const element = viewport.current;
    const move = (event: TouchEvent) => {
      if (drag.current) event.preventDefault();
    };
    element?.addEventListener("touchmove", move, { passive: false });
    return () => {
      drag.current = null;
      element?.removeEventListener("touchmove", move);
    };
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || event.pointerId !== d.id) return;
    event.preventDefault();
    const dx = event.clientX - d.x,
      dy = event.clientY - d.y;
    d.x = event.clientX;
    d.y = event.clientY;
    const width = event.currentTarget.getBoundingClientRect().width;
    setCrop((value) => panBannerCrop(source.width, source.height, value, dx, dy, width));
  };
  const end = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.025;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setCrop((value) =>
      nudgeBannerCrop(source.width, source.height, value, direction[0], direction[1]),
    );
  };
  const rect = bannerCropRect(source.width, source.height, crop);
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border p-3">
      <div
        ref={viewport}
        role="group"
        tabIndex={0}
        aria-label="Banner crop viewport"
        aria-describedby="banner-crop-help"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={end}
        onKeyDown={key}
        className={`relative aspect-[8/3] w-full select-none overflow-hidden rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-ring ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <canvas
          ref={canvas}
          width={960}
          height={360}
          className="block size-full"
          aria-hidden="true"
        />
      </div>
      <p id="banner-crop-help" className="text-xs text-muted-foreground">
        Drag the image, or focus the crop and use arrow keys. Hold Shift for a larger move. The
        whole rectangle is kept.
      </p>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <span>Banner zoom</span>
        <input
          aria-label="Banner zoom"
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={crop.zoom}
          className="min-w-0 flex-1 accent-primary"
          onChange={(event) =>
            setCrop((value) =>
              clampBannerCrop(source.width, source.height, {
                ...value,
                zoom: Number(event.target.value),
              }),
            )
          }
        />
        <output className="text-xs tabular-nums">{crop.zoom.toFixed(2)}×</output>
      </label>
      <p className="sr-only" aria-live="polite">
        Crop center {Math.round(crop.cx * 100)} percent across, {Math.round(crop.cy * 100)} percent
        down. {Math.round(rect.width)} by {Math.round(rect.height)} source pixels.
      </p>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="studio-button studio-button-primary"
          disabled={disabled}
          onClick={() => {
            try {
              onSave(renderBanner(source, crop));
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Couldn't crop that banner.");
            }
          }}
        >
          Use banner
        </button>
        <button
          type="button"
          className="studio-button studio-button-quiet"
          onClick={() => {
            setCrop(clampBannerCrop(source.width, source.height, centeredBannerCrop()));
            setError(null);
          }}
        >
          Reset
        </button>
        <button type="button" className="studio-button studio-button-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
