/**
 * Phase 22 — the pure maths behind the profile-picture crop panel. A crop is a square window on the decoded picture:
 * `zoom` 1 shows the whole short side (the old centred crop), larger values zoom in, and `cx` / `cy` are the window's
 * centre in picture pixels. Every function here returns a view that keeps the window INSIDE the picture, so the
 * circle can never show empty space. No imports and no DOM, so it is checked by handoffs/phase-22-crop-check.ts.
 */

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** The square window: zoom level and its centre, in picture pixels. */
export interface CropView {
  zoom: number;
  cx: number;
  cy: number;
}

/** The same window as whole pixels, ready for `drawImage(source, sx, sy, side, side, ...)`. */
export interface CropRect {
  sx: number;
  sy: number;
  side: number;
}

function clamp(value: number, low: number, high: number): number {
  if (low > high) return (low + high) / 2;
  return Math.min(high, Math.max(low, value));
}

/** The window's side in picture pixels (a fraction is fine here; `cropRect` rounds it down). */
function sideOf(width: number, height: number, zoom: number): number {
  return Math.max(1, Math.min(width, height) / zoom);
}

/** Whole picture short side showing, centred: what the old automatic crop did. */
export function centredView(width: number, height: number): CropView {
  return { zoom: MIN_ZOOM, cx: width / 2, cy: height / 2 };
}

/** Pulls any view back to a valid one: zoom within range (NaN becomes 1) and the window inside the picture. */
export function clampView(width: number, height: number, view: CropView): CropView {
  const zoom = Number.isFinite(view.zoom) ? clamp(view.zoom, MIN_ZOOM, MAX_ZOOM) : MIN_ZOOM;
  const half = sideOf(width, height, zoom) / 2;
  const cx = clamp(Number.isFinite(view.cx) ? view.cx : width / 2, half, width - half);
  const cy = clamp(Number.isFinite(view.cy) ? view.cy : height / 2, half, height - half);
  return { zoom, cx, cy };
}

/** The window as whole pixels, always inside the picture. At zoom 1, centred, it equals `squareCrop`. */
export function cropRect(width: number, height: number, view: CropView): CropRect {
  const v = clampView(width, height, view);
  const exact = sideOf(width, height, v.zoom);
  const side = Math.max(1, Math.floor(exact));
  return {
    sx: clamp(Math.floor(v.cx - exact / 2), 0, Math.max(0, width - side)),
    sy: clamp(Math.floor(v.cy - exact / 2), 0, Math.max(0, height - side)),
    side,
  };
}

/**
 * Dragging the picture by `dx` / `dy` screen pixels inside a preview `previewSize` pixels wide: the picture follows
 * the finger, so the window moves the opposite way. One preview pixel is `side / previewSize` picture pixels.
 */
export function panView(
  width: number,
  height: number,
  view: CropView,
  dx: number,
  dy: number,
  previewSize: number,
): CropView {
  const v = clampView(width, height, view);
  if (!(previewSize > 0)) return v;
  const perPixel = sideOf(width, height, v.zoom) / previewSize;
  return clampView(width, height, { zoom: v.zoom, cx: v.cx - dx * perPixel, cy: v.cy - dy * perPixel });
}

/** Moves the window by a fraction of its own side (arrow keys). Positive `fx` moves it right, `fy` down. */
export function nudgeView(
  width: number,
  height: number,
  view: CropView,
  fx: number,
  fy: number,
): CropView {
  const v = clampView(width, height, view);
  const side = sideOf(width, height, v.zoom);
  return clampView(width, height, { zoom: v.zoom, cx: v.cx + fx * side, cy: v.cy + fy * side });
}

/** Changes the zoom around the current centre; the window is pulled back inside if the new size needs it. */
export function zoomView(width: number, height: number, view: CropView, zoom: number): CropView {
  return clampView(width, height, { ...view, zoom });
}
