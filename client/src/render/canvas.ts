import { arenaHeight, arenaWidth } from '../../../shared/config/settings.ts';

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
    const scale = Math.min(
      1,
      target.innerWidth / arenaWidth,
      target.innerHeight / arenaHeight
    );
    const offsetX = (target.innerWidth - arenaWidth * scale) / 2;
    const offsetY = (target.innerHeight - arenaHeight * scale) / 2;
    canvas.width = Math.round(target.innerWidth * dpr);
    canvas.height = Math.round(target.innerHeight * dpr);
    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * offsetX,
      dpr * offsetY
    );
  }

  resizeCanvas();
  target.addEventListener('resize', resizeCanvas);
  return { ctx, resizeCanvas };
}
