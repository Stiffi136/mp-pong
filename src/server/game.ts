import {
  type GameState,
  type Player,
  type Ball,
  CENTER_X,
  CENTER_Y,
  BALL_SPEED,
  PADDLE_SPEED,
  STARTING_LIVES,
  PADDLE_LENGTH_RATIO,
  polygonSides,
  slotForPlayer,
} from "../shared/types.js";
import {
  checkBallSideCollision,
  isPaddleHit,
  paddleSpin,
  reflect,
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
      ball: this.resetBall(),
      players,
      polygon: sides,
    };
  }

  private resetBall(): Ball {
    const angle = Math.random() * 2 * Math.PI;
    return {
      x: CENTER_X,
      y: CENTER_Y,
      vx: BALL_SPEED * Math.cos(angle),
      vy: BALL_SPEED * Math.sin(angle),
    };
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
    this.updatePaddles();
    this.updateBall();
    return this.isActive();
  }

  private isActive(): boolean {
    const alive = this.state.players.filter((p) => p.isAlive);
    return alive.length > 1;
  }

  private updatePaddles(): void {
    const halfPaddle = PADDLE_LENGTH_RATIO / 2;
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
        this.pushBallInside(collision);
        return;
      }

      if (isPaddleHit(player.paddlePos, collision.t)) {
        // Paddle hit — reflect with spin
        const spin = paddleSpin(player.paddlePos, collision.t);
        this.reflectBall(collision.normal.x, collision.normal.y);
        this.applySpinToBall(spin);
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
      const newBall = this.resetBall();
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
