import { loadAvatarSource, type AvatarSource } from "@/lib/avatar-image";
import { VISION_MAX_BASE64_CHARS } from "@/lib/gemini-vision";

export const VISION_SHRINK_STEPS: readonly (readonly [pixels: number, quality: number])[] = [
  [1600, 0.8],
  [1600, 0.65],
  [1280, 0.65],
  [1024, 0.6],
];

const JPEG_PREFIX = "data:image/jpeg;base64,";

export class QuestImageError extends Error {}

export function scaleDimensions(
  width: number,
  height: number,
  longEdge: number,
): { width: number; height: number } {
  const current = Math.max(width, height);
  if (current <= longEdge) return { width, height };
  const scale = longEdge / current;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function shrinkVisionToLimit(
  encode: (pixels: number, quality: number) => string,
): string | null {
  for (const [pixels, quality] of VISION_SHRINK_STEPS) {
    const url = encode(pixels, quality);
    if (!url.startsWith(JPEG_PREFIX)) continue;
    const base64 = url.slice(JPEG_PREFIX.length);
    if (base64.length > 0 && base64.length <= VISION_MAX_BASE64_CHARS) return base64;
  }
  return null;
}

function encodeCanvas(
  decoded: AvatarSource,
  pixels: number,
  quality: number,
  fillTransparency: boolean,
): string {
  const dimensions = scaleDimensions(decoded.width, decoded.height, pixels);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d");
  if (context === null) return "";
  if (fillTransparency) {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, dimensions.width, dimensions.height);
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(decoded.source, 0, 0, dimensions.width, dimensions.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function prepareVisionImage(
  file: File,
): Promise<{ mime: "image/jpeg"; base64: string }> {
  const decoded = await loadAvatarSource(file);
  try {
    const base64 = shrinkVisionToLimit((pixels, quality) =>
      encodeCanvas(decoded, pixels, quality, file.type !== "image/jpeg"),
    );
    if (base64 === null) {
      throw new QuestImageError(
        "That photo is too detailed to shrink. Try a closer, plainer shot.",
      );
    }
    return { mime: "image/jpeg", base64 };
  } catch (error) {
    if (error instanceof QuestImageError) throw error;
    throw new QuestImageError("Couldn't prepare that photo. Try a different one.");
  } finally {
    decoded.close();
  }
}
