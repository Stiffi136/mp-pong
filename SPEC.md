# mp-pong — Specification

## Overview

An online multiplayer Pong game where **any number of players** compete against each other over the network. The playing field is a regular polygon whose number of sides matches the number of players. Each player defends one side. The game consists of a Node.js server (TypeScript) and a browser client (Canvas API). The client is hosted on **GitHub Pages**, the server as a Docker container on **Railway**.

---

## Game Rules

- **At least 2 players** per room, no upper limit
- The playing field is a regular polygon — the number of sides matches the number of players (2 → rectangle, 3 → triangle, 5 → pentagon, 20 → icosagon, …)
- Each player controls a paddle on **their** side of the polygon
- A ball bounces inside the polygon
- If a player misses the ball (ball passes through their side), they lose a **life** (starting: 3 lives)
- A player with 0 lives is eliminated; their side becomes a wall
- The **last remaining player** wins the round
- After a round ends, players can start a rematch
- The game starts once at least **2 players** are in the room and **all players have signaled "Ready"**

---

## Architecture

```
┌─────────────────────┐        WebSocket        ┌─────────────────────┐
│   Browser (Client)  │ ◄────────────────────── │   Node.js (Server)  │
│   Canvas API        │ ──────────────────────► │   Game Loop         │
└─────────────────────┘                          └─────────────────────┘
```

### Server (`src/server/`)

- **Technology:** Node.js, TypeScript, `ws` (WebSocket library)
- **Hosting:** Docker container on Railway
- **No** static file serving — the client is hosted separately on GitHub Pages
- **Responsibilities:**
  - Room management
  - Authoritative game loop (game state resides exclusively on the server)
  - Collision detection (ball ↔ walls, ball ↔ paddle)
  - Score management
  - Player elimination and dynamic wall conversion
  - Broadcasting game state to all clients (~60 Hz)

### Client (`src/client/`)

- **Technology:** Browser, TypeScript, Canvas API
- **Hosting:** GitHub Pages (static files)
- **Responsibilities:**
  - Connecting to the server via WebSocket (configurable URL)
  - Rendering game state with rotation (own side always at the bottom), including paddle edges on all sides
  - Capturing and sending player inputs (keyboard)
  - Displaying scores, waiting screen, game over

---

## Network Protocol

All messages are transmitted as JSON over WebSocket.

### Client → Server

| Type      | Payload                          | Description                           |
| --------- | -------------------------------- | ------------------------------------- |
| `join`    | `{ name: string, room: string }` | Player joins a room                  |
| `input`   | `{ left: boolean, right: boolean }` | Paddle control along own side     |
| `ready`   | —                                | Player signals readiness              |
| `rematch` | —                                | Player wants to play again            |

### Server → Client

| Type          | Payload                                              | Description                               |
| ------------- | ---------------------------------------------------- | ----------------------------------------- |
| `lobby`       | `{ players: { name: string, ready: boolean }[], count: number }` | Current lobby info      |
| `start`       | `{ slotIndex: number, totalPlayers: number }`        | Game begins, assigns slot index           |
| `state`       | `GameState`                                          | Current game state (per tick)             |
| `eliminated`  | `{ slotIndex: number, name: string }`                | A player has been eliminated              |
| `game_over`   | `{ winnerIndex: number, winnerName: string }`        | Game ended                                |

### `GameState` Object

```ts
interface Player {
  slotIndex: number;       // 0 .. n-1, position in polygon
  name: string;
  lives: number;           // 0 = eliminated
  paddlePos: number;       // 0..1 — relative position along the side
  isAlive: boolean;
}

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  players: Player[];
  polygon: number;         // number of sides (= number of slots)
}
```

---

## Playing Field

- The playing field is a **regular polygon** with as many sides as player slots
- The polygon is inscribed in a circle with radius **400** units, centered at **(400, 400)**
- Canvas size: **800 × 800** pixels
- Ball radius: **8**
- Paddle length: **60% of the polygon's side length**
- Paddle thickness: **8**
- Paddle moves along its assigned side
- Each side shows **paddle edges** (markers) indicating the paddle's range of movement — making it immediately visible whether a ball hits an open gap or can still be deflected
- Edges are displayed for **all players** (own side + opponent sides)

### Polygon Geometry

For `n` players, the polygon vertices are calculated:

```
vertex(i) = (
  cx + r * cos(2πi/n - π/2),
  cy + r * sin(2πi/n - π/2)
)
```

Side `i` connects `vertex(i)` with `vertex((i+1) % n)`. Player `i` controls side `i`.

### Client Rotation (own player always at the bottom)

The server calculates all positions in **world coordinates** (polygon centered, no rotation). The client **rotates the entire scene** so that the player's own side always appears **horizontally at the bottom of the screen**.

Rotation angle for player with `slotIndex s` and `n` sides:

```
rotation = π - (2π * s / n + π/n)
```

The polygon, all paddles, and the ball are rendered rotated around the center point `(400, 400)` by this angle.

### Special Case: 2 Players

With 2 players, the rotation produces a classic Pong rotated by 90°: the player's own paddle is horizontal at the bottom, the opponent's is horizontal at the top. The regular polygon system (line/rectangle) is still used — no special case in the code.

---

## Controls

Since each player only sees their own screen, there is a unified control scheme:

| Action       | Key 1     | Key 2 |
| ------------ | --------- | ----- |
| Paddle left  | `A` / `←` | —     |
| Paddle right | `D` / `→` | —     |

"Left" and "right" refer to movement along the player's own polygon side (from the player's perspective).

---

## Project Structure (planned)

```
mp-pong/
├── src/
│   ├── server/
│   │   ├── index.ts        # Entry point, WebSocket server
│   │   ├── room.ts         # Room management & lobby logic
│   │   ├── game.ts         # Game loop, physics, collision
│   │   └── polygon.ts      # Polygon geometry & reflection calculation
│   ├── client/
│   │   ├── index.html      # Shell page
│   │   ├── main.ts         # WebSocket connection, inputs
│   │   ├── renderer.ts     # Canvas rendering (polygon, paddles, ball)
│   │   └── lobby.ts        # Lobby UI (player list, ready button)
│   └── shared/
│       └── types.ts        # Shared types (GameState, Messages, Player)
├── .github/
│   └── workflows/
│       └── deploy-client.yml  # GitHub Pages deployment
├── Dockerfile              # Multi-stage build (server)
├── SPEC.md
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## Physics & Collision

- The ball moves at constant speed (magnitude stays the same, direction changes on reflection)
- **Reflection on wall/paddle:** The ball is reflected along the normal vector of the respective polygon side
- **Paddle hit:** The impact angle is slightly influenced by the distance from the paddle center (spin effect)
- **Passing through a side:** When the ball passes through a side where no paddle intercepts it:
  - If the player is active → player loses 1 life
  - If the side is a wall (player eliminated) → ball bounces off as on a normal wall
- After a life loss, the ball is reset to the center with a random direction

## Rooms & Lobby System

### Start Screen

When first opening the page (without a hash in the URL), the player sees two buttons:

- **Play** — Creates a new room with a random ID, sets the hash in the URL (`#roomId`) and proceeds to name entry
- **Join** — Shows an input field for the room ID. After entry, the hash is set and proceeds to name entry

If the page is opened with a hash (e.g. via a shared link), the start screen is skipped and name entry is shown directly.

### Flow

1. **Start screen** → Play / Join (only without hash)
2. **Name entry** → Player enters their name, `join` message is sent
3. **Lobby** → Player list with ready status, shareable URL is displayed
4. **Game** → Starts when all are ready

### Room URL

- The room ID is stored in the URL hash: `https://…/#roomId`
- Players can share the URL to invite others to the same room

### Lobby

- In the lobby, all players see who has joined (names + ready status)
- The shareable room URL is prominently displayed (copy button)
- Each player can mark themselves as **"Ready"** via button/key (toggle)
- The game starts automatically once **at least 2 players** are in the room and **all** are ready
- The polygon shape is determined at start (based on player count)

---

## Deployment

### Server (Railway + Docker)

- Pure WebSocket server, **no** HTTP file serving
- Port via environment variable `PORT` (Railway sets this automatically, default: `8080`)
- CORS headers to allow WebSocket connections from GitHub Pages

#### Environment Variables (Server)

| Variable | Description          | Default |
| -------- | -------------------- | ------- |
| `PORT`   | WebSocket server port | `8080` |

#### Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:server

# Runtime stage
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist/server ./dist/server
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server/index.js"]
```

### Client (GitHub Pages)

- Static files (`index.html`, bundled JS file) are hosted on GitHub Pages
- The WebSocket server URL is injected at **build time** as an environment variable
- For local development: `ws://localhost:8080` as default

#### Environment Variables (Client Build)

| Variable          | Description                           | Default                |
| ----------------- | ------------------------------------- | ---------------------- |
| `WS_URL`          | WebSocket URL of the server           | `ws://localhost:8080`  |

The variable is embedded as a string constant in the client during bundling (esbuild `define`).

### Build Process

- **Server:** TypeScript → `dist/server/` (via `tsc`)
- **Client:** TypeScript bundling → `dist/client/` (via `esbuild`, with `WS_URL` injection)
- GitHub Actions workflow builds the client and deploys to GitHub Pages

---

## Out of Scope (v1)

- Authentication / user accounts
- Persistent scores / leaderboard
- Player limit per room
- Powerups or game variants
- Spectator mode
