import { Entity } from './entity.js';

import {
  maxShipHp,
  shipRespawnTime,
} from '../config/settings.js';
import { Vector2 } from './vector.js';
import { integrateShip } from './integrate.js';

class Ship extends Entity {
  #hp = 0;
  #respawnTimer = 0;

  constructor(pos, vel, radius, angle, input, playerName) {
    super(pos, vel, radius, true, angle, 'mainShip');

    this.thrust = 0;
    this.input = input;
    this.fireRequested = false;
    this.#hp = maxShipHp;
    this.score = 0;
    this.hasShield = false;
    this.playerName = playerName;
  }

  get hp() {
    return this.#hp;
  }

  hit(amount) {
    if (this.hasShield) {
      this.hasShield = false;
      return false;
    }

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

  updateRespawn(dt) {
    // respawn timer
    if (this.alive) return false;

    this.#respawnTimer -= dt;

    if (this.#respawnTimer <= 0) {
      this.#hp = maxShipHp;
      this.alive = true;
      return true;
    }

    return false;
  }

  update(dt, context) {
    if (!this.alive) return;

    super.update(dt, context);

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

    const movementInput = {
      turn:
        Number(this.input.isDown('KeyD')) -
        Number(this.input.isDown('KeyA')),
      thrust:
        Number(this.input.isDown('KeyW')) -
        Number(this.input.isDown('KeyS')),
    };
    const nextState = integrateShip(
      { pos: this.pos, vel: this.vel, angle: this.angle, thrust: this.thrust },
      movementInput,
      dt
    );

    this.pos.x = nextState.pos.x;
    this.pos.y = nextState.pos.y;
    this.vel.x = nextState.vel.x;
    this.vel.y = nextState.vel.y;
    this.angle = nextState.angle;
    this.thrust = nextState.thrust;
  }
}

export { Ship };
