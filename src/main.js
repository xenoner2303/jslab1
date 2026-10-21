import { createInput } from './input.js';
import { getAngleDelta } from './supFunctions.js';
import { createLoop } from './loop.js';
import { Ship } from './sim/ship.js';
import { World } from './sim/world.js';
import { Vector2 } from './sim/vector.js';
import { wrap } from './sim/arena.js';
import { loadAll } from '../assets/loader.js';
import {initAudio} from './sim/audio.js'
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

const world = new World(window.innerWidth, window.innerHeight);

initGame();

async function initGame() {
  const canvasConfig = configureCanvas(window);
  
  const loadingScreen = document.getElementById('loading-screen');
  const loadingText = document.getElementById('loading-text');
  const progressBar = document.getElementById('progress-bar');
  const startBtn = document.getElementById('start-btn');

  let audioCtx = null; // for browser audio
  
  await new Promise((resolve) => {
    startBtn.addEventListener('click', () => {
      audioCtx = new window.AudioContext();
      startBtn.style.display = 'none';
      loadingText.textContent = '0%';
      resolve();
    }, { once: true }); // for only one click
  });
  
  const controller = new AbortController();

  try 
  {
    const manifestRes = await fetch('./assets/manifest.json');
    const manifest = await manifestRes.json();

    const assets = await loadAll(manifest, {
      audioCtx,
      onProgress: (progress) => {
        const percent = Math.round(progress * 100);
        loadingText.textContent = `${percent}%`;
        progressBar.style.width = `${percent}%`; // expand width of progress bar
      },
      signal: controller.signal
    });

    const audio = initAudio(audioCtx, assets);
  
    world.addEventListener('shoot', () => audio.playShoot());
    world.addEventListener('exploded', () => audio.playExplosion());
    world.addEventListener('hit', (event) => audio.playHit(event.detail.type));
    world.addEventListener('environment', (event) => audio.playEnvironmentSound(event.detail.type));
    world.addEventListener('kill', (event) => audio.playKillJoke(event.detail.count, event.detail.type));

    loadingScreen.style.display = 'none';
    
    startGame(assets, canvasConfig);
  } 
  catch (error) 
  {
    console.error('Помилка під час ініціалізації гри:', error);
    loadingText.textContent = 'Не пограєш ти сьогодні, сорі';
  }
}

function startGame(assets, canvasConfig) {
  const input = createInput(window);

  const startMainShipPos = new Vector2(
    window.innerWidth / 2,
    window.innerHeight / 2
  );
  const mainShipRadius = Math.sqrt(shipWidth ** 2 + shipHeight ** 2) / 2; // rectangle diag formula

  let mainShip = new Ship(
    startMainShipPos,
    new Vector2(0, 0),
    mainShipRadius,
    0,
    input
  );
  world.spawn(mainShip);

  let previous = {
    pos: new Vector2(mainShip.pos.x, mainShip.pos.y),
    angle: mainShip.angle,
    thrust: mainShip.thrust,
  }; // previous ship state, remove shallow copy cause equal vector2 reference

  function simulate(dt) {
    previous = {
      pos: new Vector2(mainShip.pos.x, mainShip.pos.y),
      angle: mainShip.angle,
      thrust: mainShip.thrust,
    };

    world.step(dt, input);
    wrap(mainShip, window.innerWidth, window.innerHeight);

    input.clearJustPressed();
  }

  function render(alpha, stats) {
    const ctx = canvasConfig.ctx;
    const hud = document.getElementById('hud');
    hud.querySelector('#steps').textContent = `Steps: ${stats.sps}`;
    hud.querySelector('#fps').textContent = `FPS: ${stats.fps.toFixed(2)}`;
    hud.querySelector('#frameTime').textContent =
      `Frame Time: ${stats.frameTime.toFixed(2)} ms`;
    hud.querySelector('#score').textContent = `Score: ${mainShip.score} bliblies`;

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
    };

    drawGrid(ctx, window.innerWidth, window.innerHeight);
    if (mainShip.alive) drawShip(ctx, interpolatedShip, assets.ship);
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
