// Vector lighting & pseudo-3D shadow calculation utility for top-down canvas titles

export interface DynamicShadowResult {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

/**
 * Calculates a dynamic 2.5D drop-shadow offset based on piece position relative to an overhead light source.
 * Pieces further from the light source cast longer, subtly softer shadows radiating away from the light center.
 * 
 * @param x Current piece X coordinate
 * @param y Current piece Y coordinate
 * @param lightX Light source X coordinate (e.g. board center)
 * @param lightY Light source Y coordinate (e.g. board center / overhead)
 * @param maxOffset Maximum shadow displacement in pixels (default: 5)
 * @param baseElevation Base downward gravitational shadow drop in pixels (default: 2)
 */
export const calculateDynamicShadow = (
  x: number,
  y: number,
  lightX: number,
  lightY: number,
  maxOffset = 5,
  baseElevation = 2
): DynamicShadowResult => {
  const dx = x - lightX;
  const dy = y - lightY;
  const dist = Math.hypot(dx, dy);

  // Normalize distance against a typical tabletop field radius (~250px)
  const normDist = Math.min(dist / 250, 1.4);
  const angle = Math.atan2(dy, dx);

  const offsetX = Math.cos(angle) * maxOffset * normDist;
  const offsetY = Math.sin(angle) * maxOffset * normDist + baseElevation;
  const blur = Math.max(1.5, normDist * 3.5);

  // Shadow opacity slightly diffuses at greater distances
  const opacity = Math.max(0.18, 0.40 - normDist * 0.08);

  return {
    offsetX,
    offsetY,
    blur,
    color: `rgba(0, 0, 0, ${opacity.toFixed(2)})`,
  };
};

/**
 * Helper to render a circular piece's dynamic drop shadow directly onto a canvas context.
 */
export const renderDynamicCircleShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  lightX: number,
  lightY: number,
  maxOffset = 4.5,
  baseElevation = 2
): void => {
  const shadow = calculateDynamicShadow(x, y, lightX, lightY, maxOffset, baseElevation);
  ctx.save();
  ctx.fillStyle = shadow.color;
  ctx.beginPath();
  ctx.arc(x + shadow.offsetX, y + shadow.offsetY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * Helper to render an elliptical piece's dynamic drop shadow (e.g. curling stone).
 */
export const renderDynamicEllipseShadow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  lightX: number,
  lightY: number,
  maxOffset = 5,
  baseElevation = 3
): void => {
  const shadow = calculateDynamicShadow(x, y, lightX, lightY, maxOffset, baseElevation);
  ctx.save();
  ctx.fillStyle = shadow.color;
  ctx.beginPath();
  ctx.ellipse(x + shadow.offsetX, y + shadow.offsetY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};
