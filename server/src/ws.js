import { WebSocket, WebSocketServer } from "ws";
import { performance } from "node:perf_hooks";
import { validateMessage, MessageTypes } from "./protocol.js";
import { config } from "./config.js";

export function setupWebSocket(httpServer, roomManager) {
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: config.limits.maxPayloadBytes,
  });

  wss.on("connection", (socket, req) => {
    socket.on("error", (err) => {
      console.error("Socket error encountered:", err);
    });

    socket.data = { player: null, room: null };
    socket.missedPongs = 0;
    socket.rateLimit = {
      tokens: config.limits.messageBurst,
      lastRefillAt: performance.now(),
      exceeded: false,
    };

    socket.on("pong", () => {
      socket.missedPongs = 0;
    });

    const joinTimeout = setTimeout(() => { // 5 sec waiting for join message
      if (!socket.data.room) {
        console.log("Connection closed: Join timeout exceeded (5s)");
        socket.close(4001, "Join timeout");
      }
    }, 5000);

    socket.on("message", (data, isBinary) => {
      if (socket.rateLimit.exceeded) {
        return;
      }

      const now = performance.now();
      const elapsedSeconds = (now - socket.rateLimit.lastRefillAt) / 1000;
      socket.rateLimit.tokens = Math.min(
        config.limits.messageBurst,
        socket.rateLimit.tokens +
          elapsedSeconds * config.limits.messagesPerSecond
      );
      socket.rateLimit.lastRefillAt = now;

      if (socket.rateLimit.tokens < 1) {
        socket.rateLimit.exceeded = true;
        console.warn("Connection closed: WebSocket message rate limit exceeded");
        socket.close(4008, "Message rate limit exceeded");
        return;
      }
      socket.rateLimit.tokens -= 1;

      if (isBinary) {
        console.warn("Validation failed: binary WebSocket messages are not supported");
        socket.close(4002, "Text messages required");
        return;
      }

      const validation = validateMessage(data);
      if (!validation.valid) {
        console.warn("Validation failed:", validation.error);
        socket.close(4002, "Invalid message schema");
        return;
      }

      const msg = validation.msg;

      if (msg.type === MessageTypes.JOIN) {
        const { room: roomId, name: playerName } = msg;
        if (socket.data.room) {
          if (socket.data.room.id !== roomId) {
            console.warn("Validation failed: socket attempted to join multiple rooms");
            socket.close(4002, "Already joined to a room");
            return;
          }
          socket.send(
            JSON.stringify({
              type: MessageTypes.JOINED,
              playerId: socket.data.player.id,
              state: socket.data.player.state,
            })
          );
          return;
        }

        clearTimeout(joinTimeout);
        const room = roomManager.getRoom(roomId);
        if (!room) {
          console.warn(`Join rejected: room '${roomId}' does not exist`);
          socket.close(4004, "Room not found");
          return;
        }

        const player = {
          id: Math.random().toString(36).substring(2, 9),
          name: playerName.trim(),
        };

        try {
          room.addPlayer(socket, player);
        } catch (error) {
          console.warn(`Join rejected for room '${roomId}':`, error.message);
          socket.close(4005, "Room is full");
          return;
        }

        socket.data = { player, room };
        socket.send(
          JSON.stringify({
            type: MessageTypes.JOINED,
            playerId: player.id,
            state: player.state,
          })
        );
        console.log(`Player '${playerName}' joined room ${room.id}`);
        return;
      }

      const { player, room } = socket.data;
      if (!room || !player) {
        console.warn(`Message '${msg.type}' received before joining a room`);
        socket.close(4003, "Not joined to any room");
        return;
      }

      if (msg.type === MessageTypes.CHAT) {
        room.emit("chat", {
          player,
          text: msg.text.trim(),
          time: Date.now(),
        });
        return;
      }

      if (msg.type === MessageTypes.STATE) {
        player.state = {
          x: msg.x,
          y: msg.y,
          angle: msg.angle,
          thrust: msg.thrust,
          alive: msg.alive,
        };
        room.broadcast(
          {
            type: MessageTypes.STATE,
            playerId: player.id,
            playerName: player.name,
            ...player.state,
          },
          socket
        );
      }
    });

    socket.on("close", () => {
      clearTimeout(joinTimeout);
      const { player, room } = socket.data;
      if (room && player) {
        room.removePlayer(socket);
        console.log(`Player '${player.name}' left room ${room.id}`);
        socket.data = { player: null, room: null };
      }
    });
  });

  const heartbeatInterval = setInterval(() => { // ping every 15 second with 2 pong timeout
    wss.clients.forEach((socket) => {
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }
      if (socket.missedPongs >= 2) {
        return socket.terminate();
      }
      socket.missedPongs += 1;
      socket.ping();
    });
  }, 15000);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
