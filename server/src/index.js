import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, "../../client/dist");

const rooms = new Map();

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function parseJsonBody(req, limitBytes = 1024) { // limitbytes for ddos protection
  let body = "";
  let receivedBytes = 0;

  for await (const chunk of req) {
    receivedBytes += chunk.length;
    if (receivedBytes > limitBytes) {
      throw new Error("Payload Too Large");
    }
    body += chunk;
  }

  if (!body) return {};
  return JSON.parse(body);
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
      const roomList = Array.from(rooms.values()).map(r => ({
        id: r.id,
        name: r.name,
        playersCount: r.players.size,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(roomList));
      return;
    }

    if (req.method === "POST" && pathname === "/api/rooms") { // create room
      try {
        const data = await parseJsonBody(req, 1024);
        const roomName = data.name ? String(data.name).trim() : "Unnamed Room";
        
        const roomId = Math.random().toString(36).substring(2, 9)
        const newRoom = {
          id: roomId,
          name: roomName,
          players: new Set(),
        };

        rooms.set(roomId, newRoom);

        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, roomId }));
      } catch (err) {
        const status = err.message === "Payload Too Large" ? 413 : 400;
        res.writeHead(status, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    let safePath = path.normalize(path.join(PUBLIC_DIR, pathname)); // protection for path traversal
    if (!safePath.startsWith(PUBLIC_DIR)) {
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
    } catch {
      try { // if we cannot file, we can try to serve index.html
        const indexData = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
        res.end(indexData);
      } catch {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
      }
    }

  } catch (err) {
    console.error("Server error:", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
});

server.listen(config.port, config.host, () => {
  console.log(`Server running at http://${config.host}:${config.port}`);
});

function shutdown(signal) { // gracefull
  console.log(`\nReceived ${signal}`);
  
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
