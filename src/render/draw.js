import { shipWidth, shipHeight } from "../../config/settings.js";

function drawShip(ctx, ship) {
    ctx.save();
    ctx.translate(ship.x, ship.y); // переміщуємо початок координат в точку (ship.x, ship.y) - саме перенесе контур корабля який намалювався
    ctx.rotate(ship.angle);

    ctx.fillStyle = "black";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(shipHeight / 2, 0);
    ctx.lineTo(-shipHeight / 2, -shipWidth / 2);
    ctx.lineTo(-shipHeight / 2, shipWidth / 2);
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

export { drawShip };
