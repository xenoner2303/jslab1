import { lobbyRefresh } from '../../shared/config/settings.ts';
import { GameConnection } from './connection.ts';
import { Bus } from './bus.ts';
import { z } from 'zod';
import type { EntitySnapshot, RosterMessage } from '../../shared/protocol.ts';

export type Room = {
  readonly id: string;
  readonly name: string;
  readonly currentPlayers: number;
  readonly maxPlayers: number;
};

export type LobbyJoin = {
  readonly room: Room;
  readonly playerName: string;
  readonly connection: GameConnection;
  readonly playerId: string;
  readonly spawnState: EntitySnapshot;
  readonly roster: RosterMessage['players'];
};

type LobbyEvents = {
  roomsupdated: { readonly rooms: readonly Room[] };
  error: { readonly message: string };
  loadingchange: { readonly isLoading: boolean };
  joined: LobbyJoin;
};

const roomsResponseSchema = z.object({
  rooms: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        currentPlayers: z.number().int().nonnegative(),
        maxPlayers: z.number().int().positive(),
      })
    )
    .nullable()
    .optional(),
});

export class Lobby {
  readonly #events = new Bus<LobbyEvents>();
  #rooms: Room[] = [];
  #refreshInterval: ReturnType<typeof setInterval> | null = null;
  #abortController: AbortController | null = null;

  on<Key extends keyof LobbyEvents>(
    event: Key,
    handler: (payload: LobbyEvents[Key]) => void
  ): () => void {
    return this.#events.on(event, handler);
  }

  get rooms(): readonly Room[] {
    return this.#rooms;
  }

  async refresh(): Promise<void> {
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();

    try {
      const signal = AbortSignal.any([
        this.#abortController.signal,
        AbortSignal.timeout(3000),
      ]);

      const response = await fetch('/api/rooms', { signal });

      if (!response.ok) {
        throw new Error(`HTTP error - ${response.status}`);
      }

      const result = roomsResponseSchema.safeParse(await response.json());
      if (!result.success) throw new Error('Invalid room list response');
      this.#rooms = result.data.rooms ?? [];
      this.#events.emit('roomsupdated', { rooms: this.#rooms });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Room list request was aborted');
      } else {
        const errMessage =
          error instanceof Error ? error.message : String(error);
        console.log('Room downloading error:', error);
        this.#events.emit('error', { message: errMessage });
      }
    } finally {
      this.#events.emit('loadingchange', { isLoading: false });
    }
  }

  startAutoRefresh(intervalMs: number = lobbyRefresh): void {
    this.stopAutoRefresh();

    void this.refresh();

    this.#refreshInterval = setInterval(() => {
      void this.refresh();
    }, intervalMs);
  }

  stopAutoRefresh(): void {
    if (this.#refreshInterval) {
      clearInterval(this.#refreshInterval);
      this.#refreshInterval = null;
    }

    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }

  join(roomId: string, playerName: string): void {
    const selectedRoom = this.#rooms.find((r) => r.id === roomId);

    if (!selectedRoom) {
      throw new Error('The selected room was not found');
    }

    if (selectedRoom.currentPlayers >= selectedRoom.maxPlayers) {
      throw new Error('The room is full');
    }

    if (!playerName || playerName.trim() === '') {
      throw new Error('Please enter player name');
    }

    this.stopAutoRefresh();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const networkParams = new URLSearchParams(window.location.search);
    const wsParams = new URLSearchParams();
    for (const key of ['latencyMs', 'jitterMs', 'dropRate', 'codec']) {
      if (networkParams.has(key)) {
        const val = networkParams.get(key);
        if (val !== null) wsParams.set(key, val);
      }
    }
    const serializedParams = wsParams.toString();
    const networkQuery = serializedParams ? `?${serializedParams}` : '';
    const wsUrl = `${protocol}//${window.location.host}/ws${networkQuery}`;

    const connection = new GameConnection(wsUrl);
    let hasJoined = false;
    let latestRoster: RosterMessage['players'] = [];

    connection.on('open', () => {
      connection.send({
        type: 'join',
        room: selectedRoom.id,
        name: playerName.trim(),
      });
    });

    connection.on('roster', (roster) => {
      latestRoster = roster.players;
    });

    connection.on('joined', (joined) => {
      if (hasJoined) {
        return;
      }
      hasJoined = true;

      this.#events.emit('joined', {
        room: selectedRoom,
        playerName: playerName.trim(),
        connection,
        playerId: joined.playerId,
        spawnState: joined.state,
        roster: latestRoster,
      });
    });

    connection.on('close', (event) => {
      if (hasJoined) return;

      const code = event.code;
      const messages: Record<number, string> = {
        4001: 'Час очікування входу вичерпано',
        4004: 'Кімнату не знайдено',
        4005: 'У кімнаті більше немає місць',
      };
      if (messages[code]) {
        connection.close();
        const message = messages[code];
        if (message) this.#events.emit('error', { message });
      }
    });

    connection.on('error', () => {
      this.#events.emit('error', {
        message: 'Не вдалося підключитися до ігрового сервера',
      });
    });

    connection.on('maxreconnect', () => {
      this.#events.emit('error', {
        message: 'Не вдалося відновити з’єднання з сервером',
      });
    });

    connection.connect();
  }
}
