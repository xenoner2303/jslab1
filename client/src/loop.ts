export type LoopStats = {
  readonly sps: number;
  readonly fps: number;
  readonly frameTime: number;
};

type LoopOptions = {
  readonly step: number;
  readonly simulate: (dt: number) => void;
  readonly render: (alpha: number, stats: LoopStats) => void;
};

export function createLoop({ step, simulate, render }: LoopOptions): {
  start(): void;
  stop(): void;
} {
  let accumulator = 0;
  let lastFrameTime = 0;
  let animationId: number | null = null;
  let isRunning = false;
  let stepCount = 0;
  let frameCount = 0;
  let statsTime = 0;
  let sps = 0;
  let fps = 0;

  function frame(timestamp: number): void {
    const currentTime = timestamp / 1000;
    const deltaTime = Math.min(0.25, currentTime - lastFrameTime);
    lastFrameTime = currentTime;
    accumulator += deltaTime;

    while (accumulator >= step) {
      simulate(step);
      accumulator -= step;
      stepCount++;
    }

    frameCount++;
    if (currentTime - statsTime >= 1) {
      const elapsedTime = currentTime - statsTime;
      sps = stepCount / elapsedTime;
      fps = frameCount / elapsedTime;
      stepCount = 0;
      frameCount = 0;
      statsTime = currentTime;
    }

    render(accumulator / step, {
      sps,
      fps,
      frameTime: deltaTime * 1000,
    });
    animationId = requestAnimationFrame(frame);
  }

  function start(): void {
    if (isRunning) return;
    const now = performance.now() / 1000;
    lastFrameTime = now;
    statsTime = now;
    animationId = requestAnimationFrame(frame);
    isRunning = true;
  }

  function stop(): void {
    if (animationId !== null) cancelAnimationFrame(animationId);
    isRunning = false;
    animationId = null;
  }

  return { start, stop };
}
