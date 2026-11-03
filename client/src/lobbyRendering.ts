import type { Lobby, Room } from "./lobby.js";

export function initLobbyRendering(lobby: Lobby): void {
  const nameInput = document.querySelector('#player-name-input') as HTMLInputElement | null;
  const roomsContainer = document.querySelector('#rooms-container') as HTMLElement | null;
  const refreshBtn = document.querySelector('#refresh-rooms-btn') as HTMLButtonElement | null;
  const errorDiv = document.querySelector('#lobby-error') as HTMLElement | null;

  const createRoomBtn = document.querySelector('#create-room-btn') as HTMLButtonElement | null;
  const newRoomNameInput = document.querySelector('#new-room-name') as HTMLInputElement | null;
  const newRoomMaxInput = document.querySelector('#new-room-max') as HTMLInputElement | null;

  let selectedRoomId: string | null = null;

  if (!createRoomBtn || !newRoomNameInput || !newRoomMaxInput || !errorDiv || !roomsContainer || !refreshBtn || !nameInput) {
    console.error("Lobby DOM elements not found");
    return;
  }

  const playerNameInput = nameInput;
  const roomList = roomsContainer;
  const errorMessage = errorDiv;

  createRoomBtn.addEventListener('click', async () => {
    const roomName = newRoomNameInput.value.trim() || 'Нова кімната';
    const maxPlayers = Number(newRoomMaxInput.value);
    errorMessage.textContent = '';

    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 8) {
      errorDiv.textContent = 'Кількість гравців має бути від 1 до 8';
      return;
    }

    createRoomBtn.disabled = true;
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, maxPlayers }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error || 'Не вдалося створити кімнату');
      }

      newRoomNameInput.value = '';
      await lobby.refresh();
    } catch (err: unknown) {
      errorMessage.textContent = err instanceof Error ? err.message : String(err);
    } finally {
      createRoomBtn.disabled = false;
    }
  });

  lobby.addEventListener('roomsupdated', (event: Event) => {
    const customEvent = event as CustomEvent<{ rooms: Room[] }>;
    const rooms = customEvent.detail.rooms;
    renderRooms(rooms);
    errorDiv.textContent = '';
  });

  lobby.addEventListener('error', (event: Event) => {
    const customEvent = event as CustomEvent<{ message: string }>;
    errorMessage.textContent = customEvent.detail.message;
  });

  refreshBtn.addEventListener('click', () => {
    lobby.refresh();
  });

  function renderRooms(rooms: readonly Room[]): void {
    roomList.innerHTML = '';

    if (rooms.length === 0) {
      roomList.innerHTML = '<p>No rooms available</p>';
      return;
    }

    rooms.forEach((room) => {
      const roomCard = document.createElement('div');
      roomCard.className = 'room-card';

      if (room.id === selectedRoomId) {
        roomCard.classList.add('selected');
      }

      const currentPlayers = room.currentPlayers ?? 0;
      const availableSeats = Math.max(room.maxPlayers - currentPlayers, 0);
      const roomInfo = document.createElement('div');
      roomInfo.className = 'room-info';

      const roomName = document.createElement('h3');
      roomName.textContent = room.name;

      const playerCount = document.createElement('p');
      playerCount.textContent = `Гравців: ${currentPlayers} / ${room.maxPlayers}`;

      const seatsCount = document.createElement('p');
      seatsCount.textContent = `Вільних місць: ${availableSeats}`;

      roomInfo.append(roomName, playerCount, seatsCount);
      roomCard.appendChild(roomInfo);

      const joinBtn = document.createElement('button');
      joinBtn.type = 'button';
      joinBtn.className = 'join-btn';
      joinBtn.textContent = availableSeats === 0 ? 'Кімната повна' : 'Приєднатися';
      joinBtn.disabled = availableSeats === 0;
      roomCard.appendChild(joinBtn);

      joinBtn.addEventListener('click', () => {
        const playerName = playerNameInput.value;
        try {
          lobby.join(room.id, playerName);
        } catch (err: unknown) {
          errorMessage.textContent = err instanceof Error ? err.message : String(err);
        }
      });

      roomList.appendChild(roomCard);
    });
  }
}
