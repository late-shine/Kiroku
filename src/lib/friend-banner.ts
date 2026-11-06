import { loadAvatarSource, type AvatarSource } from "./avatar-image";
import { bannerCropRect, clampBannerCrop, type BannerCrop } from "./banner-crop";
import { STORAGE_KEYS } from "./storage";

export const MAX_BANNER_SOURCE = 160000;
export const MAX_BANNER_DATA = 96000;
export const MAX_BANNER_UPLOAD = 20 * 1024 * 1024;
export type BannerScope = { uid: string | null; generation: number };
export type BannerDraft = {
  v: 1;
  uid: string | null;
  source: string;
  data: string;
  crop: BannerCrop;
  selected: boolean;
  id?: string;
};
export type BannerAsset = { id: string; source: string; data: string; crop: BannerCrop };
export type PublicBanner = { id: string; data: string };
export type BannerEdit = { kind: "upload"; draft: BannerDraft } | { kind: "remove" };
export const isBannerId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
export function decodeBannerAsset(value: unknown): BannerAsset | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BannerImageError("Couldn't read the saved banner. Replace or remove it in Style.");
  const row = value as Record<string, unknown>;
  const draft = decodeBannerDraft({ ...row, v: 1, uid: null, selected: false }, null);
  if (
    !isBannerId(row["id"]) ||
    !draft ||
    Object.keys(row).some((key) => !["id", "source", "data", "crop"].includes(key)) ||
    Object.keys(row["crop"] as object).some((key) => !["cx", "cy", "zoom"].includes(key))
  )
    throw new BannerImageError("Couldn't read the saved banner. Replace or remove it in Style.");
  return { id: row["id"], source: draft.source, data: draft.data, crop: draft.crop };
}
export function decodePublicBanner(value: unknown): PublicBanner | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  return isBannerId(row["id"]) &&
    isBannerData(row["data"]) &&
    Object.keys(row).every((key) => key === "id" || key === "data")
    ? { id: row["id"], data: row["data"] }
    : null;
}
export function sameBannerImage(
  a: Pick<BannerAsset, "source" | "data" | "crop">,
  b: Pick<BannerAsset, "source" | "data" | "crop">,
): boolean {
  return (
    a.source === b.source &&
    a.data === b.data &&
    a.crop.cx === b.crop.cx &&
    a.crop.cy === b.crop.cy &&
    a.crop.zoom === b.crop.zoom
  );
}
export type BannerSource = AvatarSource;
export class BannerImageError extends Error {}
export function isBannerData(value: unknown, limit = MAX_BANNER_DATA): value is string {
  return (
    typeof value === "string" &&
    value.length <= limit &&
    /^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}
export function decodeBannerDraft(value: unknown, uid: string | null): BannerDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const c = row["crop"];
  if (
    row["v"] !== 1 ||
    row["uid"] !== uid ||
    !isBannerData(row["source"], MAX_BANNER_SOURCE) ||
    !isBannerData(row["data"]) ||
    typeof row["selected"] !== "boolean" ||
    !c ||
    typeof c !== "object" ||
    Array.isArray(c)
  )
    return null;
  const crop = c as Record<string, unknown>;
  const cx = crop["cx"],
    cy = crop["cy"],
    zoom = crop["zoom"];
  if (
    typeof cx !== "number" ||
    !Number.isFinite(cx) ||
    cx < 0 ||
    cx > 1 ||
    typeof cy !== "number" ||
    !Number.isFinite(cy) ||
    cy < 0 ||
    cy > 1 ||
    typeof zoom !== "number" ||
    !Number.isFinite(zoom) ||
    zoom < 1 ||
    zoom > 3
  )
    return null;
  return {
    v: 1,
    uid,
    source: row["source"],
    data: row["data"],
    crop: { cx, cy, zoom },
    selected: row["selected"],
    ...(isBannerId(row["id"]) ? { id: row["id"] } : {}),
  };
}
export function readBannerDraft(uid: string | null): BannerDraft | null {
  try {
    return decodeBannerDraft(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.friendBannerDraft) ?? "null") as unknown,
      uid,
    );
  } catch {
    return null;
  }
}
export function writeBannerDraft(value: BannerDraft | null): void {
  // setItem is atomic: on quota failure the previous envelope is left intact.
  if (value) localStorage.setItem(STORAGE_KEYS.friendBannerDraft, JSON.stringify(value));
  else localStorage.removeItem(STORAGE_KEYS.friendBannerDraft);
}
function neutral(context: CanvasRenderingContext2D) {
  context.fillStyle = "#161616"; // existing avatar's neutral fallback, not a new UI colour
  const token = getComputedStyle(document.documentElement).getPropertyValue("--secondary").trim();
  if (token) context.fillStyle = token;
}
function encode(canvas: HTMLCanvasElement, quality: number): string {
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp;") ? webp : canvas.toDataURL("image/jpeg", quality);
}
/** Decode only an already re-encoded source; it carries no original orientation/EXIF metadata. */
export async function loadRetainedBanner(data: string): Promise<BannerSource> {
  if (!isBannerData(data, MAX_BANNER_SOURCE))
    throw new BannerImageError("This banner source could not be read. Choose the image again.");
  const img = new Image();
  img.decoding = "async";
  img.src = data;
  try {
    await img.decode();
  } catch {
    img.removeAttribute("src");
    throw new BannerImageError("Couldn't read that banner. Choose the image again.");
  }
  if (
    img.naturalWidth < 1 ||
    img.naturalHeight < 1 ||
    Math.max(img.naturalWidth, img.naturalHeight) > 1600
  ) {
    img.removeAttribute("src");
    throw new BannerImageError("This banner source is not supported. Choose the image again.");
  }
  return {
    source: img,
    width: img.naturalWidth,
    height: img.naturalHeight,
    close: () => {
      img.removeAttribute("src");
    },
  };
}
/** Original orientation is decoded once by the existing image loader, then discarded by canvas. */
export async function prepareBannerFile(
  file: File,
): Promise<{ source: string; decoded: BannerSource }> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new BannerImageError("Choose a JPEG, PNG or WebP banner.");
  if (file.size > MAX_BANNER_UPLOAD)
    throw new BannerImageError("That banner is over 20 MB. Choose a smaller image.");
  let original: AvatarSource;
  try {
    original = await loadAvatarSource(file);
  } catch {
    throw new BannerImageError("Couldn't read that image. Choose a different banner.");
  }
  let data: string | null = null;
  try {
    for (const longest of [1600, 1280, 960, 720, 480]) {
      const scale = Math.min(1, longest / Math.max(original.width, original.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(original.width * scale));
      canvas.height = Math.max(1, Math.round(original.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new BannerImageError("Couldn't prepare the banner in this browser.");
      neutral(ctx);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(original.source, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.86, 0.72, 0.55, 0.4]) {
        const candidate = encode(canvas, quality);
        if (isBannerData(candidate, MAX_BANNER_SOURCE)) {
          data = candidate;
          break;
        }
      }
      canvas.width = canvas.height = 0;
      if (data) break;
    }
  } finally {
    original.close();
  }
  if (!data)
    throw new BannerImageError("Couldn't make that banner small enough. Choose a simpler image.");
  return { source: data, decoded: await loadRetainedBanner(data) };
}
export function drawBanner(
  context: CanvasRenderingContext2D,
  source: BannerSource,
  crop: BannerCrop,
  width: number,
  height: number,
) {
  const rect = bannerCropRect(source.width, source.height, crop);
  neutral(context);
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source.source, rect.sx, rect.sy, rect.width, rect.height, 0, 0, width, height);
}
export function renderBanner(
  source: BannerSource,
  crop: BannerCrop,
): { data: string; crop: BannerCrop } {
  const view = clampBannerCrop(source.width, source.height, crop);
  for (const [width, height] of [
    [960, 360],
    [720, 270],
    [480, 180],
  ] as const) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new BannerImageError("Couldn't crop the banner in this browser.");
    drawBanner(ctx, source, view, width, height);
    for (const quality of [0.88, 0.72, 0.55, 0.4, 0.3]) {
      const data = encode(canvas, quality);
      if (isBannerData(data)) {
        canvas.width = canvas.height = 0;
        return { data, crop: view };
      }
    }
    canvas.width = canvas.height = 0;
  }
  throw new BannerImageError("Couldn't fit that banner. Try a different crop or a simpler image.");
}
