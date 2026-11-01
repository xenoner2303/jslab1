import { EventEmitter } from "node:events";

export class Room extends EventEmitter {
  constructor(id, name, maxPlayers) {
    super();
    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.players = new Map();
  }

  addPlayer(socket, player) {
    if (this.players.size >= this.maxPlayers) {
      throw new Error("Room is full");
    }
    
    this.players.set(socket, player);
    this.emit("join", { socket, player });
    this.broadcastRoster();
  }

  removePlayer(socket) {
    const player = this.players.get(socket);
    if (player) {
      this.players.delete(socket);
      this.emit("leave", { socket, player });
      this.broadcastRoster();

      if (this.players.size === 0) {
        this.emit("empty", this);
      }
    }
  }

  broadcast(data, excludeSocket = null) {
    const payload = JSON.stringify(data);
    for (const [socket] of this.players) {
      if (socket !== excludeSocket && socket.readyState === 1) { // WebSocket.OPEN === 1
        socket.send(payload);
      }
    }
  }

  broadcastRoster() {
    const roster = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      name: p.name,
    }));
    this.broadcast({ type: "roster", players: roster });
  }
}

export class RoomManager { // to control Room List
  constructor() {
    this.rooms = new Map();
  }

  createRoom(name, maxPlayers = 4) {
    const id = Math.random().toString(36).substring(2, 9);
    const room = new Room(id, name || `Room ${id}`, maxPlayers);

    room.on("empty", (r) => {
      this.rooms.delete(r.id);
      console.log(`Room ${r.id} deleted because it became empty`);
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
}
