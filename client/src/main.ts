import { initAudio } from '../../shared/sim/audio.ts';
import { getMiniRocketLaunchState } from '../../shared/sim/miniRocket.ts';
import { Vector2 } from '../../shared/sim/vector.ts';
import { integrateShip } from '../../shared/sim/integrate.ts';
import { wrap } from '../../shared/sim/arena.ts';
import { createInputMessage } from '../../shared/protocol/messages.ts';
import type {
  ClientInputMessage,
  EntitySnapshot,
  SnapshotMessage,
} from '../../shared/protocol.ts';
import {
  arenaHeight,
  arenaWidth,
  rocketTtl,
  step,
} from '../../shared/config/settings.ts';
import { createInput } from './input.ts';
import { createLoop, type LoopStats } from './loop.ts';
import { initHud } from './hud.ts';
import { Lobby, type LobbyJoin } from './lobby.ts';
import { initLobbyRendering } from './lobbyRendering.ts';
import {
  getInterpolatedEntities,
  type SnapshotFrame,
} from './interpolation.ts';
import { loadAll, type LoadedAssets } from './loader.ts';
import {
  drawBarrierShield,
  drawBliBlie,
  drawExplosion,
  drawGrid,
  drawMiniRocket,
  drawShield,
  drawShip,
} from './render/draw.ts';
import { configureCanvas, type CanvasConfig } from './render/canvas.ts';

type PredictedShip = Omit<
  Extract<EntitySnapshot, { kind: 'mainShip' }>,
  'pos' | 'vel'
> & {
  pos: Vector2;
  vel: Vector2;
};

type PredictedRocket = Pick<
  Extract<EntitySnapshot, { kind: 'miniRocket' }>,
  | 'kind'
  | 'vel'
  | 'radius'
  | 'angle'
  | 'alive'
  | 'playerId'
  | 'ownerPlayerId'
  | 'fireSeq'
> & {
  pos: { x: number; y: number };
  x: number;
  y: number;
  spawnedAt: number;
  startX: number;
  startY: number;
};

function requireElement<T extends HTMLElement>(
  id: string,
  elementType: { new (): T }
): T {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`Required page element '${id}' was not found`);
  }
  return element;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function axisInput(value: number): -1 | 0 | 1 {
  if (value < 0) return -1;
  if (value > 0) return 1;
  return 0;
}

const hud = initHud();
startLobby();

function startLobby(): void {
  const lobby = new Lobby();
  const lobbyScreen = requireElement('lobby-screen', HTMLElement);
  initLobbyRendering(lobby);

  lobby.on('joined', (joinData) => {
    console.log(
      `Player ${joinData.playerName} joined room`,
      joinData.room.name
    );
    lobbyScreen.style.display = 'none';
    requireElement('loading-screen', HTMLElement).style.display = 'flex';
    void initGame(joinData);
  });

  lobby.startAutoRefresh();
}

async function initGame(joinData: LobbyJoin): Promise<void> {
  const canvasConfig = configureCanvas(window);
  const loadingScreen = requireElement('loading-screen', HTMLElement);
  const loadingText = requireElement('loading-text', HTMLElement);
  const progressBar = requireElement('progress-bar', HTMLElement);
  const startButton = requireElement('start-btn', HTMLButtonElement);
  const retryButton = requireElement('retry-btn', HTMLButtonElement);
  const cancelButton = requireElement('cancel-btn', HTMLButtonElement);
  const chatPanel = requireElement('chat-panel', HTMLElement);
  const chatMessages = requireElement('chat-messages', HTMLElement);
  const chatForm = requireElement('chat-form', HTMLFormElement);
  const chatInput = requireElement('chat-input', HTMLInputElement);

  joinData.connection.on('chat', (chat) => {
    const message = document.createElement('p');
    message.textContent = `${chat.sender}: ${chat.text}`;
    chatMessages.appendChild(message);
    while (chatMessages.childElementCount > 100) {
      chatMessages.firstElementChild?.remove();
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });

  joinData.connection.on('maxreconnect', () => {
    const message = document.createElement('p');
    message.textContent = 'З’єднання з сервером втрачено.';
    chatMessages.appendChild(message);
    chatPanel.style.display = 'flex';
  });

  chatForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    joinData.connection.send({ type: 'chat', text });
    chatInput.value = '';
  });

  let audioContext: AudioContext | null = null;
  await new Promise<void>((resolve) => {
    startButton.addEventListener(
      'click',
      () => {
        audioContext = new window.AudioContext();
        startButton.style.display = 'none';
        loadingText.textContent = '0%';
        resolve();
      },
      { once: true }
    );
  });

  async function loadGame(): Promise<void> {
    const controller = new AbortController();
    cancelButton.style.display = 'block';
    retryButton.style.display = 'none';
    cancelButton.onclick = () => controller.abort();

    try {
      const manifestResponse = await fetch('./assets/manifest.json', {
        signal: controller.signal,
      });
      if (!manifestResponse.ok) {
        throw new Error(
          `Asset manifest request failed: ${manifestResponse.status}`
        );
      }
      const manifest: unknown = await manifestResponse.json();
      const assets = await loadAll(manifest, {
        audioCtx: audioContext,
        onProgress: (progress) => {
          loadingText.textContent = `${Math.round(progress * 100)}%`;
          progressBar.style.width = `${Math.round(progress * 100)}%`;
        },
        signal: controller.signal,
      });

      cancelButton.style.display = 'none';
      cancelButton.onclick = null;
      initAudio(audioContext, assets.sounds);
      chatPanel.style.display = 'flex';
      loadingScreen.style.display = 'none';
      startGame(assets, canvasConfig, joinData);
    } catch (error: unknown) {
      cancelButton.style.display = 'none';
      cancelButton.onclick = null;
      if (error instanceof Error && error.name === 'AbortError') {
        loadingText.textContent = 'Denied by player';
      } else {
        loadingText.textContent = `Initialisation error: ${getErrorMessage(error)}`;
      }

      retryButton.style.display = 'block';
      retryButton.onclick = () => {
        retryButton.style.display = 'none';
        loadingText.textContent = '0%';
        progressBar.style.width = '0%';
        void loadGame();
      };
    }
  }

  await loadGame();
}

function startGame(
  assets: LoadedAssets,
  canvasConfig: CanvasConfig,
  joinData: LobbyJoin
): void {
  const input = createInput(window);
  const pendingInputs = new Map<number, ClientInputMessage>();
  const predictedRockets = new Map<number, PredictedRocket>();
  const snapshotBuffer: SnapshotFrame[] = [];
  const interpolationDelayStepMs = 1000 / 30;
  const maxInterpolationDelayMs = 500;
  let interpolationDelayMs = interpolationDelayStepMs * 2;
  let entities: readonly EntitySnapshot[] = [];
  let predictedShip: PredictedShip | null = null;
  let correctionMagnitude = 0;
  let correctionOffsetX = 0;
  let correctionOffsetY = 0;
  let correctionStartedAt = 0;
  let clientTick = 0;
  let inputSequence = 0;
  const interpolationDelayHud = document.querySelector<HTMLElement>(
    '#interpolation-delay'
  );

  joinData.connection.on('snapshot', (snapshot) => {
    handleSnapshot(snapshot);
  });

  function handleSnapshot(snapshot: SnapshotMessage): void {
    entities = snapshot.entities;
    const receivedAt = performance.now();
    snapshotBuffer.push({ receivedAt, entities: snapshot.entities });
    while (snapshotBuffer.length > 30) snapshotBuffer.shift();

    for (const entity of snapshot.entities) {
      if (
        entity.kind === 'miniRocket' &&
        entity.ownerPlayerId === joinData.playerId &&
        entity.fireSeq !== null
      ) {
        predictedRockets.delete(entity.fireSeq);
      }
    }

    const authoritativeShip = entities.find(
      (entity) =>
        entity.kind === 'mainShip' && entity.playerId === joinData.playerId
    );
    const acknowledgedSeq = snapshot.lastProcessedSeq[joinData.playerId];
    if (
      authoritativeShip?.kind === 'mainShip' &&
      acknowledgedSeq !== undefined
    ) {
      const now = performance.now();
      const currentCorrection = getCorrectionOffset(now);
      const previousState = predictedShip
        ? {
            pos: { x: predictedShip.pos.x, y: predictedShip.pos.y },
            vel: { x: predictedShip.vel.x, y: predictedShip.vel.y },
          }
        : null;
      const previousVisualPosition = predictedShip
        ? {
            x: predictedShip.pos.x + currentCorrection.x,
            y: predictedShip.pos.y + currentCorrection.y,
          }
        : null;

      predictedShip = {
        ...authoritativeShip,
        pos: new Vector2(authoritativeShip.pos.x, authoritativeShip.pos.y),
        vel: new Vector2(authoritativeShip.vel.x, authoritativeShip.vel.y),
      };

      for (const sequence of pendingInputs.keys()) {
        if (sequence <= acknowledgedSeq) pendingInputs.delete(sequence);
      }
      for (const message of pendingInputs.values()) {
        applyPredictedInput(message);
      }

      correctionMagnitude = previousState
        ? Math.hypot(
            previousState.pos.x - predictedShip.pos.x,
            previousState.pos.y - predictedShip.pos.y,
            (previousState.vel.x - predictedShip.vel.x) * step,
            (previousState.vel.y - predictedShip.vel.y) * step
          )
        : 0;
      correctionOffsetX = previousVisualPosition
        ? previousVisualPosition.x - predictedShip.pos.x
        : 0;
      correctionOffsetY = previousVisualPosition
        ? previousVisualPosition.y - predictedShip.pos.y
        : 0;
      correctionStartedAt = now;
    }

    if (acknowledgedSeq !== undefined) {
      for (const sequence of predictedRockets.keys()) {
        if (sequence <= acknowledgedSeq) predictedRockets.delete(sequence);
      }
    }
  }

  function applyPredictedInput(message: ClientInputMessage): void {
    if (!predictedShip || !predictedShip.alive) return;
    const next = integrateShip(predictedShip, message, step);
    predictedShip = { ...predictedShip, ...next };
    wrap(predictedShip, arenaWidth, arenaHeight);
  }

  function getCorrectionOffset(now: number): { x: number; y: number } {
    const remaining = Math.max(0, 1 - (now - correctionStartedAt) / 100);
    return {
      x: correctionOffsetX * remaining,
      y: correctionOffsetY * remaining,
    };
  }

  function simulate(_dt: number): void {
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
    const thrust = Number(input.isDown('KeyW')) - Number(input.isDown('KeyS'));
    const turn = Number(input.isDown('KeyD')) - Number(input.isDown('KeyA'));
    const fire = input.isJustPressed('Space');
    const message = createInputMessage({
      seq: inputSequence,
      tick: clientTick,
      thrust: axisInput(thrust),
      turn: axisInput(turn),
      fire,
    });

    if (joinData.connection.send(message, { queueIfDisconnected: false })) {
      pendingInputs.set(inputSequence, message);
      while (pendingInputs.size > 120) {
        const oldestSequence = pendingInputs.keys().next().value;
        if (oldestSequence === undefined) break;
        pendingInputs.delete(oldestSequence);
      }

      const localShip =
        predictedShip ??
        entities.find(
          (entity) =>
            entity.kind === 'mainShip' &&
            entity.playerId === joinData.playerId &&
            entity.alive
        );
      if (fire && localShip?.alive) {
        const launch = getMiniRocketLaunchState({
          pos: new Vector2(localShip.pos.x, localShip.pos.y),
          angle: localShip.angle,
          radius: localShip.radius,
        });
        predictedRockets.set(inputSequence, {
          kind: 'miniRocket',
          pos: { x: launch.pos.x, y: launch.pos.y },
          vel: { x: launch.vel.x, y: launch.vel.y },
          x: launch.pos.x,
          y: launch.pos.y,
          radius: launch.radius,
          angle: launch.angle,
          alive: true,
          playerId: joinData.playerId,
          ownerPlayerId: joinData.playerId,
          fireSeq: message.seq,
          spawnedAt: performance.now(),
          startX: launch.pos.x,
          startY: launch.pos.y,
        });
      }
      applyPredictedInput(message);
    }
    input.clearJustPressed();
  }

  function render(_alpha: number, stats: LoopStats): void {
    const ctx = canvasConfig.ctx;
    const now = performance.now();
    const correctionOffset = getCorrectionOffset(now);
    for (const [sequence, rocket] of predictedRockets) {
      const elapsedSeconds = (now - rocket.spawnedAt) / 1000;
      if (elapsedSeconds >= rocketTtl) {
        predictedRockets.delete(sequence);
        continue;
      }
      rocket.x = rocket.startX + rocket.vel.x * elapsedSeconds;
      rocket.y = rocket.startY + rocket.vel.y * elapsedSeconds;
      rocket.pos = { x: rocket.x, y: rocket.y };
    }

    const renderEntities: (EntitySnapshot | PredictedRocket)[] =
      getInterpolatedEntities(
        snapshotBuffer,
        now - interpolationDelayMs,
        joinData.playerId
      ).filter(
        (entity) =>
          entity.kind !== 'miniRocket' ||
          entity.ownerPlayerId !== joinData.playerId
      );
    renderEntities.push(
      ...entities.filter(
        (entity) =>
          entity.kind === 'miniRocket' &&
          entity.ownerPlayerId === joinData.playerId
      )
    );
    renderEntities.push(...predictedRockets.values());

    const localShip = entities.find(
      (entity) =>
        entity.kind === 'mainShip' && entity.playerId === joinData.playerId
    );
    hud.update(
      stats,
      localShip?.kind === 'mainShip' ? localShip.score : 0,
      correctionMagnitude
    );
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    drawGrid(ctx, window.innerWidth, window.innerHeight);

    for (const entity of renderEntities) {
      if (!entity.alive) continue;
      switch (entity.kind) {
        case 'mainShip': {
          const local =
            entity.playerId === joinData.playerId ? predictedShip : null;
          const x = local ? local.pos.x + correctionOffset.x : entity.x;
          const y = local ? local.pos.y + correctionOffset.y : entity.y;
          drawShip(
            ctx,
            {
              x,
              y,
              angle: local?.angle ?? entity.angle,
              thrust: local?.thrust ?? entity.thrust,
              angleChange: 0,
              playerName: entity.playerName,
            },
            assets.sprites.ship ?? null
          );
          if (entity.hasShield) {
            drawBarrierShield(ctx, {
              pos: { x, y },
              radius: entity.radius,
            });
          }
          break;
        }
        case 'miniRocket':
          drawMiniRocket(ctx, entity);
          break;
        case 'bliblie':
          drawBliBlie(ctx, entity, assets.sprites.bliblie ?? null);
          break;
        case 'explosion':
          drawExplosion(ctx, entity);
          break;
        case 'pickup':
          if (entity.effect === 'shield') {
            drawShield(ctx, entity, assets.sprites.shield ?? null);
          }
          break;
        default: {
          const exhaustiveCheck: never = entity;
          throw new TypeError(`Unsupported entity: ${exhaustiveCheck}`);
        }
      }
    }

    if (interpolationDelayHud) {
      interpolationDelayHud.textContent = `Interpolation delay: ${interpolationDelayMs.toFixed(0)} ms ([ / ] to adjust)`;
    }
  }

  const loop = createLoop({ step, simulate, render });
  loop.start();
}
