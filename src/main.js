import {createLoop} from './loop.js';

const loop = createLoop({
    step: 1 / 60,

    simulate(dt) {
        console.log("SIMULATE", dt);
    },

    render(alpha) {
        console.log("RENDER", alpha);
    }
});

loop.start();