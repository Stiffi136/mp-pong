# mp-pong — Spezifikation

## Überblick

Ein Online-Multiplayer-Pong-Spiel, bei dem zwei Spieler über das Netzwerk gegeneinander antreten. Das Spiel besteht aus einem Node.js-Server (TypeScript) und einem Browser-Client (Canvas API).

---

## Spielregeln

- Zwei Spieler (links / rechts)
- Jeder Spieler steuert einen vertikalen Schläger (Paddle)
- Ein Ball prallt zwischen den Schlägern und den oberen/unteren Wänden ab
- Verfehlt ein Spieler den Ball, erhält der Gegner einen Punkt
- Gewinner ist, wer zuerst **7 Punkte** erreicht
- Nach Ende einer Runde können die Spieler ein Rematch starten

---

## Architektur

```
┌─────────────────────┐        WebSocket        ┌─────────────────────┐
│   Browser (Client)  │ ◄────────────────────── │   Node.js (Server)  │
│   Canvas API        │ ──────────────────────► │   Game Loop         │
└─────────────────────┘                          └─────────────────────┘
```

### Server (`src/server/`)

- **Technologie:** Node.js, TypeScript, `ws` (WebSocket-Bibliothek)
- **Verantwortlichkeiten:**
  - Verwaltung von Spielräumen (Rooms)
  - Autoritativer Game Loop (Spielzustand liegt ausschließlich auf dem Server)
  - Kollisionserkennung (Ball ↔ Wände, Ball ↔ Paddle)
  - Punktestand-Verwaltung
  - Broadcast des Spielzustands an beide Clients (~60 Hz)

### Client (`src/client/`)

- **Technologie:** Browser, TypeScript, Canvas API
- **Verantwortlichkeiten:**
  - Verbindung zum Server per WebSocket
  - Rendern des aktuellen Spielzustands
  - Erfassen und Senden der Spieler-Eingaben (Tastatur)
  - Anzeige von Punktestand, Warteschleife, Spielende

---

## Netzwerkprotokoll

Alle Nachrichten werden als JSON über WebSocket übertragen.

### Client → Server

| Typ           | Payload                        | Beschreibung                          |
|---------------|--------------------------------|---------------------------------------|
| `join`        | `{ name: string }`             | Spieler tritt einem Raum bei          |
| `input`       | `{ up: boolean, down: boolean }` | Aktuelle Paddle-Steuerung             |
| `rematch`     | —                              | Spieler möchte erneut spielen         |

### Server → Client

| Typ           | Payload                        | Beschreibung                          |
|---------------|--------------------------------|---------------------------------------|
| `waiting`     | —                              | Warte auf zweiten Spieler             |
| `start`       | `{ side: "left" \| "right" }`  | Spiel beginnt, teilt Seite mit        |
| `state`       | `GameState`                    | Aktueller Spielzustand (pro Tick)     |
| `score`       | `{ left: number, right: number }` | Punktestand nach einem Punkt       |
| `game_over`   | `{ winner: "left" \| "right" }` | Spiel beendet                        |

### `GameState`-Objekt

```ts
interface GameState {
  ball: { x: number; y: number };
  paddles: {
    left: { y: number };
    right: { y: number };
  };
}
```

---

## Spielfeld

- Logische Auflösung: **800 × 600** Einheiten
- Ball-Radius: 10
- Paddle: 10 × 80 (Breite × Höhe)
- Paddle-Abstand vom Rand: 20

---

## Steuerung

| Spieler | Hoch | Runter |
|---------|------|--------|
| Links   | `W`  | `S`    |
| Rechts  | `↑`  | `↓`    |

---

## Projektstruktur (geplant)

```
mp-pong/
├── src/
│   ├── server/
│   │   ├── index.ts        # Einstiegspunkt, WebSocket-Server
│   │   ├── room.ts         # Raumverwaltung
│   │   └── game.ts         # Game Loop, Physik, Kollision
│   ├── client/
│   │   ├── index.html      # Shell-Seite
│   │   ├── main.ts         # WebSocket-Verbindung, Eingaben
│   │   └── renderer.ts     # Canvas-Rendering
│   └── shared/
│       └── types.ts        # Gemeinsame Typen (GameState, Messages)
├── SPEC.md
├── tsconfig.json
└── eslint.config.mjs
```

---

## Nicht im Scope (v1)

- Authentifizierung / Benutzerkonten
- Persistenter Punktestand / Rangliste
- Mehr als 2 Spieler pro Raum
- Powerups oder Spielvarianten
