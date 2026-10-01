import { maxSpeed, angleSpeed, maxThrust, thrustIncrement, dragCoefficient } from "../config/settings.js";

const ship = {
    x: 0, // перша координата вікна
    y: 0, // друга координата вікна
    vx: 0, // швидкість по першій координаті
    vy: 0, // швидкість по другій координаті
    angle: 0, // кут повороту
    thrust: 0, // тяга (наскільки сильно розганяється корабель)
}

function integrate(ship, input, dt) { // ship - об'єкт корабля, input - об'єкт вводу, dt - крок часу
    if(input.isJustPressed("KeyA")) {
        console.log("Ship just started turning left"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, стрілку повороту корабля
    }
    
    if (input.isDown("KeyA")) { // -angleSpeed градусів за крок
        ship.angle -= angleSpeed * Math.PI / 180 * dt;
    }

    if(input.isJustPressed("KeyD")) {
        console.log("Ship just started turning right"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, стрілку повороту корабля
    }
    
    if (input.isDown("KeyD")) { // +angleSpeed градусів за крок
        ship.angle += angleSpeed * Math.PI / 180 * dt;
    }

    if(input.isJustPressed("KeyW")) {
        console.log("Ship just started moving forward"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, вогонь з двигуна
    }
    
    if(input.isJustPressed("KeyS")) {
        console.log("Ship just started moving backward"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, вогонь з двигуна
    }

    if (input.isDown("KeyW")) {
        ship.thrust = Math.min(ship.thrust + thrustIncrement * dt, maxThrust);
    }
    
    if (input.isDown("KeyS")) {
        ship.thrust = Math.max(ship.thrust - thrustIncrement * dt, -maxThrust);
    }
    
    if (!input.isDown("KeyW") && !input.isDown("KeyS")) { // якщо клавіші W і S не натиснуті, то тяга корабля поступово зменшується до нуля
        if(ship.thrust > 0) ship.thrust = Math.max(ship.thrust - thrustIncrement * dt, 0);
        if(ship.thrust < 0) ship.thrust = Math.min(ship.thrust + thrustIncrement * dt, 0);
    }

    if(ship.thrust != 0){
        const localVx = ship.vx + Math.cos(ship.angle) * ship.thrust * dt;
        const localVy = ship.vy + Math.sin(ship.angle) * ship.thrust * dt;

        const speed = Math.sqrt(localVx * localVx + localVy * localVy); // модуль вектора швидкості

        if(speed > maxSpeed) {
            const scale = maxSpeed / speed;
            ship.vx = localVx * scale;
            ship.vy = localVy * scale;
        } else {
            ship.vx = localVx;
            ship.vy = localVy;
        }
    }
    else drag();

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    function drag()
    {
        const drag = 1 - dragCoefficient * dt;

        ship.vx *= drag;           
        ship.vy *= drag;   
    }
}

export { ship, integrate };