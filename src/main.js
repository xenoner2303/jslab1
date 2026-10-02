import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { ship, integrate } from './sim/ship.js';
import { wrap } from './sim/arena.js';
import { drawShip, drawGrid } from './render/draw.js';
import { configureCanvas } from './render/canvas.js';
import { step } from "../config/settings.js";

const canvasConfig = configureCanvas(window);
const input = createInput(window);

ship.x = window.innerWidth / 2; // start ship pos
ship.y = window.innerHeight / 2;

let previous = { ...ship }; // previous ship state

function simulate(dt) {
    previous = { ...ship };

    integrate(ship, input, dt); // modify inner ship state
    wrap(ship, window.innerWidth, window.innerHeight);

    input.clearJustPressed();
}

let frameTimes = [];
let measureStart = performance.now();

function render(alpha, stats) {
    frameTimes.push(stats.frameTime);

    if (performance.now() - measureStart >= 10000) {
        const min = Math.min(...frameTimes);
        const max = Math.max(...frameTimes);

        console.log("frames:", frameTimes.length);
        console.log("frametime min:", min.toFixed(2), "ms");
        console.log("frametime max:", max.toFixed(2), "ms");
        console.log("jitter:", (max - min).toFixed(2), "ms");

        frameTimes = [];
        measureStart = performance.now();
    }

    const ctx = canvasConfig.ctx;
    const hud = document.getElementById("hud");
    hud.querySelector("#steps").textContent = `Steps: ${stats.sps}`;
    hud.querySelector("#fps").textContent = `FPS: ${stats.fps.toFixed(2)}`;
    hud.querySelector("#frameTime").textContent = `Frame Time: ${stats.frameTime.toFixed(2)} ms`;

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    const angleChange = getAngleDelta(previous.angle, ship.angle);

    const interpolatedShip = { // interpolation between ship states
        x: previous.x + (ship.x - previous.x) * alpha,
        y: previous.y + (ship.y - previous.y) * alpha,
        angle: previous.angle + angleChange * alpha,
        thrust: previous.thrust + (ship.thrust - previous.thrust) * alpha,
        angleChange
    };

    drawGrid(ctx, window.innerWidth, window.innerHeight);
    drawShip(ctx, interpolatedShip);
}

const loop = createLoop({
    step,
    simulate,
    render
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
