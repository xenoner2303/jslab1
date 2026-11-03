import { getCodec } from '../../shared/codec/index.ts';
import {
  parseServerMessage,
  type ClientMessage,
  type JoinedMessage,
  type RosterMessage,
  type ServerChatMessage,
  type SnapshotMessage,
} from '../../shared/protocol.ts';
import { Bus } from './bus.ts';

export type GameEvents = {
  open: undefined;
  close: CloseEvent;
  error: Event;
  maxreconnect: undefined;
  joined: JoinedMessage;
  roster: RosterMessage;
  chat: ServerChatMessage;
  snapshot: SnapshotMessage;
};

export class GameConnection {
  readonly #url: string;
  readonly #codec: 'json' | 'binary';
  readonly #events = new Bus<GameEvents>();
  #socket: WebSocket | null = null;
  #sendQueue: ClientMessage[] = [];
  #reconnectAttempts = 0;
  readonly #maxReconnectAttempts = 5;
  #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  #isIntentionalClose = false;
  #bytesIn = 0;
  #bytesOut = 0;

  constructor(url: string) {
    this.#url = url;
    this.#codec =
      new URL(url).searchParams.get('codec') === 'binary' ? 'binary' : 'json';
  }

  get bytesIn(): number {
    return this.#bytesIn;
  }

  get bytesOut(): number {
    return this.#bytesOut;
  }

  on<Key extends keyof GameEvents>(
    event: Key,
    handler: (payload: GameEvents[Key]) => void
  ): () => void {
    return this.#events.on(event, handler);
  }

  connect(): void {
    this.#isIntentionalClose = false;
    const socket = new WebSocket(this.#url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => {
      console.log('WebSocket connected');
      this.#reconnectAttempts = 0;
      this.#events.emit('open', undefined);

      while (this.#sendQueue.length > 0) {
        const payload = this.#sendQueue.shift();
        if (payload) this.#sendPayload(socket, payload);
      }
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      void this.#handleMessage(socket, event.data);
    });

    socket.addEventListener('close', (event) => {
      console.log(`WebSocket closed (code: ${event.code})`);
      this.#events.emit('close', event);

      if (!this.#isIntentionalClose) this.#handleReconnect();
    });

    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
      this.#events.emit('error', event);
    });
  }

  async #handleMessage(
    socket: WebSocket,
    data: string | ArrayBuffer | Blob
  ): Promise<void> {
    try {
      const raw =
        data instanceof ArrayBuffer
          ? getCodec('binary').decode(data)
          : data instanceof Blob
            ? getCodec('binary').decode(await data.arrayBuffer())
            : getCodec('json').decode(data);
      this.#bytesIn +=
        typeof data === 'string'
          ? new TextEncoder().encode(data).byteLength
          : data instanceof Blob
            ? data.size
            : data.byteLength;

      const result = parseServerMessage(raw);
      if (!result.success) {
        console.warn('Invalid server message:', result.error);
        socket.close(4002, 'Invalid server message');
        return;
      }
      this.#events.emit(result.data.type, result.data);
    } catch (error: unknown) {
      console.error('Failed to parse incoming WebSocket message:', error);
      socket.close(4002, 'Invalid server message');
    }
  }

  send(
    data: ClientMessage,
    { queueIfDisconnected = true }: { queueIfDisconnected?: boolean } = {}
  ): boolean {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#sendPayload(this.#socket, data);
      return true;
    }
    if (queueIfDisconnected && !this.#isIntentionalClose) {
      this.#sendQueue.push(data);
      return true;
    }
    return false;
  }

  #sendPayload(socket: WebSocket, data: ClientMessage): void {
    const useBinary = this.#codec === 'binary' && data.type === 'input';
    const payload = getCodec(useBinary ? 'binary' : 'json').encode(data);
    this.#bytesOut +=
      typeof payload === 'string'
        ? new TextEncoder().encode(payload).byteLength
        : payload.byteLength;
    socket.send(payload);
  }

  close(): void {
    this.#isIntentionalClose = true;
    this.#sendQueue = [];
    if (this.#reconnectTimeout) {
      clearTimeout(this.#reconnectTimeout);
      this.#reconnectTimeout = null;
    }
    this.#socket?.close();
  }

  #handleReconnect(): void {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached.');
      this.#events.emit('maxreconnect', undefined);
      return;
    }

    const delay = Math.min(1000 * 2 ** this.#reconnectAttempts, 10000);
    this.#reconnectAttempts++;
    console.log(
      `Reconnecting in ${delay}ms (attempt ${this.#reconnectAttempts})...`
    );

    this.#reconnectTimeout = setTimeout(() => {
      this.#reconnectTimeout = null;
      this.connect();
    }, delay);
  }
}
