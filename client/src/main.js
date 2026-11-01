import { createInput } from './input.js';
import { getAngleDelta } from './supFunctions.js';
import { createLoop } from './loop.js';
import { Ship } from './sim/ship.js';
import { World } from './sim/world.js';
import { Vector2 } from './sim/vector.js';
import { wrap } from './sim/arena.js';
import { loadAll } from '../public/assets/loader.js';
import { initAudio } from './sim/audio.js';
import { initHud } from './sim/hud.js';
import { Lobby } from './sim/lobby.js';
import { initLobbyRendering } from './sim/lobbyRendering.js';
import {
  drawShip,
  drawGrid,
  drawBliBlie,
  drawMiniRocket,
  drawExplosion,
  drawShield,
  drawBarrierShield,
} from './render/draw.js';
import { configureCanvas } from './render/canvas.js';
import { step, shipWidth, shipHeight } from '../config/settings.js';

const hud = initHud();

startLobby();

function startLobby() {
  const lobby = new Lobby();
  const lobbyScreen = document.getElementById('lobby-screen');
  initLobbyRendering(lobby);

  lobby.addEventListener('joined', (event) => {
    const { room, playerName, connection } = event.detail;
    console.log(`Player ${playerName} join to room`, room.name);

    lobbyScreen.style.display = 'none';

    document.getElementById('loading-screen').style.display = 'flex';

    initGame(room, playerName, connection, event.detail);
  });

  lobby.startAutoRefresh();
}

async function initGame(room, playerName, connection, joinData) {
  const canvasConfig = configureCanvas(window);

  const loadingScreen = document.getElementById('loading-screen');
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('progress-bar');
  const startBtn = document.getElementById('start-btn');
  const retryBtn = document.getElementById('retry-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const chatPanel = document.getElementById('chat-panel');
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const remotePlayers = new Map();
  let localPlayerId = joinData.playerId;
  let localSpawnState = joinData.spawnState;

  function updateRoster(players) {
    remotePlayers.clear();
    for (const player of players) {
      if (player.id !== localPlayerId && player.state) {
        remotePlayers.set(player.id, { ...player.state, playerName: player.name });
      }
    }
  }

  updateRoster(joinData.roster);

  connection.addEventListener('roster', (event) => {
    updateRoster(event.detail.players);
  });

  connection.addEventListener('joined', (event) => {
    localPlayerId = event.detail.playerId;
    localSpawnState = event.detail.state;
    remotePlayers.delete(localPlayerId);
  });

  connection.addEventListener('chat', (event) => {
    const message = document.createElement('p');
    message.textContent = `${event.detail.sender}: ${event.detail.text}`;
    chatMessages.appendChild(message);
    while (chatMessages.childElementCount > 100) {
      chatMessages.firstElementChild.remove();
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  connection.addEventListener('maxreconnect', () => {
    const message = document.createElement('p');
    message.textContent = 'З’єднання з сервером втрачено.';
    chatMessages.appendChild(message);
    chatPanel.style.display = 'flex';
  });

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    connection.send({ type: 'chat', text });
    chatInput.value = '';
  });

  connection.addEventListener('state', (event) => {
    const { playerId, playerName, ...state } = event.detail;
    if (playerId !== localPlayerId) {
      remotePlayers.set(playerId, { ...state, playerName });
    }
  });

  let audioCtx = null; // for browser audio

  await new Promise((resolve) => {
    startBtn.addEventListener(
      'click',
      () => {
        audioCtx = new window.AudioContext();
        startBtn.style.display = 'none';
        loadingText.textContent = '0%';
        resolve();
      },
      { once: true }
    ); // for only one click
  });

  async function loadGame() {
    const controller = new AbortController();
    cancelBtn.style.display = 'block';
    retryBtn.style.display = 'none';
    cancelBtn.onclick = () => controller.abort();

    try {
      const manifestRes = await fetch('./assets/manifest.json', {
        signal: controller.signal,
      });
      const manifest = await manifestRes.json();

      const assets = await loadAll(manifest, {
        audioCtx,
        onProgress: (progress) => {
          const percent = Math.round(progress * 100);
          loadingText.textContent = `${percent}%`;
          progressBar.style.width = `${percent}%`; // expand width of progress bar
        },
        signal: controller.signal,
      });

      cancelBtn.style.display = 'none';
      cancelBtn.onclick = null;
      const audio = initAudio(audioCtx, assets);

      const arenaWidth = room.arenaConfig.width;
      const arenaHeight = room.arenaConfig.height;
      const world = new World(arenaWidth, arenaHeight);
      chatPanel.style.display = 'flex';

      world.addEventListener('shoot', () => audio.playShoot());
      world.addEventListener('exploded', () => audio.playExplosion());
      world.addEventListener('hit', (event) =>
        audio.playHit(event.detail.type)
      );
      world.addEventListener('environment', (event) =>
        audio.playEnvironmentSound(event.detail.type)
      );
      world.addEventListener('kill', (event) => {
        audio.playKillJoke(event.detail.count, event.detail.type);
        hud.showKillMessage(event.detail.count);
      });

      loadingScreen.style.display = 'none';

      startGame(
        world,
        assets,
        canvasConfig,
        arenaWidth,
        arenaHeight,
        playerName,
        connection,
        remotePlayers,
        () => localSpawnState
      );
    } catch (error) {
      cancelBtn.style.display = 'none';
      cancelBtn.onclick = null;

      if (error.name == 'AbortError') {
        loadingText.textContent = 'Denied by player';
      } else {
        loadingText.textContent = `Initialisation error: ${error.message}`;
      }

      retryBtn.style.display = 'block';
      retryBtn.onclick = () => {
        retryBtn.style.display = 'none';
        loadingText.textContent = '0%';
        progressBar.style.width = '0%';
        loadGame();
      };
    }
  }

  await loadGame();
}

function startGame(
  world,
  assets,
  canvasConfig,
  arenaWidth,
  arenaHeight,
  playerName,
  connection,
  remotePlayers,
  getSpawnState
) {
  const input = createInput(window);

  const spawnState = getSpawnState();
  const startMainShipPos = new Vector2(
    spawnState?.x ?? arenaWidth / 2,
    spawnState?.y ?? arenaHeight / 2
  );

  const mainShipRadius = Math.sqrt(shipWidth ** 2 + shipHeight ** 2) / 2; // rectangle diag formula

  let mainShip = new Ship(
    startMainShipPos,
    new Vector2(0, 0),
    mainShipRadius,
    spawnState?.angle ?? 0,
    input,
    playerName
  );
  world.spawn(mainShip);

  let previous = {
    pos: new Vector2(mainShip.pos.x, mainShip.pos.y),
    angle: mainShip.angle,
    thrust: mainShip.thrust,
  }; // previous ship state, remove shallow copy cause equal vector2 reference
  let stateSendTimer = 0;

  function simulate(dt) {
    previous = {
      pos: new Vector2(mainShip.pos.x, mainShip.pos.y),
      angle: mainShip.angle,
      thrust: mainShip.thrust,
    };

    world.step(dt, input);
    wrap(mainShip, arenaWidth, arenaHeight);

    stateSendTimer += dt;
    if (stateSendTimer >= 1 / 20) {
      stateSendTimer = 0;
      connection.send({
        type: 'state',
        x: mainShip.pos.x,
        y: mainShip.pos.y,
        angle: mainShip.angle,
        thrust: mainShip.thrust,
        alive: mainShip.alive,
      }, { queueIfDisconnected: false });
    }

    input.clearJustPressed();
  }

  function render(alpha, stats) {
    const ctx = canvasConfig.ctx;
    hud.update(stats, mainShip.score);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const entity of world.ofKind('miniRocket')) {
      drawMiniRocket(ctx, entity);
    }

    for (const entity of world.ofKind('bliblie')) {
      drawBliBlie(ctx, entity, assets.bliblie);
    }

    for (const entity of world.ofKind('explosion')) {
      drawExplosion(ctx, entity, assets.ship);
    }

    for (const entity of world.ofKind('pickup')) {
      if (entity.effect == 'shield') {
        drawShield(ctx, entity, assets.shield);
      }
    }

    const angleChange = getAngleDelta(previous.angle, mainShip.angle);

    const interpolatedShip = {
      // interpolation between ship states
      x: previous.pos.x + (mainShip.pos.x - previous.pos.x) * alpha,
      y: previous.pos.y + (mainShip.pos.y - previous.pos.y) * alpha,
      angle: previous.angle + angleChange * alpha,
      thrust: previous.thrust + (mainShip.thrust - previous.thrust) * alpha,
      angleChange,
      playerName: mainShip.playerName,
    };

    drawGrid(ctx, window.innerWidth, window.innerHeight);
    if (mainShip.alive) drawShip(ctx, interpolatedShip, assets.ship);
    for (const player of remotePlayers.values()) {
      if (player.alive !== false) {
        drawShip(
          ctx,
          {
            x: player.x,
            y: player.y,
            angle: player.angle,
            thrust: player.thrust,
            angleChange: 0,
            playerName: player.playerName,
          },
          assets.ship
        );
      }
    }
    if (mainShip.alive && mainShip.hasShield) {
      drawBarrierShield(ctx, mainShip);
    }
  }

  const loop = createLoop({
    step,
    simulate,
    render,
  });

  loop.start();
}
