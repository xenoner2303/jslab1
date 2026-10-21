import {lobbyRefresh} from "../../config/settings.js"

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
    this.dispatchEvent(new CustomEvent('loadingchange', { detail: { isLoading: true } }));

    try {
      const signal = AbortSignal.any([
        this.#abortController.signal,
        AbortSignal.timeout(3000)
      ]); // cancel http if either signal abort or timer

      const response = await fetch('./api/rooms.json', { signal });
      
      if (!response.ok) {
        throw new Error(`HTTP error - ${response.status}`);
      }

      const data = await response.json();

      if(data.rooms == null){
        this.#rooms = [];
      }
      else{
        this.#rooms = data.rooms;
      }
      
      this.dispatchEvent(new CustomEvent('roomsupdated', { detail: { rooms: this.#rooms } }));
    } 
    catch (error) {
        if (error.name === 'AbortError') { // for us
            console.log('Room list request was aborted');
        } 
        else 
        {
            console.log('Помилка завантаження кімнат:', error); // for users
            this.dispatchEvent(new CustomEvent('error', { detail: { message: error.message } }));
        }
    } 
    finally {
      this.dispatchEvent(new CustomEvent('loadingchange', { detail: { isLoading: false } }));
    }
  }

  startAutoRefresh(intervalMs = lobbyRefresh) {
    this.stopAutoRefresh();
    
    this.refresh();

    this.#refreshInterval = setInterval(() => {this.refresh();}, intervalMs);
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
    const selectedRoom = this.#rooms.find(r => r.id == roomId);
    
    if (!selectedRoom) {
      throw new Error('The selected room was not found');
    }

    if (!playerName || playerName.trim() === '') {
      throw new Error('Please enter player name');
    }

    this.stopAutoRefresh(); // stop http before exit

    this.dispatchEvent(new CustomEvent('joined', {
      detail: {
        room: selectedRoom,
        playerName: playerName.trim()
      }
    }));
  }
}

export {Lobby};
