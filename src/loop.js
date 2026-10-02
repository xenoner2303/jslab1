function createLoop({step, simulate, render }) {
    let accumulator = 0;
    let lastFrameTime = 0;
    let animationId = null;
    let isRunning = false;
    let stepCount = 0;
    let frameCount = 0;
    let statsTime = 0;
    let sps = 0;
    let fps = 0;

    function frame(timestamp) {
        const currentTime = timestamp / 1000;
        const deltaTime = Math.min(0.25, currentTime - lastFrameTime); // accumulator clamp 0.25
        lastFrameTime = currentTime;

        accumulator += deltaTime;

        while (accumulator >= step) {
            simulate(step);
            accumulator -= step;
            stepCount++;
        }

        frameCount++;

        if (currentTime - statsTime >= 1) { // check - second passed simce last stat or no
            const elapsedTime = currentTime - statsTime;

            sps = stepCount / elapsedTime;
            fps = frameCount / elapsedTime;

            stepCount = 0;
            frameCount = 0;
            statsTime = currentTime;
        }

        const alpha = accumulator / step;
        const stats = {
            sps,
            fps,
            frameTime: deltaTime * 1000
        };

        render(alpha, stats);

        animationId = requestAnimationFrame(frame);
    }

    function start() {
        if (isRunning) return;

        const now = performance.now() / 1000;

        lastFrameTime = now;
        statsTime = now;
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

export { createLoop };
