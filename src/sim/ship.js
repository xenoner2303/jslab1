import { maxSpeed, angleSpeed, maxThrust, thrustIncrement, thrustDecrement, dragSpeed } from "../../config/settings.js";

const ship = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    thrust: 0
}

function integrate(ship, input, dt) {
    if(input.isJustPressed("KeyA")) {
        console.log("started turning left");
    }
    
    if(input.isJustPressed("KeyD")) {
        console.log("started turning right");
    }

    if(input.isJustPressed("KeyW")) {
        console.log("started moving forward");
    }
    
    if(input.isJustPressed("KeyS")) {
        console.log("started moving backward");
    }

    let inputAngle = 0;
    if (input.isDown("KeyA")) inputAngle -= 1;
    if (input.isDown("KeyD")) inputAngle += 1;

    if (inputAngle < 0) {
        ship.angle -= angleSpeed * Math.PI / 180 * dt;
    }
    else if (inputAngle > 0) {
        ship.angle += angleSpeed * Math.PI / 180 * dt;
    }

    
    ship.thrust = Math.min(ship.thrust + thrustIncrement * dt, maxThrust);

    if(ship.thrust != 0){
        const localVx = ship.vx + Math.cos(ship.angle) * ship.thrust * dt;
        const localVy = ship.vy + Math.sin(ship.angle) * ship.thrust * dt;

        const speed = Math.sqrt(localVx * localVx + localVy * localVy); // velocity vector magnitude

        if(speed > maxSpeed) {
            const scale = maxSpeed / speed;
            ship.vx = localVx * scale;
            ship.vy = localVy * scale;
        } 
        else {
            ship.vx = localVx;
            ship.vy = localVy;
        }
    }
    else{
        drag();
    } 

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    function drag()
    {
        const drag = dragSpeed * dt;

        if (ship.vx > 0) {
            ship.vx = Math.max(0, ship.vx - drag);  
        } 
        else if (ship.vx < 0) {
            ship.vx = Math.min(0, ship.vx + drag);  
        }
        
        if (ship.vy > 0) {
            ship.vy = Math.max(0, ship.vy - drag);  
        } 
        else if (ship.vy < 0) {
            ship.vy = Math.min(0, ship.vy + drag);  
        }
    }
}

export { ship, integrate };
