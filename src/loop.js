// simulate → змінює стан гри
// render   → показує стан гри повинен отримувати фіксований step

function createLoop({step, simulate, render }) {
    let accumulator = 0; // накопичений час, який ще не був опрацьований simulation
    let lastFrameTime = 0; // час останнього кадру
    let animationId = null; // ID, який повертає requestAnimationFrame
    let isRunning = false;

    function frame(timestamp) {
        const currentTime = timestamp / 1000; // поточний час в секундах
        const deltaTime = Math.min(0.25, currentTime - lastFrameTime); // accumulator clamp 0.25
        lastFrameTime = currentTime;

        accumulator += deltaTime;

        while (accumulator >= step) {
            simulate(step);
            accumulator -= step;
        }

        const alpha = accumulator / step;

        render(alpha);

        animationId = requestAnimationFrame(frame);
    }

    function start() {
        if (isRunning) return;

        lastFrameTime = performance.now() / 1000;
        animationId = requestAnimationFrame(frame);
        isRunning = true;
    }

    function stop() {
        cancelAnimationFrame(animationId);
        isRunning = false;
        animationId = null;
    }

    return { start, stop };
}

export { createLoop }; // export function createLoop