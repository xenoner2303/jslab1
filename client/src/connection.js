export class GameConnection extends EventTarget {
  #url;
  #socket = null;
  #sendQueue = [];
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectTimeout = null;
  #isIntentionalClose = false;

  constructor(url) {
    super();
    this.#url = url;
  }

  connect() {
    this.#isIntentionalClose = false;
    this.#socket = new WebSocket(this.#url);

    this.#socket.addEventListener('open', () => {
      console.log('WebSocket connected yoooou');
      this.#reconnectAttempts = 0;

      while (this.#sendQueue.length > 0) {
        const payload = this.#sendQueue.shift();
        this.#socket.send(JSON.stringify(payload));
      }

      this.dispatchEvent(new CustomEvent('open'));
    });

    this.#socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type) {
          this.dispatchEvent(new CustomEvent(data.type, { detail: data }));
        }
      } catch (err) {
        console.error('Failed to parse incoming WebSocket message:', err);
      }
    });

    this.#socket.addEventListener('close', (event) => {
      console.log(`WebSocket closed (code: ${event.code})`);
      this.dispatchEvent(new CustomEvent('close', { detail: event }));

      if (!this.#isIntentionalClose) {
        this.#handleReconnect();
      }
    });

    this.#socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      this.dispatchEvent(new CustomEvent('error', { detail: error }));
    });
  }

  send(data) {
    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(data));
    } else {
      this.#sendQueue.push(data);
    }
  }

  close() {
    this.#isIntentionalClose = true;
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
