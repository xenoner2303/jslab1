export type CanvasConfig = {
  readonly ctx: CanvasRenderingContext2D;
  resizeCanvas(): void;
};

export function configureCanvas(target: Window): CanvasConfig {
  const element = document.getElementById('gameCanvas');
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error('Game canvas element was not found');
  }
  const canvas: HTMLCanvasElement = element;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to create 2D canvas context');
  const ctx: CanvasRenderingContext2D = context;

  function resizeCanvas(): void {
    const dpr = target.devicePixelRatio;
    canvas.width = target.innerWidth * dpr;
    canvas.height = target.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  target.addEventListener('resize', resizeCanvas);
  return { ctx, resizeCanvas };
}
