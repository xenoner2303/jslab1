import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { ship, integrate } from './sim/ship.js';
import { wrap } from './sim/arena.js';
import { drawShip } from './render/draw.js';
import { configureCanvas } from './render/canvas.js';
import { step } from "./config/settings.js";

const canvasConfig = configureCanvas(window);
const input = createInput(window); // closure state for simulate to dont mess loop

function simulate(dt) {
    integrate(ship, input, dt); // змінили внутрішінй стан корабля
    wrap(ship, window.innerWidth, window.innerHeight); // wrap ship position to stay within the canvas boundaries
}

function render(alpha) {
    const ctx = canvasConfig.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); // очищаємо весь canvas перед малюванням нового кадру

    drawShip(ctx, ship);
}

const loop = createLoop({
    step,
    simulate,
    render
});

loop.start();
