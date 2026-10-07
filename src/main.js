import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { Ship } from './sim/ship.js';
import { World } from './sim/world.js';
import { Vector2 } from './sim/vector.js';
import { wrap } from './sim/arena.js';
import { drawShip, drawGrid, drawBliBlie, drawMiniRocket } from './render/draw.js';
import { configureCanvas } from './render/canvas.js';
import { step, bulletWidth, bulletHeight } from '../config/settings.js';

const canvasConfig = configureCanvas(window);
const input = createInput(window);
const world = new World(window.innerWidth, window.innerHeight);
const startMainShipPos = new Vector2(window.innerWidth / 2, window.innerHeight / 2);
const mainShipRadius = Math.sqrt(bulletWidth ** 2 + bulletHeight ** 2) / 2; // rectangle diag formula

let mainShip = new Ship(startMainShipPos, new Vector2(0, 0), mainShipRadius, 0, "mainShip", input);

const fire = mainShip.fire;
fire(); // should be typerrror, because we invoke this method as no Ship method with this == undefined

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
  hud.querySelector('#frameTime').textContent = `Frame Time: ${stats.frameTime.toFixed(2)} ms`;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (const entity of world.ofKind("miniRocket")) {
    drawMiniRocket(ctx, entity);
  }

  for (const entity of world.ofKind("bliblie")) {
    drawBliBlie(ctx, entity);
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
  drawShip(ctx, interpolatedShip);
}

const loop = createLoop({
  step,
  simulate,
  render,
});

loop.start();

function getAngleDelta(previous, current) {
  let delta = current - previous;

  if (delta > Math.PI) {
    delta -= 2 * Math.PI;
  }

  if (delta < -Math.PI) {
    delta += 2 * Math.PI;
  }

  return delta;
}
