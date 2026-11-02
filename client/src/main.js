import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { loadAll } from '../public/assets/loader.js';
import { initAudio } from '../../shared/sim/audio.js';
import { initHud } from '../../shared/sim/hud.js';
import { Lobby } from '../../shared/sim/lobby.js';
import { initLobbyRendering } from '../../shared/sim/lobbyRendering.js';
import { createInputMessage } from '../../shared/protocol/messages.js';
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
import { step } from '../../shared/config/settings.js';

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
      initAudio(audioCtx, assets);
      chatPanel.style.display = 'flex';

      loadingScreen.style.display = 'none';

      startGame(
        assets,
        canvasConfig,
        playerName,
        connection,
        joinData.playerId
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

function startGame(assets, canvasConfig, playerName, connection, playerId) {
  const input = createInput(window);
  const pendingInputs = new Map();
  let entities = [];
  let clientTick = 0;
  let inputSequence = 0;
  let serverTick = 0;
  let lastSnapshotReceivedAt = null;
  let rttMs = null;
  let bytesInPerSecond = 0;
  let bytesOutPerSecond = 0;
  let statsWindowStart = performance.now();
  let previousBytesIn = connection.bytesIn;
  let previousBytesOut = connection.bytesOut;

  const netgraph = document.createElement('pre');
  netgraph.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:10;margin:0;padding:8px 10px;' +
    'color:#d8f3dc;background:#101820dd;font:12px/1.5 monospace;pointer-events:none';
  document.body.appendChild(netgraph);

  connection.addEventListener('snapshot', (event) => {
    const snapshot = event.detail;
    entities = snapshot.entities;
    serverTick = snapshot.tick;
    lastSnapshotReceivedAt = performance.now();

    const acknowledgedSeq = snapshot.lastProcessedSeq?.[playerId];
    if (Number.isInteger(acknowledgedSeq)) {
      for (const [seq, sentAt] of pendingInputs) {
        if (seq <= acknowledgedSeq) {
          if (seq === acknowledgedSeq) {
            rttMs = performance.now() - sentAt;
          }
          pendingInputs.delete(seq);
        }
      }
    }

  });

  function simulate(dt) {
    clientTick = (clientTick + 1) >>> 0;
    inputSequence = (inputSequence + 1) >>> 0;

    const thrust =
      Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const turn =
      Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const message = createInputMessage({
      seq: inputSequence,
      tick: clientTick,
      thrust,
      turn,
      fire: input.isJustPressed('Space'),
    });

    if (connection.send(message, { queueIfDisconnected: false })) {
      pendingInputs.set(inputSequence, performance.now());
      while (pendingInputs.size > 120) {
        pendingInputs.delete(pendingInputs.keys().next().value);
      }
    }

    input.clearJustPressed();
  }

  function render(alpha, stats) {
    const ctx = canvasConfig.ctx;
    const localShip = entities.find(
      (entity) => entity.kind === 'mainShip' && entity.playerId === playerId
    );
    hud.update(stats, localShip?.score ?? 0);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    drawGrid(ctx, window.innerWidth, window.innerHeight);
    for (const entity of entities) {
      if (!entity.alive) continue;

      if (entity.kind === 'mainShip') {
        drawShip(
          ctx,
          {
            x: entity.x,
            y: entity.y,
            angle: entity.angle,
            thrust: entity.thrust,
            angleChange: 0,
            playerName: entity.playerName,
          },
          assets.ship
        );
        if (entity.hasShield) drawBarrierShield(ctx, entity);
      } else if (entity.kind === 'miniRocket') {
        drawMiniRocket(ctx, entity);
      } else if (entity.kind === 'bliblie') {
        drawBliBlie(ctx, entity, assets.bliblie);
      } else if (entity.kind === 'explosion') {
        drawExplosion(ctx, entity, assets.ship);
      } else if (entity.kind === 'pickup' && entity.effect === 'shield') {
        drawShield(ctx, entity, assets.shield);
      }
    }

    const now = performance.now();
    if (now - statsWindowStart >= 1000) {
      const elapsedSeconds = (now - statsWindowStart) / 1000;
      bytesInPerSecond =
        ((connection.bytesIn - previousBytesIn) / elapsedSeconds) | 0;
      bytesOutPerSecond =
        ((connection.bytesOut - previousBytesOut) / elapsedSeconds) | 0;
      previousBytesIn = connection.bytesIn;
      previousBytesOut = connection.bytesOut;
      statsWindowStart = now;
    }

    const snapshotAgeMs =
      lastSnapshotReceivedAt === null
        ? 'waiting'
        : `${Math.max(0, performance.now() - lastSnapshotReceivedAt).toFixed(0)} ms`;
    netgraph.textContent =
      `RTT: ${rttMs === null ? 'waiting' : `${rttMs.toFixed(1)} ms`}\n` +
      `Snapshot age: ${snapshotAgeMs}\n` +
      `Network: ↓ ${bytesInPerSecond} B/s  ↑ ${bytesOutPerSecond} B/s\n` +
      `Pending inputs: ${pendingInputs.size}\n` +
      `Server tick: ${serverTick}`;
  }

  const loop = createLoop({
    step,
    simulate,
    render,
  });

  loop.start();
}
