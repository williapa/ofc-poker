import type { ResponsiveLayoutMode } from "./responsive-layout-invariants";

const MIN_CANVAS_DPR = 1;
const DESKTOP_MAX_CANVAS_DPR = 1.5;
const MOBILE_MAX_CANVAS_DPR = 3;
const MAX_CARD_TEXTURE_ANISOTROPY = 8;

export function createCanvasDprRange(
  mode: ResponsiveLayoutMode,
): [number, number] {
  return [
    MIN_CANVAS_DPR,
    mode === "desktop" ? DESKTOP_MAX_CANVAS_DPR : MOBILE_MAX_CANVAS_DPR,
  ];
}

export function resolveCanvasDpr(
  mode: ResponsiveLayoutMode,
  devicePixelRatio: number,
): number {
  const [minimum, maximum] = createCanvasDprRange(mode);
  return Math.min(maximum, Math.max(minimum, devicePixelRatio));
}

export function resolveCardTextureAnisotropy(maximumSupported: number): number {
  return Math.min(MAX_CARD_TEXTURE_ANISOTROPY, Math.max(1, maximumSupported));
}
