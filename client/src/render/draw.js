import {
  gridColor,
  shipAnglePower,
  shipThurstMultiplier,
  shipWidth,
  shipHeight,
  gridSize,
  shipFrontThurstColor,
  shipBackThurstColor,
  shipThurstLineWidth,
  shipThurstLineCount,
  miniRocketHeight,
  miniRocketWidth,
  miniRocketFillStyle,
  miniRocketFlameFillStyle,
  explosionColors,
  barrierShieldAdditionalRadius,
  barrierShieldStrokeStyle,
  barrierShieldLineWidth,
  shieldWidth,
  shieldHeight,
  bliblieWidth,
  bliblieHeight,
} from '../../config/settings.js';

function drawShip(ctx, ship, shipImg) {
  ctx.save();
  ctx.translate(ship.x, ship.y);

  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.fillText(ship.playerName, 0, -shipHeight / 2 - 10);

  ctx.rotate(ship.angle);

  if (shipImg) {
    ctx.drawImage(
      shipImg,
      -shipHeight / 2,
      -shipWidth / 2,
      shipHeight,
      shipWidth
    );
  }

  if (ship.thrust !== 0) {
    drawBulletThrust(ctx, ship.thrust, ship.angleChange);
  }

  ctx.restore();
}

function drawBulletThrust(ctx, thrust, angleChange) {
  if (thrust === 0) return;

  const direction = thrust > 0 ? -1 : 1;
  const length = Math.abs(thrust) * shipThurstMultiplier;

  ctx.strokeStyle = thrust > 0 ? shipFrontThurstColor : shipBackThurstColor;

  ctx.lineWidth = shipThurstLineWidth;

  let lineSpacing = 0;
  let y = 0;

  if (shipThurstLineCount == 1) {
    y = 0;
  } else {
    lineSpacing = (shipWidth - shipThurstLineWidth) / (shipThurstLineCount - 1);

    y = -shipWidth / 2 + shipThurstLineWidth / 2;
  }

  for (let i = 0; i < shipThurstLineCount; i++) {
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

function drawBliBlie(ctx, bliblie, bliblieImg) {
  ctx.save();
  ctx.translate(bliblie.pos.x, bliblie.pos.y);

  if (bliblieImg) {
    ctx.drawImage(
      bliblieImg,
      -bliblieWidth / 2,
      -bliblieHeight / 2,
      bliblieWidth,
      bliblieHeight
    );
  }

  ctx.restore();
}

function drawMiniRocket(ctx, rocket) {
  ctx.save();

  ctx.translate(rocket.pos.x, rocket.pos.y);
  ctx.rotate(rocket.angle);

  // body
  ctx.fillStyle = miniRocketFillStyle;
  ctx.fillRect(
    -miniRocketHeight / 2,
    -miniRocketWidth / 2,
    miniRocketHeight,
    miniRocketWidth
  );

  // flame
  ctx.fillStyle = miniRocketFlameFillStyle;
  ctx.fillRect(-miniRocketHeight / 2, -miniRocketWidth / 2, 5, miniRocketWidth);

  ctx.restore();
}

function drawExplosion(ctx, explosion) {
  ctx.save();
  ctx.translate(explosion.pos.x, explosion.pos.y);

  for (let i = 0; i < explosion.particles.length; i++) {
    const particle = explosion.particles[i];

    ctx.fillStyle = explosionColors[i % explosionColors.length];

    ctx.beginPath();

    ctx.arc(particle.pos.x, particle.pos.y, particle.radius, 0, Math.PI * 2);

    ctx.fill();
  }

  ctx.restore();
}

function drawShield(ctx, shield, shieldImg) {
  ctx.save();
  ctx.translate(shield.pos.x, shield.pos.y);

  if (shieldImg) {
    ctx.drawImage(
      shieldImg,
      -shieldWidth / 2,
      -shieldHeight / 2,
      shieldWidth,
      shieldHeight
    );
  }

  ctx.restore();
}

function drawBarrierShield(ctx, entity) {
  ctx.save();

  ctx.translate(entity.pos.x, entity.pos.y);
  ctx.strokeStyle = barrierShieldStrokeStyle;
  ctx.lineWidth = barrierShieldLineWidth;

  ctx.beginPath();
  ctx.arc(0, 0, entity.radius + barrierShieldAdditionalRadius, 0, Math.PI * 2); // x, y, radius, startAngle, endAngle

  ctx.stroke();
  ctx.restore();
}

export {
  drawShip,
  drawGrid,
  drawBliBlie,
  drawMiniRocket,
  drawExplosion,
  drawShield,
  drawBarrierShield,
};
