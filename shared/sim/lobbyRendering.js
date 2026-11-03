export function initLobbyRendering(lobby) {
  const nameInput = document.querySelector('#player-name-input');
  const roomsContainer = document.querySelector('#rooms-container');
  const refreshBtn = document.querySelector('#refresh-rooms-btn');
  const errorDiv = document.querySelector('#lobby-error');

  const createRoomBtn = document.querySelector('#create-room-btn');
  const newRoomNameInput = document.querySelector('#new-room-name');
  const newRoomMaxInput = document.querySelector('#new-room-max');

  let selectedRoomId = null;

  createRoomBtn.addEventListener('click', async () => {
    const roomName = newRoomNameInput.value.trim() || 'Нова кімната';
    const maxPlayers = Number(newRoomMaxInput.value);
    errorDiv.textContent = '';

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
        const result = await response.json();
        throw new Error(result.error || 'Не вдалося створити кімнату');
      }

      newRoomNameInput.value = '';
      await lobby.refresh();
    } catch (err) {
      errorDiv.textContent = err.message;
    } finally {
      createRoomBtn.disabled = false;
    }
  });

  lobby.addEventListener('roomsupdated', (event) => {
    const rooms = event.detail.rooms;
    renderRooms(rooms);
    errorDiv.textContent = '';
  });

  lobby.addEventListener('error', (event) => {
    errorDiv.textContent = event.detail.message;
  });

  refreshBtn.addEventListener('click', () => {
    lobby.refresh();
  });

  function renderRooms(rooms) {
    roomsContainer.innerHTML = '';

    if (rooms.length == 0) {
      roomsContainer.innerHTML = '<p>No rooms available</p>'; // just for message
      return;
    }

    rooms.forEach((room) => {
      const roomCard = document.createElement('div');
      roomCard.className = 'room-card';

      if (room.id == selectedRoomId) {
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
        const playerName = nameInput.value;
        try {
          lobby.join(room.id, playerName);
        } catch (err) {
          errorDiv.textContent = err.message;
        }
      });

      roomsContainer.appendChild(roomCard);
    });
  }
}
