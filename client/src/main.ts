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
import {
  reconcilePredictedShip,
  type PredictedShip,
} from './reconciliation.ts';
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

function getResponseMessage(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined;
  if ('message' in payload && typeof payload.message === 'string') {
    return payload.message;
  }
  if ('error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return undefined;
}

async function addBots(roomId: string, count: number): Promise<number> {
  const response = await fetch(`/api/rooms/${roomId}/bots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count }),
  });

  if (!response.ok) {
    const errorData: unknown = await response.json().catch(() => null);
    throw new Error(
      getResponseMessage(errorData) ?? `Помилка сервера: ${response.status}`
    );
  }

  const data: unknown = await response.json();
  if (
    typeof data !== 'object' ||
    data === null ||
    !('bots' in data) ||
    !Array.isArray(data.bots)
  ) {
    throw new Error('Сервер повернув некоректну відповідь');
  }
  return data.bots.length;
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
  const botsForm = requireElement('bots-form', HTMLFormElement);
  const botsCountInput = requireElement('bots-count', HTMLInputElement);
  const botsSubmitButton = botsForm.querySelector('button[type="submit"]');
  if (!(botsSubmitButton instanceof HTMLButtonElement)) {
    throw new Error('Required bot form submit button was not found');
  }
  const submitBotsButton = botsSubmitButton;
  const botsStatus = requireElement('bots-status', HTMLElement);
  const chatForm = requireElement('chat-form', HTMLFormElement);
  const chatInput = requireElement('chat-input', HTMLInputElement);

  botsForm.addEventListener('submit', (event) => {
    void handleAddBots(event);
  });

  async function handleAddBots(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const count = Number(botsCountInput.value);
    if (!Number.isInteger(count) || count < 1 || count > 8) {
      botsStatus.textContent = 'Вкажіть ціле число від 1 до 8';
      return;
    }

    submitBotsButton.disabled = true;
    botsStatus.textContent = 'Додаємо ботів…';
    try {
      const addedCount = await addBots(joinData.room.id, count);
      botsStatus.textContent = `Успішно додано ботів: ${addedCount}`;
    } catch (error: unknown) {
      botsStatus.textContent = `Не вдалося додати ботів: ${getErrorMessage(error)}`;
    } finally {
      submitBotsButton.disabled = false;
    }
  }

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
    message.textContent = 'З’єднання з сервером втрачено';
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
  const particleWorker = new Worker(
    new URL('./workers/particle.worker.ts', import.meta.url),
    { type: 'module' }
  );
  const preparedExplosionParticles = new Map<
    EntitySnapshot['id'],
    Float32Array
  >();
  particleWorker.onmessage = (
    event: MessageEvent<{ results: { id: number; buffer: ArrayBuffer }[] }>
  ) => {
    for (const result of event.data.results) {
      preparedExplosionParticles.set(
        result.id as EntitySnapshot['id'],
        new Float32Array(result.buffer)
      );
    }
  };
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
    const explosions = snapshot.entities.filter(
      (entity) => entity.kind === 'explosion'
    );
    const activeExplosionIds = new Set<EntitySnapshot['id']>(
      explosions.map((entity) => entity.id)
    );
    for (const id of preparedExplosionParticles.keys()) {
      if (!activeExplosionIds.has(id)) preparedExplosionParticles.delete(id);
    }
    if (explosions.length > 0) {
      particleWorker.postMessage({
        explosions: explosions.map((explosion) => ({
          id: explosion.id,
          particles: explosion.particles,
        })),
      });
    }
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

      const reconciled = reconcilePredictedShip(
        authoritativeShip,
        pendingInputs,
        acknowledgedSeq
      );
      predictedShip = reconciled.predictedShip;
      pendingInputs.clear();
      for (const [sequence, message] of reconciled.pendingInputs) {
        pendingInputs.set(sequence, message);
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

  function simulate(): void {
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
    ctx.save();
    ctx.setTransform(
      window.devicePixelRatio,
      0,
      0,
      window.devicePixelRatio,
      0,
      0
    );
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
    drawGrid(ctx);

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
          drawExplosion(ctx, entity, preparedExplosionParticles.get(entity.id));
          break;
        case 'pickup':
          if (entity.effect === 'shield') {
            drawShield(ctx, entity, assets.sprites.shield ?? null);
          }
          break;
        default: {
          const exhaustiveCheck: never = entity;
          throw new TypeError(`Unsupported entity: ${String(exhaustiveCheck)}`);
        }
      }
    }

    if (interpolationDelayHud) {
      interpolationDelayHud.textContent = `Interpolation delay: ${interpolationDelayMs.toFixed(0)} ms ([ / ] to adjust)`;
    }
  }

  const loop = createLoop({ step, simulate, render });
  window.addEventListener('beforeunload', () => particleWorker.terminate(), {
    once: true,
  });
  loop.start();
}
