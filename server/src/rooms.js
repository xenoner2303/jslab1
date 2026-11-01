import { EventEmitter } from "node:events";
import { MatchLog } from "./log/matchlog.js";
import { config } from "./config.js";

export class Room extends EventEmitter {
  constructor(id, name, maxPlayers, logDir) {
    super();
    if (
      !Number.isInteger(maxPlayers) ||
      maxPlayers < 1 ||
      maxPlayers > config.limits.maxPlayersPerRoom
    ) {
      throw new RangeError(
        `maxPlayers must be an integer between 1 and ${config.limits.maxPlayersPerRoom}`
      );
    }

    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
    this.matchLog = new MatchLog(this, logDir);
    this.#recordEvent("created", { name, maxPlayers });
    this.on("chat", ({ player, text, time }) => {
      this.#recordEvent("chat", {
        player: { id: player.id, name: player.name },
        text,
        time,
      });
      this.broadcast({
        type: "chat",
        sender: player.name,
        text,
        time,
      });
    });
  }

  #recordEvent(type, details = {}) {
    this.emit("event", { t: Date.now(), type, ...details });
  }

  addPlayer(socket, player) {
    if (this.players.size >= this.maxPlayers) {
      throw new Error("Room is full");
    }

    const spawnAngle = (2 * Math.PI * this.players.size) / this.maxPlayers;
    player.state = {
      x: 600 + Math.cos(spawnAngle) * 220,
      y: 400 + Math.sin(spawnAngle) * 160,
      angle: spawnAngle + Math.PI / 2,
      thrust: 0,
      alive: true,
    };
    this.players.set(socket, player);
    this.emit("join", { socket, player });
    this.#recordEvent("join", {
      player: { id: player.id, name: player.name },
      state: player.state,
    });
    this.broadcastRoster();
  }

  removePlayer(socket) {
    const player = this.players.get(socket);
    if (player) {
      this.players.delete(socket);
      this.emit("leave", { socket, player });
      this.#recordEvent("leave", {
        player: { id: player.id, name: player.name },
      });
      this.broadcastRoster();

      if (this.players.size === 0) {
        this.#recordEvent("empty");
        this.emit("empty", this);
      }
    }
  }

  close() {
    this.emit("close");
  }

  broadcast(data, excludeSocket = null) {
    const payload = JSON.stringify(data);
    for (const [socket] of this.players) {
      if (socket === excludeSocket || socket.readyState !== 1) {
        continue;
      }

      if (
        data.type === "state" &&
        socket.bufferedAmount > config.limits.maxBufferedBytes
      ) {
        continue;
      }

      socket.send(payload);
    }
  }

  broadcastRoster() {
    const roster = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
      state: p.state,
    }));
    this.broadcast({ type: "roster", players: roster });
  }
}

export class RoomManager { // to control Room List
  constructor(logDir) {
    this.rooms = new Map();
    this.logDir = logDir;
    this.matchLogs = new Set();
  }

  createRoom(name, maxPlayers = 4) {
    if (this.rooms.size >= config.limits.maxRooms) {
      const error = new Error("Server room limit reached");
      error.statusCode = 503;
      throw error;
    }

    const id = Math.random().toString(36).substring(2, 9);
    const room = new Room(id, name || `Room ${id}`, maxPlayers, this.logDir);
    this.matchLogs.add(room.matchLog);
    room.matchLog.flush().then(
      () => this.matchLogs.delete(room.matchLog),
      () => this.matchLogs.delete(room.matchLog)
    );

    room.on("empty", (r) => {
      this.rooms.delete(r.id);
      console.log(`Room ${r.id} deleted because it became empty`);
      r.close();
    });

    this.rooms.set(id, room);
    return room;
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  listRooms() {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      name: r.name,
      playersCount: r.players.size,
    }));
  }

  async flushLogs() {
    for (const room of this.rooms.values()) {
      room.close();
    }
    await Promise.all([...this.matchLogs].map((matchLog) => matchLog.flush()));
  }
}
