export function initLobbyRendering(lobby) {
  const nameInput = document.querySelector('#player-name-input');
  const roomsContainer = document.querySelector('#rooms-container');
  const refreshBtn = document.querySelector('#refresh-rooms-btn');
  const errorDiv = document.querySelector('#lobby-error');

  let selectedRoomId = null;

  lobby.addEventListener('roomsupdated', (event) => {
    const rooms = event.detail.rooms;
    renderRooms(rooms);
    errorDiv.textContent = '';
  });

  lobby.addEventListener('error', (event) => {
    errorDiv.textContent = event.detail.message;
  });

  refreshBtn.addEventListener('click', () => {lobby.refresh();});

  function renderRooms(rooms) {
    roomsContainer.innerHTML = '';

    if (rooms.length == 0) {
      roomsContainer.innerHTML = '<p>No rooms available</p>'; // just for message
      return;
    }

    rooms.forEach(room => {
      const roomCard = document.createElement('div');
      roomCard.className = 'room-card';

      if (room.id == selectedRoomId) {
        roomCard.classList.add('selected');
      }

      roomCard.innerHTML = `
        <h3>${room.name}</h3>
        <p>Max players: ${room.maxPlayers}</p>
        <button type="button" class="join-btn">Join</button> `;

      const joinBtn = roomCard.querySelector('.join-btn');
      joinBtn.addEventListener('click', () => {
        const playerName = nameInput.value;
        try {
          lobby.join(room.id, playerName);
        } 
        catch (err) {
          errorDiv.textContent = err.message;
        }
      });

      roomsContainer.appendChild(roomCard);
    });
  }
}
