/**
 * Phase 19a-2 — turns a picture the person chose into the tiny square stored as `prefs.photo`: decoded in the browser
 * (EXIF rotation respected), cropped to a centred square, scaled to `AVATAR_PIXELS`, and re-encoded as WebP (JPEG where
 * the browser cannot write WebP), trying smaller sizes and lower quality until it fits `MAX_PHOTO_LENGTH`.
 * The picture never leaves the device except inside the person's own synced prefs; nothing is uploaded to a file store.
 *
 * `squareCrop` and `shrinkToLimit` are pure (checked by handoffs/phase-19a-profile-check.ts). `fileToAvatarDataUrl` needs
 * a real browser (canvas, createImageBitmap), so it is the one part no script check can run.
 */
import { AVATAR_PIXELS, isAvatarDataUrl } from "@/lib/profile";

/** A larger file than this is refused before it is decoded (a phone photo is a few MB). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Thrown with a message that is safe to show the person as it is. */
export class AvatarImageError extends Error {}

/** The centred square of a `width` × `height` picture: top-left corner and side, in whole pixels. */
export function squareCrop(
  width: number,
  height: number,
): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.floor(Math.min(width, height)));
  return {
    sx: Math.max(0, Math.floor((width - side) / 2)),
    sy: Math.max(0, Math.floor((height - side) / 2)),
    side,
  };
}

/** Sizes and qualities to try, best first. The first result that is a valid, small-enough picture wins. */
export const SHRINK_STEPS: readonly (readonly [pixels: number, quality: number])[] = [
  [AVATAR_PIXELS, 0.82],
  [AVATAR_PIXELS, 0.65],
  [96, 0.65],
  [64, 0.6],
];

/**
 * Calls `encode(pixels, quality)` along `SHRINK_STEPS` until it returns something `isAvatarDataUrl` accepts
 * (right type, within the size cap). Returns `null` when even the smallest step is too big or the wrong type.
 */
export function shrinkToLimit(encode: (pixels: number, quality: number) => string): string | null {
  for (const [pixels, quality] of SHRINK_STEPS) {
    const url = encode(pixels, quality);
    if (isAvatarDataUrl(url)) return url;
  }
  return null;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      /* an older browser that does not take the option, or cannot read this file: try an <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads a picture file and returns the small `data:` address to store. Throws `AvatarImageError` with a plain message. */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new AvatarImageError("Choose a JPEG, PNG or WebP picture.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AvatarImageError("That picture is too large (over 20 MB). Choose a smaller one.");
  }
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new AvatarImageError("Couldn't read that picture. Try a different one.");
  }
  try {
    if (decoded.width < 1 || decoded.height < 1) {
      throw new AvatarImageError("Couldn't read that picture. Try a different one.");
    }
    const { sx, sy, side } = squareCrop(decoded.width, decoded.height);
    const result = shrinkToLimit((pixels, quality) => {
      const canvas = document.createElement("canvas");
      canvas.width = pixels;
      canvas.height = pixels;
      const context = canvas.getContext("2d");
      if (!context) return "";
      context.fillStyle = "#161616"; // a see-through PNG becomes this colour, not black-on-nothing
      context.fillRect(0, 0, pixels, pixels);
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, sx, sy, side, side, 0, 0, pixels, pixels);
      const webp = canvas.toDataURL("image/webp", quality);
      return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
    });
    if (!result)
      throw new AvatarImageError("Couldn't make that picture small enough. Try a different one.");
    return result;
  } finally {
    decoded.close();
  }
}
