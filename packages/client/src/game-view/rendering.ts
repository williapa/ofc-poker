import type { ResponsiveLayoutMode } from "./responsive-layout-invariants";
import { ExtrudeGeometry, Shape } from "three";

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

export function createRoundedCardGeometry(
  width: number,
  height: number,
  depth: number,
  radius: number,
): ExtrudeGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();

  shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
  shape.lineTo(halfWidth - cornerRadius, -halfHeight);
  shape.absarc(
    halfWidth - cornerRadius,
    -halfHeight + cornerRadius,
    cornerRadius,
    -Math.PI / 2,
    0,
    false,
  );
  shape.lineTo(halfWidth, halfHeight - cornerRadius);
  shape.absarc(
    halfWidth - cornerRadius,
    halfHeight - cornerRadius,
    cornerRadius,
    0,
    Math.PI / 2,
    false,
  );
  shape.lineTo(-halfWidth + cornerRadius, halfHeight);
  shape.absarc(
    -halfWidth + cornerRadius,
    halfHeight - cornerRadius,
    cornerRadius,
    Math.PI / 2,
    Math.PI,
    false,
  );
  shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
  shape.absarc(
    -halfWidth + cornerRadius,
    -halfHeight + cornerRadius,
    cornerRadius,
    Math.PI,
    (Math.PI * 3) / 2,
    false,
  );

  const geometry = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
