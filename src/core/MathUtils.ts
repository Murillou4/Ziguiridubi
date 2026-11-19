/**
 * UTILITÁRIOS MATEMÁTICOS E GEOMÉTRICOS PUROS
 */

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isPointInRect(
  px: number,
  py: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function isPointInCenteredRect(
  px: number,
  py: number,
  cx: number,
  cy: number,
  w: number,
  h: number
): boolean {
  return Math.abs(px - cx) <= w / 2 && Math.abs(py - cy) <= h / 2;
}

export function isPointInCircle(
  px: number,
  py: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  return dist(px, py, cx, cy) <= radius;
}
