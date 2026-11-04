import type { Lobby, Room } from './lobby.ts';

function getErrorMessage(data: unknown): string | undefined {
  if (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof data.error === 'string'
  ) {
    return data.error;
  }
  return undefined;
}

export function initLobbyRendering(lobby: Lobby): void {
  const nameInput =
    document.querySelector<HTMLInputElement>('#player-name-input');
  const roomsContainer =
    document.querySelector<HTMLElement>('#rooms-container');
  const refreshBtn =
    document.querySelector<HTMLButtonElement>('#refresh-rooms-btn');
  const errorDiv = document.querySelector<HTMLElement>('#lobby-error');
  const createRoomBtn =
    document.querySelector<HTMLButtonElement>('#create-room-btn');
  const newRoomNameInput =
    document.querySelector<HTMLInputElement>('#new-room-name');
  const newRoomMaxInput =
    document.querySelector<HTMLInputElement>('#new-room-max');

  const selectedRoomId: string | null = null;

  if (
    !createRoomBtn ||
    !newRoomNameInput ||
    !newRoomMaxInput ||
    !errorDiv ||
    !roomsContainer ||
    !refreshBtn ||
    !nameInput
  ) {
    console.error('Lobby DOM elements not found');
    return;
  }

  const playerNameInput = nameInput;
  const roomList = roomsContainer;
  const errorMessage = errorDiv;
  const createRoomButton = createRoomBtn;
  const roomNameInput = newRoomNameInput;
  const roomMaxInput = newRoomMaxInput;

  createRoomButton.addEventListener('click', () => {
    void createRoom();
  });

  async function createRoom(): Promise<void> {
    const roomName = roomNameInput.value.trim() || 'Нова кімната';
    const maxPlayers = Number(roomMaxInput.value);
    errorMessage.textContent = '';

    if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 8) {
      errorMessage.textContent = 'Кількість гравців має бути від 1 до 8';
      return;
    }

    createRoomButton.disabled = true;
    try {
      const response = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, maxPlayers }),
      });

      if (!response.ok) {
        const message = getErrorMessage(await response.json());
        throw new Error(message || 'Не вдалося створити кімнату');
      }

      roomNameInput.value = '';
      await lobby.refresh();
    } catch (err: unknown) {
      errorMessage.textContent =
        err instanceof Error ? err.message : String(err);
    } finally {
      createRoomButton.disabled = false;
    }
  }

  lobby.on('roomsupdated', ({ rooms }) => {
    renderRooms(rooms);
    errorDiv.textContent = '';
  });

  lobby.on('error', ({ message }) => {
    errorMessage.textContent = message;
  });

  refreshBtn.addEventListener('click', () => {
    void lobby.refresh();
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
      joinBtn.textContent =
        availableSeats === 0 ? 'Кімната повна' : 'Приєднатися';
      joinBtn.disabled = availableSeats === 0;
      roomCard.appendChild(joinBtn);

      joinBtn.addEventListener('click', () => {
        const playerName = playerNameInput.value;
        try {
          lobby.join(room.id, playerName);
        } catch (err: unknown) {
          errorMessage.textContent =
            err instanceof Error ? err.message : String(err);
        }
      });

      roomList.appendChild(roomCard);
    });
  }
}
