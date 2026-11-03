import { getCodec } from '../../shared/codec/index.ts';
import { parseServerMessage } from '../../shared/protocol.ts';

export class GameConnection extends EventTarget {
  #url;
  #codec;
  #socket = null;
  #sendQueue = [];
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectTimeout = null;
  #isIntentionalClose = false;
  #bytesIn = 0;
  #bytesOut = 0;

  constructor(url) {
    super();
    this.#url = url;
    this.#codec = new URL(url).searchParams.get('codec') === 'binary'
      ? 'binary'
      : 'json';
  }

  get bytesIn() {
    return this.#bytesIn;
  }

  get bytesOut() {
    return this.#bytesOut;
  }

  connect() {
    this.#isIntentionalClose = false;
    const socket = new WebSocket(this.#url);
    socket.binaryType = 'arraybuffer';
    this.#socket = socket;

    socket.addEventListener('open', () => {
      console.log('WebSocket connected yoooou');
      this.#reconnectAttempts = 0;
      this.dispatchEvent(new CustomEvent('open'));

      while (this.#sendQueue.length > 0) {
        const payload = this.#sendQueue.shift();
        this.#sendPayload(socket, payload);
      }
    });

    socket.addEventListener('message', (event) => {
      try {
        const raw =
          event.data instanceof ArrayBuffer
            ? getCodec('binary').decode(event.data)
            : getCodec('json').decode(event.data);
        this.#bytesIn +=
          typeof event.data === 'string'
            ? new TextEncoder().encode(event.data).byteLength
            : event.data.byteLength;

        const result = parseServerMessage(raw);
        if (!result.success) {
          console.warn('Invalid server message:', result.error);
          socket.close(4002, 'Invalid server message');
          return;
        }
        this.dispatchEvent(
          new CustomEvent(result.data.type, { detail: result.data }),
        );
      } catch (error) {
        console.error('Failed to parse incoming WebSocket message:', error);
        socket.close(4002, 'Invalid server message');
      }
    });

    socket.addEventListener('close', (event) => {
      console.log(`WebSocket closed (code: ${event.code})`);
      this.dispatchEvent(new CustomEvent('close', { detail: event }));

      if (!this.#isIntentionalClose) {
        this.#handleReconnect();
      }
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    });
  }

  send(data, { queueIfDisconnected = true } = {}) {
    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
      this.#sendPayload(this.#socket, data);
      return true;
    } else if (queueIfDisconnected && !this.#isIntentionalClose) {
      this.#sendQueue.push(data);
      return true;
    }
    return false;
  }

  #sendPayload(socket, data) {
    const useBinary =
      this.#codec === 'binary' && data.type === 'input';
    const payload = getCodec(useBinary ? 'binary' : 'json').encode(data);
    this.#bytesOut +=
      typeof payload === 'string'
        ? new TextEncoder().encode(payload).byteLength
        : payload.byteLength;
    socket.send(payload);
  }

  close() {
    this.#isIntentionalClose = true;
    this.#sendQueue = [];
    if (this.#reconnectTimeout) {
      clearTimeout(this.#reconnectTimeout);
    }
    if (this.#socket) {
      this.#socket.close();
    }
  }

  #handleReconnect() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      console.warn('Max reconnection attempts reached.');
      this.dispatchEvent(new CustomEvent('maxreconnect'));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), 10000);
    this.#reconnectAttempts++;
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.#reconnectAttempts})...`);

    this.#reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }
}
