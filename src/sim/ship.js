import {Entity} from "./entity.js"

import {
  maxSpeed,
  angleSpeed,
  maxThrust,
  thrustIncrement,
  thrustDecrement,
  dragSpeed,
  maxShipHp,
  shipRespawnTime
} from '../../config/settings.js';
import { Vector2 } from "./vector.js";

class Ship extends Entity {
  #hp = 0;
  #respawnTimer = 0;

  constructor(pos, vel, radius, angle, kind, input){
    super(pos, vel, radius, true, angle, kind);

    this.thrust = 0;
    this.input = input;
    this.fireRequested = false;
    this.#hp = maxShipHp;
    this.score = 0;
  }

  get hp(){
    return this.#hp;
  }

  hit(amount) {
    this.#hp -= amount;

    if (this.#hp <= 0) {
        this.#hp = 0;
        this.alive = false;
        this.#respawnTimer = shipRespawnTime;
        this.vel = new Vector2(0, 0);

        return true;
    }

    return false;
  }

  updateRespawn(dt) { // respawn timer
    if (this.alive) return false;

    this.#respawnTimer -= dt;

    if (this.#respawnTimer <= 0) {
        this.#hp = maxShipHp;
        this.alive = true;
        return true;
    }

    return false;
  }

  #drag(dt) {
    const dragAmount = dragSpeed * dt;

    if (this.vel.x > 0) {
      this.vel.x = Math.max(0, this.vel.x - dragAmount);
    } 
    else if (this.vel.x < 0) {
      this.vel.x = Math.min(0, this.vel.x + dragAmount);
    }

    if (this.vel.y > 0) {
      this.vel.y = Math.max(0, this.vel.y - dragAmount);
    } 
    else if (this.vel.y < 0) {
      this.vel.y = Math.min(0, this.vel.y + dragAmount);
    }
  }
  
  update(dt) {
    if (!this.alive) return;

    if (this.input.isJustPressed('Space')) {
      this.fireRequested = true;
    }

    if (this.input.isJustPressed('KeyA')) {
      console.log('started turning left');
    }

    if (this.input.isJustPressed('KeyD')) {
      console.log('started turning right');
    }

    if (this.input.isJustPressed('KeyW')) {
      console.log('started moving forward');
    }

    if (this.input.isJustPressed('KeyS')) {
      console.log('started moving backward');
    }

    let inputAngle = 0;
    if (this.input.isDown('KeyA')) inputAngle -= 1;
    if (this.input.isDown('KeyD')) inputAngle += 1;

    if (inputAngle < 0) {
      this.angle -= ((angleSpeed * Math.PI) / 180) * dt;
    } 
    else if (inputAngle > 0) {
      this.angle += ((angleSpeed * Math.PI) / 180) * dt;
    }

    let inputThrust = 0;
    if (this.input.isDown('KeyW')) inputThrust += 1;
    if (this.input.isDown('KeyS')) inputThrust -= 1;

    if (inputThrust > 0) {
      this.thrust = Math.min(this.thrust + thrustIncrement * dt, maxThrust);
    } 
    else if (inputThrust < 0) {
      this.thrust = Math.max(this.thrust - thrustIncrement * dt, -maxThrust);
    } 
    else {
      if (this.thrust > 0) {
        this.thrust = Math.max(this.thrust - thrustDecrement * dt, 0);
      } 
      else if (this.thrust < 0) {
        this.thrust = Math.min(this.thrust + thrustDecrement * dt, 0);
      }
    }

  if (this.thrust != 0) {
    const localVx = this.vel.x + Math.cos(this.angle) * this.thrust * dt;
    const localVy = this.vel.y + Math.sin(this.angle) * this.thrust * dt;

    const speed = Math.sqrt(localVx * localVx + localVy * localVy); // velocity vector magnitude

    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      this.vel.x = localVx * scale;
      this.vel.y = localVy * scale;
    } 
    else {
      this.vel.x = localVx;
      this.vel.y = localVy;
    }
  } 
  else {
    this.#drag(dt);
  }

  this.pos.x += this.vel.x * dt;
  this.pos.y += this.vel.y * dt;
}
}

export { Ship };
