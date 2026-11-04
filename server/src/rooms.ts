import { EventEmitter } from "node:events";
import type { WebSocket } from "ws";
import { MatchLog } from "./log/matchlog.ts";
import { config } from "./config.ts";
import { Match } from "./match.ts";
import { getCodec } from "../../shared/codec/index.ts";
import type { EntitySnapshot, ServerMessage } from "../../shared/protocol.ts";

export type Player = {
  readonly id: string;
  readonly name: string;
  state: EntitySnapshot;
};

export type RoomSocket = WebSocket & {
  data?: {
    readonly codec?: "json" | "binary";
    readonly networkSimulation?: {
      schedule(
        direction: "incoming" | "outgoing",
        callback: () => void,
      ): boolean;
    };
  };
};

type RoomEvents = {
  chat: [
    event: {
      readonly player: Player;
      readonly text: string;
      readonly time: number;
    },
  ];
  event: [event: RoomLogEvent];
  join: [event: { readonly socket: RoomSocket; readonly player: Player }];
  leave: [event: { readonly socket: RoomSocket; readonly player: Player }];
  empty: [room: Room];
  close: [];
};

export type RoomLogEvent = Readonly<Record<string, unknown>> & {
  readonly t: number;
  readonly type: string;
};

export class Room extends EventEmitter<RoomEvents> {
  readonly id: string;
  readonly name: string;
  readonly maxPlayers: number;
  readonly players = new Map<RoomSocket, Player>();
  readonly match: Match;
  readonly matchLog: MatchLog;

  constructor(id: string, name: string, maxPlayers: number, logDir: string) {
    super();
    if (
      !Number.isInteger(maxPlayers) ||
      maxPlayers < 1 ||
      maxPlayers > config.limits.maxPlayersPerRoom
    ) {
      throw new RangeError(
        `maxPlayers must be an integer between 1 and ${config.limits.maxPlayersPerRoom}`,
      );
    }

    this.id = id;
    this.name = name;
    this.maxPlayers = maxPlayers;
    this.match = new Match(this);
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

  #recordEvent(
    type: string,
    details: Readonly<Record<string, unknown>> = {},
  ): void {
    this.emit("event", { t: Date.now(), type, ...details });
  }

  addPlayer(
    socket: RoomSocket,
    player: Pick<Player, "id" | "name"> & Partial<Pick<Player, "state">>,
  ): Player {
    if (this.match.players.size >= this.maxPlayers) {
      throw new Error("Room is full");
    }

    const state: EntitySnapshot = this.match.addPlayer(player);
    const activePlayer: Player = Object.assign(player, { state });
    this.players.set(socket, activePlayer);
    this.emit("join", { socket, player: activePlayer });
    this.#recordEvent("join", {
      player: { id: activePlayer.id, name: activePlayer.name },
      state: activePlayer.state,
    });
    this.broadcastRoster();
    return activePlayer;
  }

  removePlayer(socket: RoomSocket): void {
    const player = this.players.get(socket);
    if (player) {
      this.players.delete(socket);
      this.match.removePlayer(player.id);
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

  close(): void {
    this.match.stop();
    this.emit("close");
  }

  broadcast(
    data: ServerMessage,
    excludeSocket: RoomSocket | null = null,
  ): void {
    for (const [socket] of this.players) {
      if (socket === excludeSocket || socket.readyState !== 1) {
        continue;
      }

      if (
        data.type === "snapshot" &&
        socket.bufferedAmount > config.limits.maxBufferedBytes
      ) {
        continue;
      }

      const payload =
        data.type === "snapshot" && socket.data?.codec === "binary"
          ? getCodec("binary").encode(data)
          : getCodec("json").encode(data);
      const send = () => {
        if (socket.readyState === 1) socket.send(payload);
      };
      if (socket.data?.networkSimulation) {
        socket.data.networkSimulation.schedule("outgoing", send);
      } else {
        send();
      }
    }
  }

  broadcastRoster(): void {
    const roster = Array.from(this.match.players.values()).map(
      ({ player }) => ({
        id: player.id,
        name: player.name,
        state: player.state as EntitySnapshot,
      }),
    );
    this.broadcast({ type: "roster", players: roster });
  }
}

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  readonly logDir: string;
  readonly matchLogs = new Set<MatchLog>();

  constructor(logDir: string) {
    this.logDir = logDir;
  }

  createRoom(name: string, maxPlayers = 4): Room {
    if (this.rooms.size >= config.limits.maxRooms) {
      throw Object.assign(new Error("Server room limit reached"), {
        statusCode: 503,
      });
    }

    const id = Math.random().toString(36).substring(2, 9);
    const room = new Room(id, name || `Room ${id}`, maxPlayers, this.logDir);
    this.matchLogs.add(room.matchLog);
    room.matchLog.flush().then(
      () => this.matchLogs.delete(room.matchLog),
      () => this.matchLogs.delete(room.matchLog),
    );

    room.on("empty", (emptyRoom) => {
      this.rooms.delete(emptyRoom.id);
      console.log(`Room ${emptyRoom.id} deleted because it became empty`);
      emptyRoom.close();
    });

    this.rooms.set(id, room);
    return room;
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  listRooms(): {
    id: string;
    name: string;
    playersCount: number;
  }[] {
    return Array.from(this.rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      playersCount: room.match.players.size,
    }));
  }

  getStats(): {
    rooms: ({ roomId: string } & ReturnType<Match["getStats"]>)[];
  } {
    return {
      rooms: [...this.rooms.values()].map((room) => ({
        roomId: room.id,
        ...room.match.getStats(),
      })),
    };
  }

  async flushLogs(): Promise<void> {
    for (const room of this.rooms.values()) {
      room.close();
    }
    await Promise.all([...this.matchLogs].map((matchLog) => matchLog.flush()));
  }
}
