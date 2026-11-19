export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function isPointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function isPointInCenteredRect(px, py, cx, cy, w, h) {
  return Math.abs(px - cx) <= w / 2 && Math.abs(py - cy) <= h / 2;
}

export function isPointInCircle(px, py, cx, cy, radius) {
  return dist(px, py, cx, cy) <= radius;
}
