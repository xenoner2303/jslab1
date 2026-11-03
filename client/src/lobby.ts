import { lobbyRefresh } from '../../shared/config/settings.ts';
import { GameConnection } from './connection.js';

export type Room = {
  readonly id: string;
  readonly name: string;
  readonly currentPlayers: number;
  readonly maxPlayers: number;
};

export class Lobby extends EventTarget {
  #rooms: Room[] = [];
  #refreshInterval: ReturnType<typeof setInterval> | null = null;
  #abortController: AbortController | null = null;

  constructor() {
    super();
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

      const data = (await response.json()) as { rooms?: Room[] };

      if (data.rooms == null) {
        this.#rooms = [];
      } else {
        this.#rooms = data.rooms;
      }

      this.dispatchEvent(
        new CustomEvent('roomsupdated', {
          detail: { rooms: this.#rooms },
        })
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Room list request was aborted');
      } else {
        const errMessage = error instanceof Error ? error.message : String(error);
        console.log('Room downloading error:', error);
        this.dispatchEvent(
          new CustomEvent('error', { detail: { message: errMessage } })
        );
      }
    } finally {
      this.dispatchEvent(
        new CustomEvent('loadingchange', { detail: { isLoading: false } })
      );
    }
  }

  startAutoRefresh(intervalMs: number = lobbyRefresh): void {
    this.stopAutoRefresh();

    this.refresh();

    this.#refreshInterval = setInterval(() => {
      this.refresh();
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
    let latestRoster: unknown[] = [];

    connection.addEventListener('open', () => {
      connection.send({
        type: 'join',
        room: selectedRoom.id,
        name: playerName.trim(),
      });
    });

    connection.addEventListener('roster', (event: Event) => {
      const customEvent = event as CustomEvent<{ players: unknown[] }>;
      latestRoster = customEvent.detail.players;
    });

    connection.addEventListener('joined', (event: Event) => {
      if (hasJoined) {
        return;
      }
      hasJoined = true;

      const customEvent = event as CustomEvent<{ playerId: string; state: unknown }>;

      this.dispatchEvent(
        new CustomEvent('joined', {
          detail: {
            room: selectedRoom,
            playerName: playerName.trim(),
            connection,
            playerId: customEvent.detail.playerId,
            spawnState: customEvent.detail.state,
            roster: latestRoster,
          },
        })
      );
    });

    connection.addEventListener('close', (event: Event) => {
      if (hasJoined) return;

      const customEvent = event as CustomEvent<{ code: number }>;
      const code = customEvent.detail.code;
      const messages: Record<number, string> = {
        4001: 'Час очікування входу вичерпано',
        4004: 'Кімнату не знайдено',
        4005: 'У кімнаті більше немає місць',
      };
      if (messages[code]) {
        connection.close();
        this.dispatchEvent(
          new CustomEvent('error', { detail: { message: messages[code] } })
        );
      }
    });

    connection.addEventListener('error', () => {
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: { message: 'Не вдалося підключитися до ігрового сервера' },
        })
      );
    });

    connection.addEventListener('maxreconnect', () => {
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: { message: 'Не вдалося відновити з’єднання з сервером' },
        })
      );
    });

    connection.connect();
  }
}
