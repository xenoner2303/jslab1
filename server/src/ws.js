import { WebSocketServer } from "ws";
import { validateMessage, MessageTypes } from "./protocol.js";

export function setupWebSocket(httpServer, roomManager) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    maxPayload: 1024 * 64, // protect against large payloads
  });

  wss.on("connection", (socket, req) => {
    socket.on("error", (err) => {
      console.error("Socket error encountered:", err);
    });

    let currentRoom = null;
    let currentPlayer = null;
    let isAlive = true;

    socket.on("pong", () => {
      isAlive = true;
    });

    const joinTimeout = setTimeout(() => { // 5 sec waiting for join message
      if (!currentRoom) {
        console.log("Connection closed: Join timeout exceeded (5s)");
        socket.close(4001, "Join timeout");
      }
    }, 5000);

    socket.on("message", (data) => {
      const validation = validateMessage(data);
      if (!validation.valid) {
        console.warn("Validation failed:", validation.error);
        socket.close(4002, "Invalid message schema");
        return;
      }

      const msg = validation.msg;

      if (msg.type === MessageTypes.JOIN) {
        clearTimeout(joinTimeout);
        const roomId = msg.room || "default";
        const playerName = String(msg.name || "Player").slice(0, 30);

        let room = roomManager.getRoom(roomId);
        if (!room) {
          room = roomManager.createRoom(msg.roomName || roomId);
        }

        currentRoom = room;
        currentPlayer = {
          id: Math.random().toString(36).substring(2, 9),
          name: playerName,
        };

        room.addPlayer(socket, currentPlayer);
        console.log(`Player '${playerName}' joined room ${room.id}`);
        return;
      }

      if (!currentRoom || !currentPlayer) {
        socket.close(4003, "Not joined to any room");
        return;
      }

      if (msg.type == MessageTypes.CHAT) { // for chat
        const text = String(msg.text || "").trim().slice(0, 256);
        if (text.length > 0) {
          currentRoom.broadcast({
            type: MessageTypes.CHAT,
            sender: currentPlayer.name,
            text,
            time: Date.now(),
          });
        }
      }
    });

    socket.on("close", () => {
      clearTimeout(joinTimeout);
      if (currentRoom && currentPlayer) {
        currentRoom.removePlayer(socket);
        console.log(`Player '${currentPlayer.name}' left room ${currentRoom.id}`);
      }
    });
  });

  const heartbeatInterval = setInterval(() => { // ping every 15 second with 2 pong timeout
    wss.clients.forEach((socket) => {
      if (socket.isAlive == false) {
        return socket.terminate();
      }
      socket.isAlive = false;
      socket.ping();
    });
  }, 15000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
