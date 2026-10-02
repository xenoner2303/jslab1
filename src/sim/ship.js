import { maxSpeed, angleSpeed, maxThrust, thrustIncrement, thrustDecrement, dragSpeed } from "../../config/settings.js";

const ship = {
    x: 0, // перша координата вікна
    y: 0, // друга координата вікна
    vx: 0, // швидкість по першій координаті
    vy: 0, // швидкість по другій координаті
    angle: 0, // кут повороту
    thrust: 0, // тяга (прискорення)
}

function integrate(ship, input, dt) { // ship - об'єкт корабля, input - об'єкт вводу, dt - тривалість кроку симуляції в секундах
    if(input.isJustPressed("KeyA")) {
        console.log("Ship just started turning left"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, стрілку повороту корабля
    }
    
    if(input.isJustPressed("KeyD")) {
        console.log("Ship just started turning right"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, стрілку повороту корабля
    }

    if(input.isJustPressed("KeyW")) {
        console.log("Ship just started moving forward"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, вогонь з двигуна
    }
    
    if(input.isJustPressed("KeyS")) {
        console.log("Ship just started moving backward"); // ідея для того, щоб підкрутити певну анімацію при натисканні клавіші, наприклад, вогонь з двигуна
    }

    let inputAngle = 0;
    if (input.isDown("KeyA")) inputAngle -= 1;
    if (input.isDown("KeyD")) inputAngle += 1;

    if (inputAngle < 0) { // ми можемо повертатися лише в 1 сторону одночасно
        ship.angle -= angleSpeed * Math.PI / 180 * dt;
    }
    else if (inputAngle > 0) {
        ship.angle += angleSpeed * Math.PI / 180 * dt;
    }

    let inputThrust = 0;
    if (input.isDown("KeyW")) inputThrust += 1;
    if (input.isDown("KeyS")) inputThrust -= 1;

    if (inputThrust > 0) {
        ship.thrust = Math.min(ship.thrust + thrustIncrement * dt, maxThrust);
    }
    else if (inputThrust < 0) {
        ship.thrust = Math.max(ship.thrust - thrustIncrement * dt, -maxThrust);
    }
    else{ // якщо клавіша W або S не натиснута, або затиснуті обидві клавіші, то тяга корабля зменшується до 0
        if(ship.thrust > 0) {
            ship.thrust = Math.max(ship.thrust - thrustDecrement * dt, 0);
        }
        else if(ship.thrust < 0) {
            ship.thrust = Math.min(ship.thrust + thrustDecrement * dt, 0);
        }
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
    else{
        console.log("applying drag");
        drag();
    } 

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    function drag()
    {
        const drag = dragSpeed * dt;

        if (ship.vx > 0) {
            ship.vx = Math.max(0, ship.vx - drag);  
        } else if (ship.vx < 0) {
            ship.vx = Math.min(0, ship.vx + drag);  
        }
        
        if (ship.vy > 0) {
            ship.vy = Math.max(0, ship.vy - drag);  
        } else if (ship.vy < 0) {
            ship.vy = Math.min(0, ship.vy + drag);  
        }
    }
}

export { ship, integrate };
