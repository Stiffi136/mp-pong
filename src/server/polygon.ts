import {
  CENTER_X,
  CENTER_Y,
  POLYGON_RADIUS,
  BALL_RADIUS,
} from "../shared/types.js";

export interface Vec2 {
  x: number;
  y: number;
}

/** Compute vertex i of a regular n-gon inscribed in circle (cx, cy, r). */
export function vertex(i: number, n: number): Vec2 {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER_X + POLYGON_RADIUS * Math.cos(angle),
    y: CENTER_Y + POLYGON_RADIUS * Math.sin(angle),
  };
}

/** Get all vertices of the polygon. */
export function polygonVertices(n: number): Vec2[] {
  const verts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    verts.push(vertex(i, n));
  }
  return verts;
}

/** Side length of a regular n-gon inscribed in the polygon radius. */
export function sideLength(n: number): number {
  return 2 * POLYGON_RADIUS * Math.sin(Math.PI / n);
}

/** Outward-facing normal of side i (points away from center). */
export function sideNormal(i: number, n: number): Vec2 {
  const a = vertex(i, n);
  const b = vertex((i + 1) % n, n);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Perpendicular pointing outward (away from center)
  const nx = dy / len;
  const ny = -dx / len;
  // Ensure it points outward by checking dot product with (midpoint - center)
  const mx = (a.x + b.x) / 2 - CENTER_X;
  const my = (a.y + b.y) / 2 - CENTER_Y;
  if (nx * mx + ny * my < 0) {
    return { x: -nx, y: -ny };
  }
  return { x: nx, y: ny };
}

/** Distance from a point to a line segment, and the closest point parameter t (0..1). */
export function pointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const distX = px - closestX;
  const distY = py - closestY;
  return { dist: Math.sqrt(distX * distX + distY * distY), t };
}

/** Reflect velocity vector off a normal. */
export function reflect(vx: number, vy: number, nx: number, ny: number): Vec2 {
  const dot = vx * nx + vy * ny;
  return {
    x: vx - 2 * dot * nx,
    y: vy - 2 * dot * ny,
  };
}

/**
 * Check if ball is colliding with side i.
 * Returns collision info or null.
 */
export function checkBallSideCollision(
  ballX: number,
  ballY: number,
  sideIndex: number,
  n: number,
): { dist: number; t: number; normal: Vec2 } | null {
  const a = vertex(sideIndex, n);
  const b = vertex((sideIndex + 1) % n, n);
  const { dist, t } = pointToSegment(ballX, ballY, a.x, a.y, b.x, b.y);
  if (dist <= BALL_RADIUS) {
    const normal = sideNormal(sideIndex, n);
    return { dist, t, normal };
  }
  return null;
}

/**
 * Check if point t along a side falls within the paddle range.
 * paddlePos is 0..1 center position, paddleLength is the effective ratio (0..1).
 */
export function isPaddleHit(paddlePos: number, t: number, paddleLength: number): boolean {
  const halfPaddle = paddleLength / 2;
  const lo = paddlePos - halfPaddle;
  const hi = paddlePos + halfPaddle;
  return t >= lo && t <= hi;
}

/**
 * Calculate spin effect based on where ball hits the paddle.
 * Returns a small angle offset.
 */
export function paddleSpin(paddlePos: number, hitT: number, paddleLength: number): number {
  const halfPaddle = paddleLength / 2;
  const offset = (hitT - paddlePos) / halfPaddle; // -1..1
  return offset * 0.3; // max ±0.3 radians spin
}
