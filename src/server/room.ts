import type WebSocket from "ws";
import { type ClientMessage, type ServerMessage, TICK_RATE, slotForPlayer } from "../shared/types.js";
import { Game, type PlayerInput } from "./game.js";

interface LobbyPlayer {
  ws: WebSocket;
  name: string;
  ready: boolean;
}

interface ActivePlayer {
  ws: WebSocket;
  name: string;
  slotIndex: number;
}

type RoomState = "lobby" | "playing" | "game_over";

export class Room {
  readonly id: string;
  private lobbyPlayers: LobbyPlayer[] = [];
  private activePlayers: ActivePlayer[] = [];
  private game: Game | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private state: RoomState = "lobby";

  constructor(id: string) {
    this.id = id;
  }

  get playerCount(): number {
    if (this.state === "lobby") {
      return this.lobbyPlayers.length;
    }
    return this.activePlayers.length;
  }

  get isEmpty(): boolean {
    return this.lobbyPlayers.length === 0 && this.activePlayers.length === 0;
  }

  addPlayer(ws: WebSocket, name: string): void {
    if (this.state !== "lobby") {
      this.send(ws, {
        type: "lobby",
        players: [],
        count: 0,
      });
      return;
    }

    const player: LobbyPlayer = { ws, name, ready: false };
    this.lobbyPlayers.push(player);
    this.broadcastLobby();
  }

  handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case "ready":
        this.handleReady(ws);
        break;
      case "input":
        this.handleInput(ws, msg);
        break;
      case "rematch":
        this.handleRematch(ws);
        break;
      default:
        break;
    }
  }

  removePlayer(ws: WebSocket): void {
    this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.ws !== ws);
    this.activePlayers = this.activePlayers.filter((p) => p.ws !== ws);

    if (this.state === "lobby") {
      this.broadcastLobby();
    }

    if (this.isEmpty) {
      this.stopGame();
    }
  }

  private handleReady(ws: WebSocket): void {
    if (this.state !== "lobby") {
      return;
    }
    const player = this.lobbyPlayers.find((p) => p.ws === ws);
    if (!player) {
      return;
    }
    player.ready = !player.ready;
    this.broadcastLobby();
    this.tryStart();
  }

  private handleInput(ws: WebSocket, msg: { left: boolean; right: boolean }): void {
    if (this.state !== "playing" || !this.game) {
      return;
    }
    const player = this.activePlayers.find((p) => p.ws === ws);
    if (!player) {
      return;
    }
    const input: PlayerInput = { left: msg.left, right: msg.right };
    this.game.setInput(player.slotIndex, input);
  }

  private handleRematch(ws: WebSocket): void {
    if (this.state !== "game_over") {
      return;
    }
    // Move all active players back to lobby
    this.lobbyPlayers = this.activePlayers.map((p) => ({
      ws: p.ws,
      name: p.name,
      ready: false,
    }));

    // Mark the rematch requester as ready
    const requester = this.lobbyPlayers.find((p) => p.ws === ws);
    if (requester) {
      requester.ready = true;
    }

    this.activePlayers = [];
    this.game = null;
    this.state = "lobby";
    this.broadcastLobby();
  }

  private tryStart(): void {
    if (this.lobbyPlayers.length < 2) {
      return;
    }
    if (!this.lobbyPlayers.every((p) => p.ready)) {
      return;
    }
    this.startGame();
  }

  private startGame(): void {
    const names = this.lobbyPlayers.map((p) => p.name);
    const playerCount = this.lobbyPlayers.length;
    this.activePlayers = this.lobbyPlayers.map((p, i) => ({
      ws: p.ws,
      name: p.name,
      slotIndex: slotForPlayer(i, playerCount),
    }));
    this.lobbyPlayers = [];
    this.state = "playing";

    // Notify all players of game start
    for (const player of this.activePlayers) {
      this.send(player.ws, {
        type: "start",
        slotIndex: player.slotIndex,
        totalPlayers: names.length,
      });
    }

    // Create game and start tick loop
    this.game = new Game(names);
    const tickMs = 1000 / TICK_RATE;
    this.tickInterval = setInterval(() => {
      this.gameTick();
    }, tickMs);
  }

  private gameTick(): void {
    if (!this.game) {
      return;
    }

    const active = this.game.tick();

    // Drain events
    for (const evt of this.game.drainEvents()) {
      if (evt.type === "eliminated") {
        this.broadcast({
          type: "eliminated",
          slotIndex: evt.slotIndex,
          name: evt.name,
        });
      } else if (evt.type === "game_over") {
        this.broadcast({
          type: "game_over",
          winnerIndex: evt.winnerIndex,
          winnerName: evt.winnerName,
        });
        this.stopGame();
        this.state = "game_over";
        return;
      }
    }

    // Broadcast state
    if (active) {
      this.broadcast({ type: "state", state: this.game.state });
    }
  }

  private stopGame(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private broadcastLobby(): void {
    const msg: ServerMessage = {
      type: "lobby",
      players: this.lobbyPlayers.map((p) => ({ name: p.name, ready: p.ready })),
      count: this.lobbyPlayers.length,
    };
    for (const p of this.lobbyPlayers) {
      this.send(p.ws, msg);
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const p of this.activePlayers) {
      if (p.ws.readyState === p.ws.OPEN) {
        p.ws.send(data);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}
