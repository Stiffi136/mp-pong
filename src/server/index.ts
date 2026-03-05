import { type WebSocket, WebSocketServer } from "ws";
import type { ClientMessage } from "../shared/types.js";
import { Room } from "./room.js";

// eslint-disable-next-line dot-notation
const PORT = Number(process.env["PORT"]) || 8080;
const rooms = new Map<string, Room>();

function getOrCreateRoom(id: string): Room {
  let room = rooms.get(id);
  if (!room) {
    room = new Room(id);
    rooms.set(id, room);
  }
  return room;
}

function cleanupRoom(id: string): void {
  const room = rooms.get(id);
  if (room?.isEmpty) {
    rooms.delete(id);
  }
}

const wss = new WebSocketServer({ port: PORT });

// Map each ws connection to its room
const wsRoom = new Map<WebSocket, string>();

wss.on("connection", (ws: WebSocket) => {
  ws.on("message", (data: Buffer) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data)) as ClientMessage;
    } catch {
      return;
    }

    if (msg.type === "join") {
      const roomId = msg.room;
      const room = getOrCreateRoom(roomId);
      wsRoom.set(ws, roomId);
      room.addPlayer(ws, msg.name);
      return;
    }

    const roomId = wsRoom.get(ws);
    if (!roomId) {
      return;
    }
    const room = rooms.get(roomId);
    if (!room) {
      return;
    }
    room.handleMessage(ws, msg);
  });

  ws.on("close", () => {
    const roomId = wsRoom.get(ws);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.removePlayer(ws);
        cleanupRoom(roomId);
      }
      wsRoom.delete(ws);
    }
  });
});

const log = console.log.bind(console); // eslint-disable-line no-console
log(`mp-pong server listening on port ${String(PORT)}`);
