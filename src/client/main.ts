declare const __WS_URL__: string;

import type { ServerMessage, GameState } from "../shared/types.js";
import { Renderer } from "./renderer.js";
import {
  showScreen,
  updateLobbyList,
  setShareUrl,
  updateHud,
  showGameOver,
  hideGameOver,
} from "./lobby.js";

// ── State ───────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let mySlotIndex = 0;
let renderer: Renderer | null = null;
let currentState: GameState | null = null;
let roomId = "";
const inputState = { left: false, right: false };

// ── DOM refs ────────────────────────────────────────────────────────────────

const btnPlay = document.getElementById("btn-play") as HTMLButtonElement;
const btnJoinShow = document.getElementById("btn-join-show") as HTMLButtonElement;
const joinInputRow = document.getElementById("join-input-row")!;
const inputRoomId = document.getElementById("input-room-id") as HTMLInputElement;
const inputName = document.getElementById("input-name") as HTMLInputElement;
const btnEnter = document.getElementById("btn-enter") as HTMLButtonElement;
const btnReady = document.getElementById("btn-ready") as HTMLButtonElement;
const btnCopy = document.getElementById("btn-copy") as HTMLButtonElement;
const btnRematch = document.getElementById("btn-rematch") as HTMLButtonElement;
const btnLeft = document.getElementById("btn-left") as HTMLButtonElement;
const btnRight = document.getElementById("btn-right") as HTMLButtonElement;
const touchControls = document.getElementById("touch-controls")!;
const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;

// ── Init ────────────────────────────────────────────────────────────────────

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8);
}

function init(): void {
  const hash = window.location.hash.slice(1);
  if (hash) {
    roomId = hash;
    showScreen("name");
  } else {
    showScreen("start");
  }
}

// ── WebSocket ───────────────────────────────────────────────────────────────

function connect(name: string): void {
  const wsUrl = typeof __WS_URL__ !== "undefined" ? __WS_URL__ : "ws://localhost:8080";
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws!.send(JSON.stringify({ type: "join", name, room: roomId }));
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(String(event.data)) as ServerMessage;
    handleServerMessage(msg);
  };

  ws.onclose = () => {
    ws = null;
  };
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case "lobby":
      showScreen("lobby");
      updateLobbyList(msg.players);
      break;

    case "start":
      mySlotIndex = msg.slotIndex;
      renderer = new Renderer(canvas);
      renderer.show();
      showScreen("game");
      hideGameOver();
      document.getElementById("hud")!.style.display = "block";
      touchControls.style.display = "flex";
      break;

    case "state":
      currentState = msg.state;
      updateHud(msg.state.players, msg.state.ticksUntilNextLevel, msg.state.difficultyLevel);
      break;

    case "eliminated":
      // HUD is already updated via state messages
      break;

    case "game_over":
      showGameOver(msg.winnerName);
      break;
  }
}

// ── Render loop ─────────────────────────────────────────────────────────────

function renderLoop(): void {
  if (renderer && currentState) {
    renderer.render(currentState, mySlotIndex);
  }
  requestAnimationFrame(renderLoop);
}
requestAnimationFrame(renderLoop);

// ── Input ───────────────────────────────────────────────────────────────────

function sendInput(): void {
  if (ws?.readyState === WebSocket.OPEN) {
    // Swap left/right to match the rotated view (player's side is at the bottom)
    ws.send(JSON.stringify({ type: "input", left: inputState.right, right: inputState.left }));
  }
}

function isLeftKey(key: string): boolean {
  return key === "ArrowLeft" || key === "a" || key === "A";
}

function isRightKey(key: string): boolean {
  return key === "ArrowRight" || key === "d" || key === "D";
}

document.addEventListener("keydown", (e) => {
  if (isLeftKey(e.key)) {
    inputState.left = true;
    sendInput();
  }
  if (isRightKey(e.key)) {
    inputState.right = true;
    sendInput();
  }
});

document.addEventListener("keyup", (e) => {
  if (isLeftKey(e.key)) {
    inputState.left = false;
    sendInput();
  }
  if (isRightKey(e.key)) {
    inputState.right = false;
    sendInput();
  }
});

// ── Button Handlers ─────────────────────────────────────────────────────────

btnPlay.addEventListener("click", () => {
  roomId = generateRoomId();
  window.location.hash = roomId;
  showScreen("name");
});

btnJoinShow.addEventListener("click", () => {
  joinInputRow.style.display = joinInputRow.style.display === "none" ? "flex" : "none";
});

inputRoomId.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const val = inputRoomId.value.trim();
    if (val) {
      roomId = val;
      window.location.hash = roomId;
      showScreen("name");
    }
  }
});

btnEnter.addEventListener("click", () => {
  const name = inputName.value.trim();
  if (!name) {
    return;
  }
  setShareUrl(`${window.location.origin}${window.location.pathname}#${roomId}`);
  connect(name);
});

inputName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    btnEnter.click();
  }
});

btnReady.addEventListener("click", () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "ready" }));
  }
});

btnCopy.addEventListener("click", () => {
  const url = (document.getElementById("share-url") as HTMLInputElement).value;
  navigator.clipboard.writeText(url).catch(() => {
    // Fallback: select the input
    const input = document.getElementById("share-url") as HTMLInputElement;
    input.select();
  });
});

btnRematch.addEventListener("click", () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "rematch" }));
    hideGameOver();
  }
});

// ── Touch Controls ──────────────────────────────────────────────────────────

function addTouchButton(btn: HTMLButtonElement, dir: "left" | "right"): void {
  const setDir = (pressed: boolean) => {
    inputState[dir] = pressed;
    sendInput();
  };
  btn.addEventListener("touchstart", (e) => { e.preventDefault(); setDir(true); });
  btn.addEventListener("touchend", (e) => { e.preventDefault(); setDir(false); });
  btn.addEventListener("touchcancel", () => { setDir(false); });
  btn.addEventListener("mousedown", () => { setDir(true); });
  btn.addEventListener("mouseup", () => { setDir(false); });
  btn.addEventListener("mouseleave", () => { setDir(false); });
}

addTouchButton(btnLeft, "left");
addTouchButton(btnRight, "right");

// ── Start ───────────────────────────────────────────────────────────────────

init();
