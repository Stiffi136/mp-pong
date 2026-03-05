import {
  type GameState,
  CANVAS_SIZE,
  CENTER_X,
  CENTER_Y,
  POLYGON_RADIUS,
  BALL_RADIUS,
  PADDLE_THICKNESS,
  effectivePaddleLength,
} from "../shared/types.js";

function vertex(i: number, n: number): { x: number; y: number } {
  const angle = (2 * Math.PI * i) / n - Math.PI / 2;
  return {
    x: CENTER_X + POLYGON_RADIUS * Math.cos(angle),
    y: CENTER_Y + POLYGON_RADIUS * Math.sin(angle),
  };
}

/** Compute rotation angle so the player's side appears at the bottom. */
function playerRotation(slotIndex: number, n: number): number {
  return Math.PI - ((2 * Math.PI * slotIndex) / n + Math.PI / n);
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available");
    }
    this.ctx = ctx;
  }

  render(state: GameState, mySlotIndex: number): void {
    const ctx = this.ctx;
    const n = state.polygon;
    const rotation = playerRotation(mySlotIndex, n);
    const paddleLen = effectivePaddleLength(state.difficultyLevel);

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.save();
    ctx.translate(CENTER_X, CENTER_Y);
    ctx.rotate(rotation);
    ctx.translate(-CENTER_X, -CENTER_Y);

    this.drawPolygon(n, state, paddleLen);
    this.drawPaddles(state, paddleLen);
    this.drawBall(state.ball.x, state.ball.y);

    ctx.restore();
  }

  show(): void {
    this.canvas.style.display = "block";
  }

  hide(): void {
    this.canvas.style.display = "none";
  }

  private drawPolygon(n: number, state: GameState, paddleLen: number): void {
    const ctx = this.ctx;

    for (let i = 0; i < n; i++) {
      const a = vertex(i, n);
      const b = vertex((i + 1) % n, n);
      const player = state.players.find((p) => p.slotIndex === i);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      if (player?.isAlive) {
        ctx.strokeStyle = "#444";
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = "#666";
        ctx.lineWidth = 3;
      }
      ctx.stroke();

      if (player?.isAlive) {
        this.drawPaddleRangeMarkers(a, b, paddleLen);
      }
    }
  }

  private drawPaddleRangeMarkers(
    a: { x: number; y: number },
    b: { x: number; y: number },
    paddleLen: number,
  ): void {
    const ctx = this.ctx;
    const halfPaddle = paddleLen / 2;
    const lx = a.x + halfPaddle * (b.x - a.x);
    const ly = a.y + halfPaddle * (b.y - a.y);
    const rx = a.x + (1 - halfPaddle) * (b.x - a.x);
    const ry = a.y + (1 - halfPaddle) * (b.y - a.y);

    ctx.save();
    ctx.fillStyle = "#555";
    ctx.beginPath();
    ctx.arc(lx, ly, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rx, ry, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPaddles(state: GameState, paddleLen: number): void {
    const ctx = this.ctx;
    const n = state.polygon;
    const halfPaddle = paddleLen / 2;

    for (const player of state.players) {
      if (!player.isAlive) {
        continue;
      }

      const a = vertex(player.slotIndex, n);
      const b = vertex((player.slotIndex + 1) % n, n);

      const t = player.paddlePos;
      const t0 = t - halfPaddle;
      const t1 = t + halfPaddle;

      const px0 = a.x + t0 * (b.x - a.x);
      const py0 = a.y + t0 * (b.y - a.y);
      const px1 = a.x + t1 * (b.x - a.x);
      const py1 = a.y + t1 * (b.y - a.y);

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      let nx = -dy / len;
      let ny = dx / len;
      const mx = (a.x + b.x) / 2 - CENTER_X;
      const my = (a.y + b.y) / 2 - CENTER_Y;
      if (nx * mx + ny * my > 0) {
        nx = -nx;
        ny = -ny;
      }

      ctx.beginPath();
      ctx.moveTo(px0 + nx * PADDLE_THICKNESS, py0 + ny * PADDLE_THICKNESS);
      ctx.lineTo(px1 + nx * PADDLE_THICKNESS, py1 + ny * PADDLE_THICKNESS);
      ctx.lineTo(px1 - nx * PADDLE_THICKNESS, py1 - ny * PADDLE_THICKNESS);
      ctx.lineTo(px0 - nx * PADDLE_THICKNESS, py0 - ny * PADDLE_THICKNESS);
      ctx.closePath();
      ctx.fillStyle = "#0f0";
      ctx.fill();
    }
  }

  private drawBall(x: number, y: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
}
