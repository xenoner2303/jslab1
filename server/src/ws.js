import { WebSocket, WebSocketServer } from "ws";
import { performance } from "node:perf_hooks";
import { validateMessage, MessageTypes } from "./protocol.js";
import { validateInputMessage } from "../../shared/protocol/messages.js";
import { decodeBinaryMessage } from "../../shared/codec/binary.js";
import { config } from "./config.js";
import { encodeJsonMessage } from "../../shared/codec/json.js";

function createNetworkSimulation(req) {
  const params = new URL(req.url, "http://localhost").searchParams;
  const boundedNumber = (name, fallback, min, max) => {
    const value = Number(params.get(name));
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  };
  const latencyMs = boundedNumber("latencyMs", 0, 0, 2000);
  const jitterMs = boundedNumber("jitterMs", 0, 0, 1000);
  const dropRate = boundedNumber("dropRate", 0, 0, 0.25);
  const nextDeliveryAt = { incoming: 0, outgoing: 0 };
  const timers = new Set();

  return {
    settings: { latencyMs, jitterMs, dropRate },
    schedule(direction, callback) {
      if (Math.random() < dropRate) return false;

      const jitter = (Math.random() * 2 - 1) * jitterMs;
      const requestedAt = performance.now() + Math.max(0, latencyMs + jitter);
      const deliveryAt = Math.max(requestedAt, nextDeliveryAt[direction]);
      nextDeliveryAt[direction] = deliveryAt;
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, Math.max(0, deliveryAt - performance.now()));
      timers.add(timer);
      return true;
    },
    clear() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}

export function setupWebSocket(httpServer, roomManager) {
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: config.limits.maxPayloadBytes,
  });

  wss.on("connection", (socket, req) => {
    socket.on("error", (err) => {
      console.error("Socket error encountered:", err);
    });

    const networkSimulation = createNetworkSimulation(req);
    const codec =
      new URL(req.url, "http://localhost").searchParams.get("codec") ===
      "binary"
        ? "binary"
        : "json";
    socket.data = { player: null, room: null, networkSimulation, codec };
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

      let validation;
      if (isBinary) {
        if (codec !== "binary") {
          console.warn("Validation failed: binary codec was not enabled");
          socket.close(4002, "Binary codec not enabled");
          return;
        }

        try {
          validation = validateInputMessage(decodeBinaryMessage(data));
        } catch (error) {
          console.warn("Validation failed: invalid binary message:", error.message);
          socket.close(4002, "Invalid binary message");
          return;
        }
      } else {
        validation = validateMessage(data);
      }
      if (!validation.valid) {
        console.warn("Validation failed:", validation.error);
        socket.close(4002, "Invalid message schema");
        return;
      }

      const msg = validation.msg;
      if (codec === "binary" && msg.type === MessageTypes.INPUT && !isBinary) {
        console.warn("Validation failed: binary input required by selected codec");
        socket.close(4002, "Binary input required");
        return;
      }

      if (msg.type === MessageTypes.JOIN) {
        const { room: roomId, name: playerName } = msg;
        if (socket.data.room) {
          if (socket.data.room.id !== roomId) {
            console.warn("Validation failed: socket attempted to join multiple rooms");
            socket.close(4002, "Already joined to a room");
            return;
          }
          socket.send(
            encodeJsonMessage({
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

        socket.data = { player, room, networkSimulation, codec };
        socket.send(
          encodeJsonMessage({
            type: MessageTypes.JOINED,
            playerId: player.id,
            state: player.state,
            seed: room.match.seed,
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

      if (msg.type === MessageTypes.INPUT) {
        networkSimulation.schedule("incoming", () => {
          if (!room.match.enqueueInput(player.id, msg)) {
            console.warn(
              `Dropped stale or queued input ${msg.seq} from player '${player.name}'`
            );
          }
        });
      }
    });

    socket.on("close", () => {
      clearTimeout(joinTimeout);
      const { player, room } = socket.data;
      if (room && player) {
        room.removePlayer(socket);
        console.log(`Player '${player.name}' left room ${room.id}`);
        socket.data = { player: null, room: null, networkSimulation, codec };
      }
      networkSimulation.clear();
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
