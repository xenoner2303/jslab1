import {
  decodeJsonMessage,
  encodeJsonMessage,
} from '../../shared/codec/json.ts';
import {
  decodeBinaryMessage,
  encodeBinaryMessage,
} from '../../shared/codec/binary.ts';

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
        const data =
          event.data instanceof ArrayBuffer
            ? decodeBinaryMessage(event.data)
            : decodeJsonMessage(event.data);
        this.#bytesIn +=
          typeof event.data === 'string'
            ? new TextEncoder().encode(event.data).byteLength
            : event.data.byteLength;

        if (data.type) {
          this.dispatchEvent(new CustomEvent(data.type, { detail: data }));
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message:', err);
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
    const payload = useBinary
      ? encodeBinaryMessage(data)
      : encodeJsonMessage(data);
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
