// ── Game State ──────────────────────────────────────────────────────────────

export interface Player {
  slotIndex: number;
  name: string;
  lives: number;
  paddlePos: number; // 0..1 relative position along side
  isAlive: boolean;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GameState {
  ball: Ball;
  players: Player[];
  polygon: number; // number of sides = number of slots
  difficultyLevel: number;
  ticksUntilNextLevel: number;
}

// ── Client → Server Messages ────────────────────────────────────────────────

export interface JoinMessage {
  type: "join";
  name: string;
  room: string;
}

export interface InputMessage {
  type: "input";
  left: boolean;
  right: boolean;
}

export interface ReadyMessage {
  type: "ready";
}

export interface RematchMessage {
  type: "rematch";
}

export type ClientMessage = JoinMessage | InputMessage | ReadyMessage | RematchMessage;

// ── Server → Client Messages ────────────────────────────────────────────────

export interface LobbyInfo {
  name: string;
  ready: boolean;
}

export interface LobbyMessage {
  type: "lobby";
  players: LobbyInfo[];
  count: number;
}

export interface StartMessage {
  type: "start";
  slotIndex: number;
  totalPlayers: number;
}

export interface StateMessage {
  type: "state";
  state: GameState;
}

export interface EliminatedMessage {
  type: "eliminated";
  slotIndex: number;
  name: string;
}

export interface GameOverMessage {
  type: "game_over";
  winnerIndex: number;
  winnerName: string;
}

export type ServerMessage =
  | LobbyMessage
  | StartMessage
  | StateMessage
  | EliminatedMessage
  | GameOverMessage;

// ── Constants ───────────────────────────────────────────────────────────────

export const CANVAS_SIZE = 800;
export const CENTER_X = 400;
export const CENTER_Y = 400;
export const POLYGON_RADIUS = 400;
export const BALL_RADIUS = 8;
export const PADDLE_LENGTH_RATIO = 0.4;
export const PADDLE_THICKNESS = 8;
export const STARTING_LIVES = 3;
export const BALL_SPEED = 5;
export const PADDLE_SPEED = 0.015;
export const TICK_RATE = 60;
export const DIFFICULTY_INTERVAL = 30 * TICK_RATE; // 30 seconds

/** Ball speed multiplier at given difficulty level (grows 40% per level). */
export function ballSpeedMultiplier(level: number): number {
  return 1 + level * 0.4;
}

/** Paddle length multiplier at given difficulty level (shrinks 20% per level, min 20%). */
export function paddleLengthMultiplier(level: number): number {
  return Math.max(0.2, 1 - level * 0.2);
}

/** Effective paddle length ratio at given difficulty level. */
export function effectivePaddleLength(level: number): number {
  return PADDLE_LENGTH_RATIO * paddleLengthMultiplier(level);
}

/**
 * For n players, return the number of polygon sides.
 * 2 players → 4 sides (rectangle), 3+ players → n sides.
 */
export function polygonSides(playerCount: number): number {
  return playerCount < 3 ? 4 : playerCount;
}

/**
 * Map player index (0..playerCount-1) to a polygon side index.
 * For 2 players on a 4-sided polygon, place them on opposite sides (0 and 2).
 */
export function slotForPlayer(playerIndex: number, playerCount: number): number {
  if (playerCount === 2) {
    return playerIndex * 2; // 0 → side 0, 1 → side 2
  }
  return playerIndex;
}
