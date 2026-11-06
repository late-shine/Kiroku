/** Rectangular banner geometry, independent of the avatar's square crop. */
export const BANNER_ASPECT = 8 / 3;
export type BannerCrop = { cx: number; cy: number; zoom: number };
export type BannerRect = { sx: number; sy: number; width: number; height: number };
export const centeredBannerCrop = (): BannerCrop => ({ cx: 0.5, cy: 0.5, zoom: 1 });
const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));
export function clampBannerCrop(width: number, height: number, crop: BannerCrop): BannerCrop {
  const zoom = clamp(Number.isFinite(crop.zoom) ? crop.zoom : 1, 1, 3);
  const halfWidth = Math.min(width, height * BANNER_ASPECT) / zoom / 2;
  const halfHeight = halfWidth / BANNER_ASPECT;
  return {
    zoom,
    cx: clamp(Number.isFinite(crop.cx) ? crop.cx : 0.5, halfWidth / width, 1 - halfWidth / width),
    cy: clamp(
      Number.isFinite(crop.cy) ? crop.cy : 0.5,
      halfHeight / height,
      1 - halfHeight / height,
    ),
  };
}
export function bannerCropRect(width: number, height: number, crop: BannerCrop): BannerRect {
  const view = clampBannerCrop(width, height, crop);
  const cropWidth = Math.min(width, height * BANNER_ASPECT) / view.zoom;
  const cropHeight = cropWidth / BANNER_ASPECT;
  return {
    sx: view.cx * width - cropWidth / 2,
    sy: view.cy * height - cropHeight / 2,
    width: cropWidth,
    height: cropHeight,
  };
}
export function panBannerCrop(
  width: number,
  height: number,
  crop: BannerCrop,
  dx: number,
  dy: number,
  viewportWidth: number,
): BannerCrop {
  const rect = bannerCropRect(width, height, crop);
  if (!(viewportWidth > 0)) return clampBannerCrop(width, height, crop);
  const scale = rect.width / viewportWidth;
  return clampBannerCrop(width, height, {
    ...crop,
    cx: crop.cx - (dx * scale) / width,
    cy: crop.cy - (dy * scale) / height,
  });
}
export function nudgeBannerCrop(
  width: number,
  height: number,
  crop: BannerCrop,
  dx: number,
  dy: number,
): BannerCrop {
  const rect = bannerCropRect(width, height, crop);
  return clampBannerCrop(width, height, {
    ...crop,
    cx: crop.cx - (dx * rect.width) / width,
    cy: crop.cy - (dy * rect.height) / height,
  });
}
