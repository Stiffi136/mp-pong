import {
  type GameState,
  type Player,
  type Ball,
  CENTER_X,
  CENTER_Y,
  BALL_SPEED,
  PADDLE_SPEED,
  STARTING_LIVES,
  DIFFICULTY_INTERVAL,
  polygonSides,
  slotForPlayer,
  ballSpeedMultiplier,
  effectivePaddleLength,
} from "../shared/types.js";
import {
  checkBallSideCollision,
  isPaddleHit,
  paddleSpin,
  reflect,
  sideNormal,
} from "./polygon.js";

export interface PlayerInput {
  left: boolean;
  right: boolean;
}

export type GameEvent =
  | { type: "eliminated"; slotIndex: number; name: string }
  | { type: "game_over"; winnerIndex: number; winnerName: string };

export class Game {
  state: GameState;
  private inputs: Map<number, PlayerInput> = new Map();
  private events: GameEvent[] = [];
  private tickCount = 0;

  constructor(playerNames: string[]) {
    const n = playerNames.length;
    const sides = polygonSides(n);
    const players: Player[] = playerNames.map((name, i) => ({
      slotIndex: slotForPlayer(i, n),
      name,
      lives: STARTING_LIVES,
      paddlePos: 0.5,
      isAlive: true,
    }));

    this.state = {
      ball: this.resetBall(0),
      players,
      polygon: sides,
      difficultyLevel: 0,
      ticksUntilNextLevel: DIFFICULTY_INTERVAL,
    };
  }

  private resetBall(level: number): Ball {
    const speed = BALL_SPEED * ballSpeedMultiplier(level);
    const n = this.state?.polygon ?? 4;
    const MIN_ANGLE = Math.PI / 7.2; // 25°

    // Pick a random angle that isn't too parallel to any wall
    let angle: number;
    let attempts = 0;
    do {
      angle = Math.random() * 2 * Math.PI;
      attempts++;
    } while (attempts < 50 && this.isTooParallel(angle, n, MIN_ANGLE));

    return {
      x: CENTER_X,
      y: CENTER_Y,
      vx: speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
    };
  }

  /** Check if a ball direction would be too parallel to any wall (non-player) side. */
  private isTooParallel(angle: number, n: number, minAngle: number): boolean {
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    for (let i = 0; i < n; i++) {
      // Skip player sides — only check walls
      const isPlayerSide = this.state?.players.some((p) => p.slotIndex === i && p.isAlive);
      if (isPlayerSide) continue;

      const normal = sideNormal(i, n);
      const dot = Math.abs(vx * normal.x + vy * normal.y);
      if (dot < Math.sin(minAngle)) return true;
    }
    return false;
  }

  setInput(slotIndex: number, input: PlayerInput): void {
    this.inputs.set(slotIndex, input);
  }

  /** Drain queued events. */
  drainEvents(): GameEvent[] {
    const evts = this.events;
    this.events = [];
    return evts;
  }

  /** Run one physics tick. Returns true if the game is still active. */
  tick(): boolean {
    this.tickCount++;
    this.updateDifficulty();
    this.updatePaddles();
    this.updateBall();
    return this.isActive();
  }

  private isActive(): boolean {
    const alive = this.state.players.filter((p) => p.isAlive);
    return alive.length > 1;
  }

  private updateDifficulty(): void {
    this.state.ticksUntilNextLevel = DIFFICULTY_INTERVAL - (this.tickCount % DIFFICULTY_INTERVAL);
    const newLevel = Math.floor(this.tickCount / DIFFICULTY_INTERVAL);
    if (newLevel > this.state.difficultyLevel) {
      this.state.difficultyLevel = newLevel;
      // Scale current ball velocity to new speed
      const ball = this.state.ball;
      const currentSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (currentSpeed > 0) {
        const newSpeed = BALL_SPEED * ballSpeedMultiplier(newLevel);
        const scale = newSpeed / currentSpeed;
        ball.vx *= scale;
        ball.vy *= scale;
      }
      // Re-clamp paddle positions for smaller paddles
      const paddleLen = effectivePaddleLength(newLevel);
      const halfPaddle = paddleLen / 2;
      for (const player of this.state.players) {
        player.paddlePos = Math.max(halfPaddle, Math.min(1 - halfPaddle, player.paddlePos));
      }
    }
  }

  private updatePaddles(): void {
    const paddleLen = effectivePaddleLength(this.state.difficultyLevel);
    const halfPaddle = paddleLen / 2;
    for (const player of this.state.players) {
      if (!player.isAlive) {
        continue;
      }
      const input = this.inputs.get(player.slotIndex);
      if (!input) {
        continue;
      }
      if (input.left) {
        player.paddlePos -= PADDLE_SPEED;
      }
      if (input.right) {
        player.paddlePos += PADDLE_SPEED;
      }
      // Clamp so paddle stays on side
      player.paddlePos = Math.max(halfPaddle, Math.min(1 - halfPaddle, player.paddlePos));
    }
  }

  private updateBall(): void {
    const ball = this.state.ball;
    const n = this.state.polygon;
    const paddleLen = effectivePaddleLength(this.state.difficultyLevel);

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Check collision with each side
    for (let i = 0; i < n; i++) {
      const collision = checkBallSideCollision(ball.x, ball.y, i, n);
      if (!collision) {
        continue;
      }

      // Find player assigned to this side (by slotIndex), or treat as wall
      const player = this.state.players.find((p) => p.slotIndex === i);

      if (!player || !player.isAlive) {
        // Wall side (no player, or eliminated player) — always reflect
        this.reflectBall(collision.normal.x, collision.normal.y);
        this.enforceMinBounceAngle(collision.normal.x, collision.normal.y);
        this.pushBallInside(collision);
        return;
      }

      if (isPaddleHit(player.paddlePos, collision.t, paddleLen)) {
        // Paddle hit — reflect with spin
        const spin = paddleSpin(player.paddlePos, collision.t, paddleLen);
        this.reflectBall(collision.normal.x, collision.normal.y);
        this.applySpinToBall(spin);
        this.enforceMinBounceAngle(collision.normal.x, collision.normal.y);
        this.pushBallInside(collision);
        return;
      }

      // Ball passed through — player loses a life
      player.lives--;
      if (player.lives <= 0) {
        player.isAlive = false;
        this.events.push({ type: "eliminated", slotIndex: player.slotIndex, name: player.name });

        // Check for game over
        const alive = this.state.players.filter((p) => p.isAlive);
        if (alive.length === 1) {
          const winner = alive[0]!;
          this.events.push({
            type: "game_over",
            winnerIndex: winner.slotIndex,
            winnerName: winner.name,
          });
        }
      }

      // Reset ball to center
      const newBall = this.resetBall(this.state.difficultyLevel);
      ball.x = newBall.x;
      ball.y = newBall.y;
      ball.vx = newBall.vx;
      ball.vy = newBall.vy;
      return;
    }
  }

  private reflectBall(nx: number, ny: number): void {
    const ball = this.state.ball;
    const v = reflect(ball.vx, ball.vy, nx, ny);
    ball.vx = v.x;
    ball.vy = v.y;
  }

  private applySpinToBall(spin: number): void {
    const ball = this.state.ball;
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    const angle = Math.atan2(ball.vy, ball.vx) + spin;
    ball.vx = speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
  }

  /** Ensure ball doesn't travel nearly parallel to a wall after bouncing. */
  private enforceMinBounceAngle(nx: number, ny: number): void {
    const MIN_ANGLE = Math.PI / 7.2; // 25°
    const ball = this.state.ball;
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed === 0) return;

    const dot = ball.vx * nx + ball.vy * ny;
    const minNormal = speed * Math.sin(MIN_ANGLE);
    if (Math.abs(dot) >= minNormal) return;

    const sign = dot >= 0 ? 1 : -1;
    const tx = ball.vx - dot * nx;
    const ty = ball.vy - dot * ny;
    const tLen = Math.sqrt(tx * tx + ty * ty);
    if (tLen === 0) return;

    const newNormal = minNormal * sign;
    const newTangent = speed * Math.cos(MIN_ANGLE);
    ball.vx = (tx / tLen) * newTangent + nx * newNormal;
    ball.vy = (ty / tLen) * newTangent + ny * newNormal;
  }

  private pushBallInside(collision: {
    dist: number;
    normal: { x: number; y: number };
  }): void {
    // Push ball so it's no longer overlapping the wall
    const ball = this.state.ball;
    const overlap = 8 - collision.dist + 1; // BALL_RADIUS - dist + margin
    ball.x -= collision.normal.x * overlap;
    ball.y -= collision.normal.y * overlap;
  }
}
