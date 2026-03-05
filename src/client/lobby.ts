import { type LobbyInfo, TICK_RATE } from "../shared/types.js";

type Screen = "start" | "name" | "lobby" | "game";

const screens: Record<Screen, HTMLElement> = {
  start: document.getElementById("start-screen")!,
  name: document.getElementById("name-screen")!,
  lobby: document.getElementById("lobby-screen")!,
  game: document.getElementById("game-canvas")!,
};

export function showScreen(name: Screen): void {
  for (const [key, el] of Object.entries(screens)) {
    if (key === "game") {
      (el as HTMLCanvasElement).style.display = name === "game" ? "block" : "none";
    } else {
      el.classList.toggle("active", key === name);
    }
  }
}

export function updateLobbyList(players: LobbyInfo[]): void {
  const list = document.getElementById("lobby-players")!;
  list.innerHTML = "";
  for (const p of players) {
    const li = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = p.name;
    li.appendChild(nameSpan);
    if (p.ready) {
      const badge = document.createElement("span");
      badge.className = "ready-badge";
      badge.textContent = "READY";
      li.appendChild(badge);
    }
    list.appendChild(li);
  }
}

export function setShareUrl(url: string): void {
  const input = document.getElementById("share-url") as HTMLInputElement;
  input.value = url;
}

export function updateHud(
  players: { name: string; lives: number; isAlive: boolean }[],
  ticksUntilNextLevel: number,
  difficultyLevel: number,
): void {
  const hud = document.getElementById("hud")!;
  hud.style.display = "block";
  const display = document.getElementById("lives-display")!;
  display.innerHTML = "";
  for (const p of players) {
    const span = document.createElement("span");
    span.textContent = `${p.name}: ${"♥".repeat(p.lives)}`;
    if (!p.isAlive) {
      span.className = "eliminated";
    }
    display.appendChild(span);
  }
  // Difficulty timer
  const timer = document.getElementById("difficulty-timer")!;
  const seconds = Math.ceil(ticksUntilNextLevel / TICK_RATE);
  timer.textContent = `Lv ${String(difficultyLevel + 1)} in ${String(seconds)}s`;
}

export function showGameOver(winnerName: string): void {
  const overlay = document.getElementById("game-over-overlay")!;
  overlay.classList.add("active");
  document.getElementById("winner-text")!.textContent = `${winnerName} wins!`;
}

export function hideGameOver(): void {
  document.getElementById("game-over-overlay")!.classList.remove("active");
}
