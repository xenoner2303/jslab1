import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { ship, integrate } from './sim/ship.js';
import { wrap } from './sim/arena.js';
import { drawShip } from './render/draw.js';
import { configureCanvas } from './render/canvas.js';
import { step } from "../config/settings.js";

const canvasConfig = configureCanvas(window);
const input = createInput(window); // closure state for simulate to dont mess loop

ship.x = window.innerWidth / 2; // встановлюємо початкову позицію корабля в центрі вікна
ship.y = window.innerHeight / 2;

let previous = { ...ship }; // зберігаємо попередній стан корабля перед інтеграцією

function simulate(dt) {
    previous = { ...ship };

    integrate(ship, input, dt); // змінили внутрішінй стан корабля
    wrap(ship, window.innerWidth, window.innerHeight); // wrap ship position to stay within the canvas boundaries
}

function render(alpha, stats) {
    const ctx = canvasConfig.ctx;
    const hud = document.getElementById("hud");
    hud.querySelector("#steps").textContent = `Steps: ${stats.sps}`;
    hud.querySelector("#fps").textContent = `FPS: ${stats.fps.toFixed(2)}`;
    hud.querySelector("#frameTime").textContent = `Frame Time: ${stats.frameTime.toFixed(2)} ms`;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); // очищаємо весь canvas перед малюванням нового кадру

    // інтерполяція між попереднім і поточним станом корабля
    const interpolatedShip = {
        x: previous.x + (ship.x - previous.x) * alpha,
        y: previous.y + (ship.y - previous.y) * alpha,
        angle: lerpAngle(previous.angle, ship.angle, alpha)
    };

    drawShip(ctx, interpolatedShip);
}

const loop = createLoop({
    step,
    simulate,
    render
});

loop.start();

function lerpAngle(previous, current, alpha) { // функція, що повертає найкоротший шлях між двома кутами, враховуючи обертання на 360 градусів
    let delta = current - previous;

    if (delta > Math.PI) {
        delta -= 2 * Math.PI;
    }

    if (delta < -Math.PI) {
        delta += 2 * Math.PI;
    }

    return previous + delta * alpha;
}
