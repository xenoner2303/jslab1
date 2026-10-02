import { bulletWidth, bulletHeight, gridSize, bulletLineWidth, bulletFillStyle, bulletStrokeStyle, bulletFrontThurstColor, bulletBackThurstColor, bulletThurstLineWidth, bulletThurstLineCount } from "../../config/settings.js";

function drawShip(ctx, ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y); // переміщуємо початок координат в точку (ship.x, ship.y) - саме перенесе контур корабля який намалювався
    ctx.rotate(ship.angle);

    ctx.fillStyle = bulletFillStyle;
    ctx.strokeStyle = bulletStrokeStyle;
    ctx.lineWidth = bulletLineWidth;
    const bulletRadius = bulletWidth / 2;
    const bulletBodyLength = bulletHeight - bulletRadius;

    ctx.beginPath();
    ctx.moveTo(-bulletHeight / 2, -bulletWidth / 2);

    ctx.lineTo(bulletBodyLength - bulletHeight / 2, -bulletWidth / 2);

    ctx.arc( // ніс кулі
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
    const length = Math.abs(thrust) * 0.5;

    ctx.strokeStyle = thrust > 0 ? bulletFrontThurstColor : bulletBackThurstColor;

    ctx.lineWidth = bulletThurstLineWidth;

    const spaceCount = bulletThurstLineCount + 1;
    const lineSpacing = (bulletWidth - bulletThurstLineCount * bulletThurstLineWidth) / spaceCount;

    let y = -bulletWidth / 2 + lineSpacing + bulletThurstLineWidth / 2;

    for (let i = 0; i < bulletThurstLineCount; i++) {
        const startX = direction * (bulletHeight / 2 + 2);
        const endX = startX + direction * length;

        const controlX = (startX + endX) / 2;
        const controlY = y + angleChange * length * 2;
        
        ctx.beginPath();
        ctx.moveTo(startX, y);

        ctx.quadraticCurveTo(controlX, controlY, endX, y);

        ctx.stroke();

        y += lineSpacing + bulletThurstLineWidth;
    }
}

function drawGrid(ctx, width, height) {
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += gridSize) { // вертикальні
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) { // горизонтальні
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
}

export { drawShip, drawGrid };
