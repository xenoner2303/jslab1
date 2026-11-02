import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { loadAll } from '../public/assets/loader.js';
import { initAudio } from '../../shared/sim/audio.js';
import { initHud } from '../../shared/sim/hud.js';
import { Lobby } from '../../shared/sim/lobby.js';
import { initLobbyRendering } from '../../shared/sim/lobbyRendering.js';
import { getMiniRocketLaunchState } from '../../shared/sim/miniRocket.js';
import { createInputMessage } from '../../shared/protocol/messages.js';
import { rocketTtl } from '../../shared/config/settings.js';
import { getInterpolatedEntities } from './interpolation.js';
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
import {
  arenaHeight,
  arenaWidth,
  step,
} from '../../shared/config/settings.js';

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
  const pendingInputs = new Set();
  const predictedRockets = new Map();
  const snapshotBuffer = [];
  const interpolationDelayStepMs = 1000 / 30;
  const maxInterpolationDelayMs = 500;
  let interpolationDelayMs = interpolationDelayStepMs * 2;
  let entities = [];
  let predictedShip = null;
  let correctionMagnitude = 0;
  let correctionOffsetX = 0;
  let correctionOffsetY = 0;
  let correctionStartedAt = 0;
  let clientTick = 0;
  let inputSequence = 0;
  const interpolationDelayHud = document.querySelector('#interpolation-delay');

  connection.addEventListener('snapshot', (event) => {
    const snapshot = event.detail;
    entities = snapshot.entities;
    const receivedAt = performance.now();
    snapshotBuffer.push({
      receivedAt,
      entities: snapshot.entities,
    });
    while (snapshotBuffer.length > 30) {
      snapshotBuffer.shift();
    }

    for (const entity of snapshot.entities) {
      if (
        entity.kind === 'miniRocket' &&
        entity.ownerPlayerId === playerId &&
        Number.isInteger(entity.fireSeq)
      ) {
        predictedRockets.delete(entity.fireSeq);
      }
    }

    const authoritativeShip = entities.find(
      (entity) => entity.kind === 'mainShip' && entity.playerId === playerId
    );
    const acknowledgedSeq = snapshot.lastProcessedSeq?.[playerId];
    if (Number.isInteger(acknowledgedSeq)) {
      for (const seq of pendingInputs) {
        if (seq <= acknowledgedSeq) {
          pendingInputs.delete(seq);
        }
      }
      for (const seq of predictedRockets.keys()) {
        if (seq <= acknowledgedSeq) {
          predictedRockets.delete(seq);
        }
      }
    }
  });

  function applyPredictedInput(message) {
    if (!predictedShip || !predictedShip.alive) return;

    predictedShip = {
      ...predictedShip,
      ...integrateShip(predictedShip, message, step),
    };
    wrap(predictedShip, arenaWidth, arenaHeight);
  }

  function getCorrectionOffset(now) {
    const remaining = Math.max(0, 1 - (now - correctionStartedAt) / 100);
    return {
      x: correctionOffsetX * remaining,
      y: correctionOffsetY * remaining,
    };
  }

  function simulate(dt) {
    if (input.isJustPressed('BracketLeft')) {
      interpolationDelayMs = Math.max(
        0,
        interpolationDelayMs - interpolationDelayStepMs
      );
    }
    if (input.isJustPressed('BracketRight')) {
      interpolationDelayMs = Math.min(
        maxInterpolationDelayMs,
        interpolationDelayMs + interpolationDelayStepMs
      );
    }

    clientTick = (clientTick + 1) >>> 0;
    inputSequence = (inputSequence + 1) >>> 0;

    const thrust =
      Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const turn =
      Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const fire = input.isJustPressed('Space');
    const message = createInputMessage({
      seq: inputSequence,
      tick: clientTick,
      thrust,
      turn,
      fire,
    });

    if (connection.send(message, { queueIfDisconnected: false })) {
      pendingInputs.add(inputSequence);
      while (pendingInputs.size > 120) {
        pendingInputs.delete(pendingInputs.values().next().value);
      }

      const localShip = entities.find(
        (entity) =>
          entity.kind === 'mainShip' &&
          entity.playerId === playerId &&
          entity.alive
      );
      if (fire && localShip) {
        const launch = getMiniRocketLaunchState(localShip);
        predictedRockets.set(inputSequence, {
          id: `predicted-${playerId}-${inputSequence}`,
          kind: 'miniRocket',
          pos: { x: launch.pos.x, y: launch.pos.y },
          vel: { x: launch.vel.x, y: launch.vel.y },
          x: launch.pos.x,
          y: launch.pos.y,
          radius: launch.radius,
          angle: launch.angle,
          alive: true,
          ownerPlayerId: playerId,
          fireSeq: inputSequence,
          spawnedAt: performance.now(),
          startX: launch.pos.x,
          startY: launch.pos.y,
        });
      }
      applyPredictedInput(message);
    }

    input.clearJustPressed();
  }

  function render(alpha, stats) {
    const ctx = canvasConfig.ctx;
    const now = performance.now();
    for (const [seq, rocket] of predictedRockets) {
      const elapsedSeconds = (now - rocket.spawnedAt) / 1000;
      if (elapsedSeconds >= rocketTtl) {
        predictedRockets.delete(seq);
        continue;
      }

      rocket.x = rocket.startX + rocket.vel.x * elapsedSeconds;
      rocket.y = rocket.startY + rocket.vel.y * elapsedSeconds;
      rocket.pos.x = rocket.x;
      rocket.pos.y = rocket.y;
    }
    const renderEntities = getInterpolatedEntities(
      snapshotBuffer,
      now - interpolationDelayMs,
      playerId
    ).filter(
      (entity) =>
        entity.kind !== 'miniRocket' || entity.ownerPlayerId !== playerId
    );
    renderEntities.push(
      ...entities.filter(
        (entity) =>
          entity.kind === 'miniRocket' &&
          entity.ownerPlayerId === playerId
      )
    );
    renderEntities.push(...predictedRockets.values());
    const localShip = entities.find(
      (entity) => entity.kind === 'mainShip' && entity.playerId === playerId
    );
    hud.update(stats, localShip?.score ?? 0, correctionMagnitude);

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    drawGrid(ctx, window.innerWidth, window.innerHeight);
    for (const entity of renderEntities) {
      if (!entity.alive) continue;

      if (entity.kind === 'mainShip') {
        const isLocalShip = entity.playerId === playerId && predictedShip;
        const shipToRender =
          isLocalShip
            ? {
                ...entity,
                x: predictedShip.pos.x + correctionOffset.x,
                y: predictedShip.pos.y + correctionOffset.y,
                pos: {
                  x: predictedShip.pos.x + correctionOffset.x,
                  y: predictedShip.pos.y + correctionOffset.y,
                },
                angle: predictedShip.angle,
                thrust: predictedShip.thrust,
              }
            : entity;
        drawShip(
          ctx,
          {
            x: shipToRender.x,
            y: shipToRender.y,
            angle: shipToRender.angle,
            thrust: shipToRender.thrust,
            angleChange: 0,
            playerName: entity.playerName,
          },
          assets.ship
        );
        if (entity.hasShield) drawBarrierShield(ctx, shipToRender);
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

    if (interpolationDelayHud) {
      interpolationDelayHud.textContent =
        `Interpolation delay: ${interpolationDelayMs.toFixed(0)} ms ([ / ] to adjust)`;
    }
  }

  const loop = createLoop({
    step,
    simulate,
    render,
  });

  loop.start();
}
