import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { performance } from "node:perf_hooks";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { arenaHeight, arenaWidth } from "../../shared/config/settings.ts";
import { config } from "./config.ts";
import { RoomManager } from "./rooms.ts";
import { setupWebSocket } from "./ws.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../../client/dist");

await fs.mkdir(config.logDir, { recursive: true });
const roomManager = new RoomManager(config.logDir);
const eventLoopBaseline = performance.eventLoopUtilization();

const MIME_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".webp": "image/webp",
};

const addBotsSchema = z.object({ count: z.number().int().min(1).max(8) });

const createRoomSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  maxPlayers: z.number().int().min(1).max(8).optional(),
});

class HttpError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}

function hasErrorCode(error: unknown, ...codes: string[]): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    codes.includes(error.code)
  );
}

function getStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
  ) {
    return error.statusCode;
  }
  return undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sendJson(
  res: ServerResponse<IncomingMessage>,
  statusCode: number,
  data: unknown,
): void {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function parseJsonBody(
  req: IncomingMessage,
  limitBytes = 1024,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;
    if (receivedBytes > limitBytes) {
      throw new HttpError("Payload Too Large", 413);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error: unknown) {
    throw new HttpError(`Invalid JSON body: ${getErrorMessage(error)}`, 400);
  }
}

function getRequestUrl(req: IncomingMessage): URL {
  const host = req.headers.host ?? `${config.host}:${config.port}`;
  return new URL(req.url ?? "/", `http://${host}`);
}

const server = http.createServer(
  async (
    req: IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ): Promise<void> => {
    try {
      const { pathname } = getRequestUrl(req);

      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, 200, { status: "ok", uptime: process.uptime() });
        return;
      }

      if (req.method === "GET" && pathname === "/api/stats") {
        sendJson(res, 200, {
          ...roomManager.getStats(),
          rssBytes: process.memoryUsage().rss,
          eventLoopUtilization:
            performance.eventLoopUtilization(eventLoopBaseline).utilization,
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/slow") {
        const start = process.hrtime.bigint();
        const delayNanoseconds = 3_000_000_000n;
        while (process.hrtime.bigint() - start < delayNanoseconds) {
          // blocks the event loop for its duration
        }

        sendJson(res, 200, { blockedForMs: 3000 });
        return;
      }

      if (req.method === "GET" && pathname === "/api/rooms") {
        const roomList = Array.from(roomManager.rooms.values()).map((room) => ({
          id: room.id,
          name: room.name,
          maxPlayers: room.maxPlayers,
          currentPlayers: room.match.players.size,
          arenaConfig: { width: arenaWidth, height: arenaHeight },
        }));
        sendJson(res, 200, { rooms: roomList });
        return;
      }

      const replayMatch = pathname.match(/^\/api\/replays\/([^/]+)$/);
      if (req.method === "GET" && replayMatch) {
        const encodedReplayId = replayMatch[1];
        if (encodedReplayId === undefined) {
          sendJson(res, 400, { error: "Invalid replay ID" });
          return;
        }

        let replayId: string;
        try {
          replayId = decodeURIComponent(encodedReplayId);
        } catch {
          sendJson(res, 400, { error: "Invalid replay ID" });
          return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(replayId)) {
          sendJson(res, 400, { error: "Invalid replay ID" });
          return;
        }

        const replayPath = path.resolve(config.logDir, `${replayId}.ndjson`);
        const relativeReplayPath = path.relative(config.logDir, replayPath);
        if (
          relativeReplayPath === ".." ||
          relativeReplayPath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeReplayPath)
        ) {
          sendJson(res, 400, { error: "Invalid replay ID" });
          return;
        }

        try {
          const replayStats = await fs.stat(replayPath);
          if (!replayStats.isFile()) {
            sendJson(res, 404, { error: "Replay not found" });
            return;
          }
        } catch (error: unknown) {
          if (hasErrorCode(error, "ENOENT", "ENOTDIR")) {
            sendJson(res, 404, { error: "Replay not found" });
            return;
          }
          throw error;
        }

        res.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=UTF-8",
          "Content-Disposition": `attachment; filename="${replayId}.ndjson"`,
        });
        await pipeline(createReadStream(replayPath), res);
        return;
      }

      const botsMatch = pathname.match(/^\/api\/rooms\/([^/]+)\/bots$/);
      if (req.method === "POST" && botsMatch) {
        const roomId = botsMatch[1];
        if (!roomId) throw new HttpError("Invalid room ID", 400);
        const room = roomManager.getRoom(roomId);
        if (!room) throw new HttpError("Room not found", 404);
        if (
          req.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !==
          "application/json"
        ) {
          throw new HttpError("Content-Type must be application/json", 415);
        }
        const body = await parseJsonBody(req);
        const parsed = addBotsSchema.safeParse(body);
        if (!parsed.success) {
          throw new HttpError(
            parsed.error.issues[0]?.message ?? "Invalid bot request",
            400,
          );
        }
        const availableSlots = Math.max(
          0,
          room.maxPlayers - room.match.players.size,
        );
        if (parsed.data.count > availableSlots) {
          throw new HttpError(
            `Only ${availableSlots} player slots are available`,
            409,
          );
        }
        const bots = Array.from({ length: parsed.data.count }, () =>
          room.match.addBot(),
        );
        sendJson(res, 201, { success: true, bots });
        return;
      }

      if (req.method === "POST" && pathname === "/api/rooms") {
        const contentType = req.headers["content-type"]
          ?.split(";")[0]
          ?.trim()
          .toLowerCase();
        if (contentType !== "application/json") {
          sendJson(res, 415, {
            error: "Content-Type must be application/json",
          });
          return;
        }

        const body = await parseJsonBody(req);
        const result = createRoomSchema.safeParse(body);
        if (!result.success) {
          throw new HttpError(
            result.error.issues[0]?.message ?? "Invalid room request",
            400,
          );
        }

        const roomName = result.data.name ?? "Unnamed Room";
        const maxPlayers = result.data.maxPlayers ?? 4;
        const newRoom = roomManager.createRoom(roomName, maxPlayers);
        sendJson(res, 201, { success: true, roomId: newRoom.id });
        return;
      }

      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Bad Request");
        return;
      }

      let safePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
      const relativePath = path.relative(PUBLIC_DIR, safePath);
      if (
        relativePath === ".." ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
      ) {
        res.writeHead(403, { "Content-Type": "text/plain" });
        res.end("Forbidden");
        return;
      }

      if (pathname === "/") {
        safePath = path.join(PUBLIC_DIR, "index.html");
      }

      try {
        const stats = await fs.stat(safePath);
        if (stats.isDirectory()) {
          safePath = path.join(safePath, "index.html");
        }

        const data = await fs.readFile(safePath);
        const ext = path.extname(safePath).toLowerCase();
        const contentType = MIME_TYPES[ext] ?? "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      } catch (error: unknown) {
        if (hasErrorCode(error, "ENOENT", "ENOTDIR")) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("Not Found");
          return;
        }
        throw error;
      }
    } catch (error: unknown) {
      if (res.destroyed || hasErrorCode(error, "ERR_STREAM_PREMATURE_CLOSE")) {
        return;
      }
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, { error: error.message });
        return;
      }
      const statusCode = getStatusCode(error);
      if (statusCode !== undefined) {
        sendJson(res, statusCode, { error: getErrorMessage(error) });
        return;
      }

      console.error("Server error:", error);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "Internal Server Error" });
      } else {
        res.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    }
  },
);

const webSocketServer = setupWebSocket(server, roomManager);

roomManager.createRoom("room1");
roomManager.createRoom("room2", 8);

server.listen(config.port, config.host, () => {
  console.log(`Server running at http://${config.host}:${config.port}`);
});

const rssMetricsInterval = setInterval(() => {
  const rssMemoryMB = process.memoryUsage().rss / 1024 / 1024;
  console.log(`Server RSS Memory: ${rssMemoryMB.toFixed(2)} MB`);
}, 1000);

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;
  clearInterval(rssMetricsInterval);
  console.log(`\nReceived ${signal}`);

  const forceCloseTimer = setTimeout(() => {
    console.error("Shutdown timed out; terminating remaining connections");
    for (const socket of webSocketServer.clients) {
      socket.terminate();
    }
    server.closeAllConnections();
  }, 10000);
  forceCloseTimer.unref();

  const httpClosed = new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  const webSocketsClosed = new Promise<void>((resolve) => {
    webSocketServer.close(() => resolve());
    for (const socket of webSocketServer.clients) {
      socket.close(1001, "Server shutting down");
    }
  });

  try {
    await Promise.all([httpClosed, webSocketsClosed]);
    await roomManager.flushLogs();
    console.log("HTTP and WebSocket servers closed.");
    await Promise.all([
      new Promise<void>((resolve) =>
        process.stdout.write("", "utf8", () => resolve()),
      ),
      new Promise<void>((resolve) =>
        process.stderr.write("", "utf8", () => resolve()),
      ),
    ]);
    clearTimeout(forceCloseTimer);
    process.exit(0);
  } catch (error: unknown) {
    console.error("Graceful shutdown failed:", error);
    clearTimeout(forceCloseTimer);
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
