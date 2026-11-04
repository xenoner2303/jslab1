import { performance } from "node:perf_hooks";
import type { Server as HttpServer, IncomingMessage } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import {
  MessageTypes,
  ServerMessageTypes,
  parseClientMessage,
} from "../../shared/protocol.ts";
import { getCodec } from "../../shared/codec/index.ts";
import { config } from "./config.ts";
import { startHeartbeat } from "./heartbeat.ts";
import {
  consumeMessageToken,
  createTokenBucket,
  type TokenBucket,
} from "./rateLimit.ts";
import type { Player, Room, RoomManager, RoomSocket } from "./rooms.ts";

type NetworkSimulation = {
  readonly settings: {
    readonly latencyMs: number;
    readonly jitterMs: number;
    readonly dropRate: number;
  };
  schedule(direction: "incoming" | "outgoing", callback: () => void): boolean;
  clear(): void;
};

type SocketData = {
  player: Player | null;
  room: Room | null;
  readonly networkSimulation: NetworkSimulation;
  readonly codec: "json" | "binary";
};

type ClientSocket = RoomSocket & {
  data: SocketData;
  missedPongs: number;
  rateLimit: TokenBucket;
};

function createNetworkSimulation(req: IncomingMessage): NetworkSimulation {
  const params = new URL(req.url ?? "/", "http://localhost").searchParams;
  const boundedNumber = (
    name: string,
    fallback: number,
    min: number,
    max: number,
  ): number => {
    const value = Number(params.get(name));
    return Number.isFinite(value)
      ? Math.max(min, Math.min(max, value))
      : fallback;
  };
  const latencyMs = boundedNumber("latencyMs", 0, 0, 2000);
  const jitterMs = boundedNumber("jitterMs", 0, 0, 1000);
  const dropRate = boundedNumber("dropRate", 0, 0, 0.25);
  const nextDeliveryAt: Record<"incoming" | "outgoing", number> = {
    incoming: 0,
    outgoing: 0,
  };
  const timers = new Set<ReturnType<typeof setTimeout>>();

  return {
    settings: { latencyMs, jitterMs, dropRate },
    schedule(direction, callback) {
      if (Math.random() < dropRate) return false;

      const jitter = (Math.random() * 2 - 1) * jitterMs;
      const requestedAt = performance.now() + Math.max(0, latencyMs + jitter);
      const deliveryAt = Math.max(requestedAt, nextDeliveryAt[direction]);
      nextDeliveryAt[direction] = deliveryAt;
      const timer = setTimeout(
        () => {
          timers.delete(timer);
          callback();
        },
        Math.max(0, deliveryAt - performance.now()),
      );
      timers.add(timer);
      return true;
    },
    clear() {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function setupWebSocket(
  httpServer: HttpServer,
  roomManager: RoomManager,
): WebSocketServer {
  const jsonCodec = getCodec("json");
  const binaryCodec = getCodec("binary");
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: config.limits.maxPayloadBytes,
  });
  const clients = new Set<ClientSocket>();

  wss.on("connection", (socket, req) => {
    socket.on("error", (error) => {
      console.error("Socket error encountered:", error);
    });

    const networkSimulation = createNetworkSimulation(req);
    const codec: SocketData["codec"] =
      new URL(req.url ?? "/", "http://localhost").searchParams.get("codec") ===
      "binary"
        ? "binary"
        : "json";
    const client: ClientSocket = Object.assign(socket, {
      data: { player: null, room: null, networkSimulation, codec },
      missedPongs: 0,
      rateLimit: createTokenBucket(
        config.limits.messageBurst,
        performance.now(),
      ),
    });
    clients.add(client);

    client.on("pong", () => {
      client.missedPongs = 0;
    });

    const joinTimeout = setTimeout(() => {
      if (!client.data.room) {
        console.log("Connection closed: Join timeout exceeded (5s)");
        client.close(4001, "Join timeout");
      }
    }, 5000);

    client.on("message", (data, isBinary) => {
      const alreadyLimited = client.rateLimit.exceeded;
      if (
        !consumeMessageToken(
          client.rateLimit,
          performance.now(),
          config.limits.messageBurst,
          config.limits.messagesPerSecond,
        )
      ) {
        if (!alreadyLimited) {
          console.warn(
            "Connection closed: WebSocket message rate limit exceeded",
          );
          client.close(4008, "Message rate limit exceeded");
        }
        return;
      }

      const messageData = Array.isArray(data) ? Buffer.concat(data) : data;
      let rawMessage: unknown;
      if (isBinary) {
        if (codec !== "binary") {
          console.warn("Validation failed: binary codec was not enabled");
          client.close(4002, "Binary codec not enabled");
          return;
        }

        try {
          rawMessage = binaryCodec.decode(messageData);
        } catch (error: unknown) {
          console.warn(
            "Validation failed: invalid binary message:",
            getErrorMessage(error),
          );
          client.close(4002, "Invalid binary message");
          return;
        }
      } else {
        try {
          const text =
            typeof messageData === "string"
              ? messageData
              : messageData instanceof ArrayBuffer
                ? Buffer.from(new Uint8Array(messageData)).toString()
                : messageData.toString();
          rawMessage = jsonCodec.decode(text);
        } catch (error: unknown) {
          console.warn(
            "Validation failed: invalid JSON message:",
            getErrorMessage(error),
          );
          client.close(4002, "Invalid JSON message");
          return;
        }
      }

      const validation = parseClientMessage(rawMessage);
      if (!validation.success) {
        console.warn("Validation failed:", validation.error);
        client.close(4002, "Invalid message schema");
        return;
      }

      const msg = validation.data;
      if (codec === "binary" && msg.type === MessageTypes.INPUT && !isBinary) {
        console.warn(
          "Validation failed: binary input required by selected codec",
        );
        client.close(4002, "Binary input required");
        return;
      }

      if (msg.type === MessageTypes.JOIN) {
        const { room: roomId, name: playerName } = msg;
        if (client.data.room) {
          const player = client.data.player;
          if (!player) {
            client.close(4003, "Not joined to any room");
            return;
          }
          if (client.data.room.id !== roomId) {
            console.warn(
              "Validation failed: socket attempted to join multiple rooms",
            );
            client.close(4002, "Already joined to a room");
            return;
          }
          client.send(
            jsonCodec.encode({
              type: ServerMessageTypes.JOINED,
              playerId: player.id,
              state: player.state,
            }),
          );
          return;
        }

        clearTimeout(joinTimeout);
        const room = roomManager.getRoom(roomId);
        if (!room) {
          console.warn(`Join rejected: room '${roomId}' does not exist`);
          client.close(4004, "Room not found");
          return;
        }

        try {
          const player = room.addPlayer(client, {
            id: Math.random().toString(36).substring(2, 9),
            name: playerName.trim(),
          });
          client.data = { player, room, networkSimulation, codec };
          client.send(
            jsonCodec.encode({
              type: ServerMessageTypes.JOINED,
              playerId: player.id,
              state: player.state,
              seed: room.match.seed,
            }),
          );
        } catch (error: unknown) {
          console.warn(
            `Join rejected for room '${roomId}':`,
            getErrorMessage(error),
          );
          client.close(4005, "Room is full");
          return;
        }

        console.log(`Player '${playerName}' joined room ${room.id}`);
        return;
      }

      const { player, room } = client.data;
      if (!room || !player) {
        console.warn(`Message '${msg.type}' received before joining a room`);
        client.close(4003, "Not joined to any room");
        return;
      }

      switch (msg.type) {
        case MessageTypes.CHAT:
          room.emit("chat", {
            player,
            text: msg.text.trim(),
            time: Date.now(),
          });
          return;
        case MessageTypes.INPUT:
          networkSimulation.schedule("incoming", () => {
            if (!room.match.enqueueInput(player.id, msg)) {
              console.warn(
                `Dropped stale or queued input ${msg.seq} from player '${player.name}'`,
              );
            }
          });
          return;
        default: {
          const exhaustiveCheck: never = msg;
          throw new TypeError(
            `Unsupported client message: ${String(exhaustiveCheck)}`,
          );
        }
      }
    });

    client.on("close", () => {
      clearTimeout(joinTimeout);
      const { player, room } = client.data;
      if (room && player) {
        room.removePlayer(client);
        console.log(`Player '${player.name}' left room ${room.id}`);
        client.data = { player: null, room: null, networkSimulation, codec };
      }
      networkSimulation.clear();
      clients.delete(client);
    });
  });

  const heartbeatInterval = startHeartbeat(clients, WebSocket.OPEN);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}
