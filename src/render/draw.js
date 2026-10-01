import { shipWidth, shipHeight } from "../config/settings.js";

function drawShip(ctx, ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y); // переміщуємо початок координат в точку (ship.x, ship.y) - саме перенесе контур корабля який намалювався
    ctx.rotate(ship.angle);

    ctx.beginPath();
    ctx.moveTo(0, 0); // локальні координати корабля
    ctx.lineTo(shipWidth / 2, -shipHeight / 2);
    ctx.lineTo(-shipWidth / 2, -shipHeight / 2);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

export { drawShip };
