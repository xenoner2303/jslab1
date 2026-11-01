import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { rocketTtl, miniRocketSpeed } from '../../config/settings.js';

class MiniRocket extends Entity {
  #ttl = rocketTtl;

  constructor(pos, vel, radius, angle, owner) {
    super(pos, vel, radius, true, angle, 'miniRocket');

    this.owner = owner;
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

export { MiniRocket };
