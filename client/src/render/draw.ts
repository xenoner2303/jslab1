import type { EntitySnapshot } from '../../../shared/protocol.ts';
import {
  arenaHeight,
  arenaWidth,
  barrierShieldAdditionalRadius,
  barrierShieldLineWidth,
  barrierShieldStrokeStyle,
  bliblieHeight,
  bliblieWidth,
  explosionColors,
  gridColor,
  gridSize,
  miniRocketFillStyle,
  miniRocketFlameFillStyle,
  miniRocketHeight,
  miniRocketWidth,
  shipAnglePower,
  shipBackThurstColor,
  shipFrontThurstColor,
  shipHeight,
  shipThurstLineCount,
  shipThurstLineWidth,
  shipThurstMultiplier,
  shipWidth,
  shieldHeight,
  shieldWidth,
} from '../../../shared/config/settings.ts';

type ShipDrawing = {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly thrust: number;
  readonly angleChange: number;
  readonly playerName: string;
};

type PositionedEntity = Pick<EntitySnapshot, 'pos' | 'radius'>;
type BliBlieSnapshot = Extract<EntitySnapshot, { kind: 'bliblie' }>;
type MiniRocketSnapshot = Extract<EntitySnapshot, { kind: 'miniRocket' }>;
type ExplosionSnapshot = Extract<EntitySnapshot, { kind: 'explosion' }>;
type ShieldSnapshot = Extract<EntitySnapshot, { kind: 'pickup' }>;

export function drawShip(
  ctx: CanvasRenderingContext2D,
  ship: ShipDrawing,
  shipImage: CanvasImageSource | null
): void {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.fillText(ship.playerName, 0, -shipHeight / 2 - 10);
  ctx.rotate(ship.angle);

  if (shipImage) {
    ctx.drawImage(
      shipImage,
      -shipHeight / 2,
      -shipWidth / 2,
      shipHeight,
      shipWidth
    );
  }
  if (ship.thrust !== 0) drawBulletThrust(ctx, ship.thrust, ship.angleChange);
  ctx.restore();
}

function drawBulletThrust(
  ctx: CanvasRenderingContext2D,
  thrust: number,
  angleChange: number
): void {
  if (thrust === 0) return;
  const direction = thrust > 0 ? -1 : 1;
  const length = Math.abs(thrust) * shipThurstMultiplier;
  ctx.strokeStyle = thrust > 0 ? shipFrontThurstColor : shipBackThurstColor;
  ctx.lineWidth = shipThurstLineWidth;

  let lineSpacing = 0;
  let y = 0;
  const lineCount: number = shipThurstLineCount;
  if (lineCount !== 1) {
    lineSpacing = (shipWidth - shipThurstLineWidth) / (shipThurstLineCount - 1);
    y = -shipWidth / 2 + shipThurstLineWidth / 2;
  }

  for (let i = 0; i < lineCount; i++) {
    const startX = direction * (shipHeight / 2);
    const endX = startX + direction * length;
    const controlX = (startX + endX) / 2;
    const controlY = y + angleChange * length * direction * shipAnglePower;
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(controlX, controlY, endX, y);
    ctx.stroke();
    y += lineSpacing;
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number = arenaWidth,
  height: number = arenaHeight
): void {
  ctx.save();
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(
    ctx.lineWidth / 2,
    ctx.lineWidth / 2,
    width - ctx.lineWidth,
    height - ctx.lineWidth
  );
  ctx.restore();
}

export function drawBliBlie(
  ctx: CanvasRenderingContext2D,
  bliblie: BliBlieSnapshot,
  image: CanvasImageSource | null
): void {
  ctx.save();
  ctx.translate(bliblie.pos.x, bliblie.pos.y);
  if (image) {
    ctx.drawImage(
      image,
      -bliblieWidth / 2,
      -bliblieHeight / 2,
      bliblieWidth,
      bliblieHeight
    );
  }
  ctx.restore();
}

export function drawMiniRocket(
  ctx: CanvasRenderingContext2D,
  rocket: Pick<MiniRocketSnapshot, 'pos' | 'angle'>
): void {
  ctx.save();
  ctx.translate(rocket.pos.x, rocket.pos.y);
  ctx.rotate(rocket.angle);
  ctx.fillStyle = miniRocketFillStyle;
  ctx.fillRect(
    -miniRocketHeight / 2,
    -miniRocketWidth / 2,
    miniRocketHeight,
    miniRocketWidth
  );
  ctx.fillStyle = miniRocketFlameFillStyle;
  ctx.fillRect(-miniRocketHeight / 2, -miniRocketWidth / 2, 5, miniRocketWidth);
  ctx.restore();
}

export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  explosion: ExplosionSnapshot,
  preparedParticles?: Float32Array
): void {
  ctx.save();
  ctx.translate(explosion.pos.x, explosion.pos.y);
  if (preparedParticles) {
    for (
      let offset = 0, index = 0;
      offset < preparedParticles.length;
      offset += 3, index++
    ) {
      const colorIndex = index % explosionColors.length;
      ctx.fillStyle = explosionColors[colorIndex] ?? explosionColors[0];
      ctx.beginPath();
      ctx.arc(
        preparedParticles[offset] ?? 0,
        preparedParticles[offset + 1] ?? 0,
        preparedParticles[offset + 2] ?? 0,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else {
    for (const [index, particle] of explosion.particles.entries()) {
      const colorIndex = index % explosionColors.length;
      ctx.fillStyle = explosionColors[colorIndex] ?? explosionColors[0];
      ctx.beginPath();
      ctx.arc(particle.pos.x, particle.pos.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawShield(
  ctx: CanvasRenderingContext2D,
  shield: ShieldSnapshot,
  image: CanvasImageSource | null
): void {
  ctx.save();
  ctx.translate(shield.pos.x, shield.pos.y);
  if (image) {
    ctx.drawImage(
      image,
      -shieldWidth / 2,
      -shieldHeight / 2,
      shieldWidth,
      shieldHeight
    );
  }
  ctx.restore();
}

export function drawBarrierShield(
  ctx: CanvasRenderingContext2D,
  entity: PositionedEntity
): void {
  ctx.save();
  ctx.translate(entity.pos.x, entity.pos.y);
  ctx.strokeStyle = barrierShieldStrokeStyle;
  ctx.lineWidth = barrierShieldLineWidth;
  ctx.beginPath();
  ctx.arc(0, 0, entity.radius + barrierShieldAdditionalRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
