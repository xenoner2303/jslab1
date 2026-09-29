import { createInput } from './input.js';
import { createLoop } from './loop.js';

const input = createInput(window); // closure state for simulate to dont mess loop

function simulate(dt) {
    if (input.isJustPressed("KeyA")) {
        console.log("Ship just started moving left");
    }

    if (input.isDown("KeyA")) {
        console.log("Ship is moving left");
    }
}

const loop = createLoop({
    step: 1 / 60,

    simulate,

    render(alpha) {
        console.log("RENDER", alpha);
    }
});

loop.start();