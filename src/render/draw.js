import {
  gridColor,
  bulletAnglePower,
  bulletThurstMultiplier,
  bulletWidth,
  bulletHeight,
  gridSize,
  bulletLineWidth,
  bulletFillStyle,
  bulletStrokeStyle,
  bulletFrontThurstColor,
  bulletBackThurstColor,
  bulletThurstLineWidth,
  bulletThurstLineCount,
} from '../../config/settings.js';

function drawShip(ctx, ship) {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  ctx.fillStyle = bulletFillStyle;
  ctx.strokeStyle = bulletStrokeStyle;
  ctx.lineWidth = bulletLineWidth;

  const bulletRadius = bulletWidth / 2;
  const bulletBodyLength = bulletHeight - bulletRadius;

  ctx.beginPath();
  ctx.moveTo(-bulletHeight / 2, -bulletWidth / 2);

  ctx.lineTo(bulletBodyLength - bulletHeight / 2, -bulletWidth / 2);

  ctx.arc(
    bulletBodyLength - bulletHeight / 2,
    0,
    bulletRadius,
    -Math.PI / 2,
    Math.PI / 2,
    false
  );

  ctx.lineTo(-bulletHeight / 2, bulletWidth / 2);
  ctx.closePath();

  ctx.fill();
  ctx.stroke();

  if (ship.thrust !== 0) {
    drawBulletThrust(ctx, ship.thrust, ship.angleChange);
  }

  ctx.restore();
}

function drawBulletThrust(ctx, thrust, angleChange) {
  if (thrust === 0) return;

  const direction = thrust > 0 ? -1 : 1;
  const length = Math.abs(thrust) * bulletThurstMultiplier;

  ctx.strokeStyle = thrust > 0 ? bulletFrontThurstColor : bulletBackThurstColor;

  ctx.lineWidth = bulletThurstLineWidth;

  let lineSpacing = 0;
  let y = 0;

  if (bulletThurstLineCount == 1) {
    y = 0;
  } else {
    lineSpacing =
      (bulletWidth - bulletThurstLineWidth) / (bulletThurstLineCount - 1);

    y = -bulletWidth / 2 + bulletThurstLineWidth / 2;
  }

  for (let i = 0; i < bulletThurstLineCount; i++) {
    const startX = direction * (bulletHeight / 2);
    const endX = startX + direction * length;

    const controlX = (startX + endX) / 2;
    const controlY = y + angleChange * length * direction * bulletAnglePower;

    ctx.beginPath();
    ctx.moveTo(startX, y);

    ctx.quadraticCurveTo(controlX, controlY, endX, y);

    ctx.stroke();

    y += lineSpacing;
  }
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += gridSize) {
    // vertical
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += gridSize) {
    // horizontal
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

export { drawShip, drawGrid };
