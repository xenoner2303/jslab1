import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import {
  miniRocketHeight,
  miniRocketSpeed,
  miniRocketWidth,
  rocketTtl,
} from '../config/settings.js';

function getMiniRocketLaunchState(ship) {
  const direction = Vector2.fromAngle(ship.angle);
  const radius = Math.sqrt(miniRocketWidth ** 2 + miniRocketHeight ** 2) / 2;
  const spawnDistance = ship.radius + radius + 2;

  return {
    pos: new Vector2(
      ship.pos.x + direction.x * spawnDistance,
      ship.pos.y + direction.y * spawnDistance
    ),
    vel: direction.scale(miniRocketSpeed),
    radius,
    angle: ship.angle,
  };
}

class MiniRocket extends Entity {
  #ttl = rocketTtl;

  constructor(pos, vel, radius, angle, owner, fireSeq = null) {
    super(pos, vel, radius, true, angle, 'miniRocket');

    this.owner = owner;
    this.fireSeq = fireSeq;
  }

  update(dt, context) {
    if (!this.alive) return;

    super.update(dt, context);

    const direction = Vector2.fromAngle(this.angle); // for direction
    this.vel = direction.scale(miniRocketSpeed);

    this.#ttl -= dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    if (this.#ttl <= 0) {
      this.alive = false;
    }
  }
}

export { MiniRocket, getMiniRocketLaunchState };
