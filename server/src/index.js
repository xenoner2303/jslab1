import http from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { RoomManager } from "./rooms.js";
import { setupWebSocket } from "./ws.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../../client/dist");

await fs.mkdir(config.logDir, { recursive: true });
const roomManager = new RoomManager(config.logDir);

const MIME_TYPES = {
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

async function parseJsonBody(req, limitBytes = 1024) {
  const chunks = [];
  let receivedBytes = 0;
  let isTooLarge = false;

  for await (const chunk of req) {
    receivedBytes += chunk.length;
    if (receivedBytes > limitBytes) {
      isTooLarge = true;
    } else if (!isTooLarge) {
      chunks.push(chunk);
    }
  }

  if (isTooLarge) {
    const error = new Error("Payload Too Large");
    error.statusCode = 413;
    throw error;
  }

  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
      return;
    }

    if (req.method === "GET" && pathname === "/api/rooms") {
        const roomList = Array.from(roomManager.rooms.values()).map((r) => ({
            id: r.id,
            name: r.name,
            maxPlayers: r.maxPlayers,
            currentPlayers: r.players.size,
            arenaConfig: { width: 1200, height: 800 }
        }));
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ rooms: roomList }));
        return;
    }

    const replayMatch = pathname.match(/^\/api\/replays\/([^/]+)$/);
    if (req.method === "GET" && replayMatch) {
        let replayId;
        try {
          replayId = decodeURIComponent(replayMatch[1]);
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid replay ID" }));
          return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(replayId)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid replay ID" }));
          return;
        }

        const replayPath = path.resolve(config.logDir, `${replayId}.ndjson`);
        const relativeReplayPath = path.relative(config.logDir, replayPath);
        if (
          relativeReplayPath === ".." ||
          relativeReplayPath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relativeReplayPath)
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid replay ID" }));
          return;
        }

        try {
          const replayStats = await fs.stat(replayPath);
          if (!replayStats.isFile()) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Replay not found" }));
            return;
          }
        } catch (error) {
          if (error.code === "ENOENT" || error.code === "ENOTDIR") {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Replay not found" }));
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

    if (req.method === "POST" && pathname === "/api/rooms") { // create room
      try {
        const contentType = req.headers["content-type"]
          ?.split(";")[0]
          .trim()
          .toLowerCase();
        if (contentType !== "application/json") {
          res.writeHead(415, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Content-Type must be application/json" }));
          return;
        }

        const data = await parseJsonBody(req, 1024);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          throw new Error("Request body must be a JSON object");
        }

        let roomName = "Unnamed Room";
        if (data.name !== undefined) {
          if (typeof data.name !== "string") {
            throw new Error("Room name must be a string");
          }
          roomName = data.name.trim();
          if (roomName.length === 0 || roomName.length > 50) {
            throw new Error("Room name must be between 1 and 50 characters");
          }
        }

        const maxPlayers =
          data.maxPlayers === undefined ? 4 : data.maxPlayers;
        if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 8) {
          throw new Error("maxPlayers must be an integer between 1 and 8");
        }

        const newRoom = roomManager.createRoom(roomName, maxPlayers);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, roomId: newRoom.id }));
      } catch (err) {
        res.writeHead(err.statusCode || 400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    let decodedPath;
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
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    } catch (err) {
      if (err.code === "ENOENT" || err.code === "ENOTDIR") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
        return;
      }
      throw err;
    }

  } catch (err) {
    if (res.destroyed || err.code === "ERR_STREAM_PREMATURE_CLOSE") {
      return;
    }
    console.error("Server error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    } else {
      res.destroy(err);
    }
  }
});

const webSocketServer = setupWebSocket(server, roomManager);

roomManager.createRoom("room1"); // start rooms
roomManager.createRoom("room2", 8);

server.listen(config.port, config.host, () => {
  console.log(`Server running at http://${config.host}:${config.port}`);
});

const rssMetricsInterval = setInterval(() => {
  const rssMemoryMB = process.memoryUsage().rss / 1024 / 1024;
  console.log(`Server RSS Memory: ${rssMemoryMB.toFixed(2)} MB`);
}, 1000);

let isShuttingDown = false;

async function shutdown(signal) {
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

  const httpClosed = new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  const webSocketsClosed = new Promise((resolve) => {
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
      new Promise((resolve) => process.stdout.write("", resolve)),
      new Promise((resolve) => process.stderr.write("", resolve)),
    ]);
    clearTimeout(forceCloseTimer);
    process.exit(0);
  } catch (error) {
    console.error("Graceful shutdown failed:", error);
    clearTimeout(forceCloseTimer);
    process.exit(1);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
