import { lobbyRefresh } from '../../config/settings.js';
import { GameConnection } from '../connection.js';

class Lobby extends EventTarget {
  #rooms = [];
  #refreshInterval = null;
  #abortController = null;

  constructor() {
    super();
  }

  get rooms() {
    return this.#rooms;
  }

  async refresh() {
    if (this.#abortController) {
      this.#abortController.abort();
    }

    this.#abortController = new AbortController();

    try {
      const signal = AbortSignal.any([
        this.#abortController.signal,
        AbortSignal.timeout(3000),
      ]); // cancel http if either signal abort or timer

      const response = await fetch('/api/rooms', { signal }); // swap source to /api/rooms for server-side room management

      if (!response.ok) {
        throw new Error(`HTTP error - ${response.status}`);
      }

      const data = await response.json();

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
    } catch (error) {
      if (error.name === 'AbortError') {
        // for us
        console.log('Room list request was aborted');
      } else {
        console.log('Room dowloading error:', error);
        this.dispatchEvent(
          new CustomEvent('error', { detail: { message: error.message } })
        ); // for users
      }
    } finally {
      this.dispatchEvent(
        new CustomEvent('loadingchange', { detail: { isLoading: false } })
      );
    }
  }

  startAutoRefresh(intervalMs = lobbyRefresh) {
    this.stopAutoRefresh();

    this.refresh();

    this.#refreshInterval = setInterval(() => {
      this.refresh();
    }, intervalMs);
  }

  stopAutoRefresh() {
    if (this.#refreshInterval) {
      clearInterval(this.#refreshInterval);
      this.#refreshInterval = null;
    }

    if (this.#abortController) {
      this.#abortController.abort();
      this.#abortController = null;
    }
  }

  join(roomId, playerName) {
    const selectedRoom = this.#rooms.find((r) => r.id == roomId);

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
    const wsUrl = `${protocol}//${window.location.host}`;
    
    const connection = new GameConnection(wsUrl); // create a new GameConnection instance
    let hasJoined = false;

    connection.addEventListener('open', () => {
      connection.send({
        type: 'join',
        room: selectedRoom.id,
        name: playerName.trim(),
      });

      if (hasJoined) {
        return;
      }
      hasJoined = true;

      this.dispatchEvent(
        new CustomEvent('joined', {
          detail: {
            room: selectedRoom,
            playerName: playerName.trim(),
            connection,
          },
        })
      );
    });

    connection.addEventListener('error', () => {
      this.dispatchEvent(
        new CustomEvent('error', {
          detail: { message: 'AHAHAH he cannot join to server' },
        })
      );
    });

    connection.connect();
  }
}

export { Lobby };
