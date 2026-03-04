# mp-pong — Spezifikation

## Überblick

Ein Online-Multiplayer-Pong-Spiel, bei dem **2 bis 8 Spieler** über das Netzwerk gegeneinander antreten. Das Spielfeld ist ein regelmäßiges Polygon — bei 2 Spielern das klassische Rechteck, bei 3–8 Spielern ein entsprechendes Polygon (Dreieck bis Oktagon). Jeder Spieler verteidigt eine Seite. Das Spiel besteht aus einem Node.js-Server (TypeScript) und einem Browser-Client (Canvas API). Der Client wird auf **GitHub Pages** gehostet, der Server als Docker-Container auf **Railway**.

---

## Spielregeln

- **2 bis 8 Spieler** pro Raum
- Das Spielfeld ist ein regelmäßiges Polygon — die Seitenanzahl entspricht der Spieleranzahl (2 Spieler → klassisches Rechteck, 3 → Dreieck, … 8 → Oktagon)
- Jeder Spieler kontrolliert ein Paddle auf **seiner** Seite des Polygons
- Ein Ball prallt innerhalb des Polygons ab
- Verfehlt ein Spieler den Ball (Ball passiert seine Seite), verliert er ein **Leben** (Start: 3 Leben)
- Ein Spieler mit 0 Leben scheidet aus; seine Seite wird zur Wand
- Der **letzte verbleibende Spieler** gewinnt die Runde
- Nach Ende einer Runde können die Spieler ein Rematch starten
- Das Spiel startet, sobald mindestens **2 Spieler** im Raum sind und **alle Spieler „Ready"** signalisiert haben

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
- **Hosting:** Docker-Container auf Railway
- **Kein** statisches File-Serving — der Client wird separat auf GitHub Pages gehostet
- **Verantwortlichkeiten:**
  - Verwaltung von Spielräumen (Rooms)
  - Autoritativer Game Loop (Spielzustand liegt ausschließlich auf dem Server)
  - Kollisionserkennung (Ball ↔ Wände, Ball ↔ Paddle)
  - Punktestand-Verwaltung
  - Spieler-Eliminierung und dynamische Wandkonvertierung
  - Broadcast des Spielzustands an alle Clients (~60 Hz)

### Client (`src/client/`)

- **Technologie:** Browser, TypeScript, Canvas API
- **Hosting:** GitHub Pages (statische Dateien)
- **Verantwortlichkeiten:**
  - Verbindung zum Server per WebSocket (URL konfigurierbar)
  - Rendern des Spielzustands mit Rotation (eigene Seite immer unten), inkl. Paddle-Ränder auf allen Seiten
  - Erfassen und Senden der Spieler-Eingaben (Tastatur)
  - Anzeige von Punktestand, Warteschleife, Spielende

---

## Netzwerkprotokoll

Alle Nachrichten werden als JSON über WebSocket übertragen.

### Client → Server

| Typ       | Payload                          | Beschreibung                          |
| --------- | -------------------------------- | ------------------------------------- |
| `join`    | `{ name: string, room: string }` | Spieler tritt einem Raum bei          |
| `input`   | `{ left: boolean, right: boolean }` | Paddle-Steuerung entlang der eigenen Seite |
| `ready`     | —                              | Spieler signalisiert Bereitschaft      |
| `rematch` | —                                | Spieler möchte erneut spielen         |

### Server → Client

| Typ           | Payload                                              | Beschreibung                              |
| ------------- | ---------------------------------------------------- | ----------------------------------------- |
| `lobby`       | `{ players: { name: string, ready: boolean }[], count: number, max: number }` | Aktuelle Lobby-Info |
| `start`       | `{ slotIndex: number, totalPlayers: number }`        | Spiel beginnt, teilt Slot-Index mit       |
| `state`       | `GameState`                                          | Aktueller Spielzustand (pro Tick)         |
| `eliminated`  | `{ slotIndex: number, name: string }`                | Ein Spieler ist ausgeschieden             |
| `game_over`   | `{ winnerIndex: number, winnerName: string }`        | Spiel beendet                             |

### `GameState`-Objekt

```ts
interface Player {
  slotIndex: number;       // 0 .. n-1, Position im Polygon
  name: string;
  lives: number;           // 0 = eliminiert
  paddlePos: number;       // 0..1 — relative Position entlang der Seite
  isAlive: boolean;
}

interface GameState {
  ball: { x: number; y: number; vx: number; vy: number };
  players: Player[];
  polygon: number;         // Anzahl Seiten (= Anzahl Slots)
}
```

---

## Spielfeld

- Das Spielfeld ist ein **regelmäßiges Polygon** mit so vielen Seiten wie Spieler-Slots
- Das Polygon ist in einen Kreis mit Radius **400** Einheiten einbeschrieben, zentriert bei **(400, 400)**
- Canvas-Größe: **800 × 800** Pixel
- Ball-Radius: **8**
- Paddle-Länge: **60% der Seitenlänge** des Polygons
- Paddle-Dicke: **8**
- Paddle bewegt sich entlang seiner zugewiesenen Seite
- Jede Seite zeigt **Paddle-Ränder** (Markierungen), die den Bewegungsbereich des Paddles kennzeichnen — so ist sofort erkennbar, ob ein Ball eine offene Lücke trifft oder noch abgewehrt werden kann
- Die Ränder werden für **alle Spieler** angezeigt (eigene Seite + Gegnerseiten)

### Polygon-Geometrie

Für `n` Spieler werden die Eckpunkte des Polygons berechnet:

```
vertex(i) = (
  cx + r * cos(2πi/n - π/2),
  cy + r * sin(2πi/n - π/2)
)
```

Seite `i` verbindet `vertex(i)` mit `vertex((i+1) % n)`. Spieler `i` kontrolliert Seite `i`.

### Client-Rotation (eigener Spieler immer unten)

Der Server berechnet alle Positionen in **Weltkoordinaten** (Polygon zentriert, keine Rotation). Der Client **rotiert die gesamte Szene**, sodass die eigene Seite des Spielers immer **horizontal am unteren Bildschirmrand** erscheint.

Rotationswinkel für Spieler mit `slotIndex s` bei `n` Seiten:

```
rotation = π - (2π * s / n + π/n)
```

Das Polygon, alle Paddles und der Ball werden um den Mittelpunkt `(400, 400)` um diesen Winkel rotiert gerendert.

### Sonderfall: 2 Spieler

Bei 2 Spielern entsteht durch die Rotation ein um 90° gedrehtes klassisches Pong: der eigene Spieler hat sein Paddle horizontal unten, der Gegner horizontal oben. Es wird trotzdem das reguläre Polygon-System (Linie/Rechteck) verwendet — kein Sonderfall im Code.

---

## Steuerung

Da jeder Spieler nur seinen eigenen Bildschirm sieht, gibt es eine einheitliche Steuerung:

| Aktion         | Taste 1 | Taste 2 |
| -------------- | ------- | ------- |
| Paddle links   | `A` / `←` | —    |
| Paddle rechts  | `D` / `→` | —    |

„Links" und „Rechts" beziehen sich auf die Bewegung entlang der eigenen Polygon-Seite (vom Spieler aus gesehen).

---

## Projektstruktur (geplant)

```
mp-pong/
├── src/
│   ├── server/
│   │   ├── index.ts        # Einstiegspunkt, WebSocket-Server
│   │   ├── room.ts         # Raumverwaltung & Lobby-Logik
│   │   ├── game.ts         # Game Loop, Physik, Kollision
│   │   └── polygon.ts      # Polygon-Geometrie & Reflexionsberechnung
│   ├── client/
│   │   ├── index.html      # Shell-Seite
│   │   ├── main.ts         # WebSocket-Verbindung, Eingaben
│   │   ├── renderer.ts     # Canvas-Rendering (Polygon, Paddles, Ball)
│   │   └── lobby.ts        # Lobby-UI (Spielerliste, Ready-Button)
│   └── shared/
│       └── types.ts        # Gemeinsame Typen (GameState, Messages, Player)
├── .github/
│   └── workflows/
│       └── deploy-client.yml  # GitHub Pages Deployment
├── Dockerfile              # Multi-stage Build (Server)
├── SPEC.md
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

---

## Physik & Kollision

- Der Ball bewegt sich mit konstanter Geschwindigkeit (Betrag bleibt gleich, Richtung ändert sich bei Reflexion)
- **Reflexion an Wand/Paddle:** Der Ball wird am Normalenvektor der jeweiligen Polygon-Seite reflektiert
- **Paddle-Treffer:** Der Auftreffwinkel wird leicht vom Abstand zur Paddle-Mitte beeinflusst (Spin-Effekt)
- **Durchgang durch eine Seite:** Wenn der Ball eine Seite passiert, auf der kein Paddle den Ball abfängt:
  - Ist der Spieler aktiv → Spieler verliert 1 Leben
  - Ist die Seite eine Wand (Spieler eliminiert) → Ball prallt ab wie an einer normalen Wand
- Nach einem Lebensverlust wird der Ball in die Mitte zurückgesetzt mit zufälliger Richtung

## Räume & Lobby-System

### Startscreen

Beim ersten Öffnen der Seite (ohne Hash in der URL) sieht der Spieler zwei Buttons:

- **Play** — Erstellt einen neuen Raum mit zufälliger ID, setzt den Hash in der URL (`#roomId`) und leitet zur Namenseingabe weiter
- **Join** — Zeigt ein Eingabefeld für die Raum-ID. Nach Eingabe wird der Hash gesetzt und zur Namenseingabe weitergeleitet

Wird die Seite mit einem Hash geöffnet (z.B. über einen geteilten Link), wird der Startscreen übersprungen und direkt die Namenseingabe angezeigt.

### Ablauf

1. **Startscreen** → Play / Join (nur ohne Hash)
2. **Namenseingabe** → Spieler gibt seinen Namen ein, `join`-Nachricht wird gesendet
3. **Lobby** → Spielerliste mit Ready-Status, teilbare URL wird angezeigt
4. **Spiel** → Startet wenn alle Ready

### Raum-URL

- Die Raum-ID wird im URL-Hash gespeichert: `https://…/#roomId`
- Spieler können die URL teilen, um andere in denselben Raum einzuladen

### Lobby

- In der Lobby sehen alle Spieler, wer beigetreten ist (Namen + Ready-Status)
- Die teilbare Raum-URL wird prominent angezeigt (Copy-Button)
- Jeder Spieler kann sich per Button/Taste als **„Ready"** markieren (Toggle)
- Das Spiel startet automatisch, sobald **mindestens 2 Spieler** im Raum sind und **alle** Ready sind
- Die Polygon-Form wird beim Start festgelegt (basierend auf Spieleranzahl)

---

## Deployment

### Server (Railway + Docker)

- Reiner WebSocket-Server, **kein** HTTP-File-Serving
- Port über Umgebungsvariable `PORT` (Railway setzt diese automatisch, Default: `8080`)
- CORS-Header für WebSocket-Verbindungen von GitHub Pages erlauben

#### Umgebungsvariablen (Server)

| Variable | Beschreibung | Default |
| -------- | ------------ | ------- |
| `PORT`   | WebSocket-Server-Port | `8080` |

#### Dockerfile

```dockerfile
# Build-Stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:server

# Runtime-Stage
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

- Statische Dateien (`index.html`, gebundelte JS-Datei) werden auf GitHub Pages gehostet
- Die WebSocket-Server-URL wird zur **Build-Zeit** als Umgebungsvariable injiziert
- Für lokale Entwicklung: `ws://localhost:8080` als Default

#### Umgebungsvariablen (Client-Build)

| Variable          | Beschreibung                          | Default                |
| ----------------- | ------------------------------------- | ---------------------- |
| `WS_URL`          | WebSocket-URL des Servers             | `ws://localhost:8080`  |

Die Variable wird beim Bundling (esbuild `define`) als String-Konstante in den Client eingebettet.

### Build-Prozess

- **Server:** TypeScript → `dist/server/` (via `tsc`)
- **Client:** TypeScript-Bundling → `dist/client/` (via `esbuild`, mit `WS_URL`-Injection)
- GitHub Actions Workflow baut den Client und deployt nach GitHub Pages

---

## Nicht im Scope (v1)

- Authentifizierung / Benutzerkonten
- Persistenter Punktestand / Rangliste
- Mehr als 8 Spieler pro Raum
- Powerups oder Spielvarianten
- Zuschauer-Modus
