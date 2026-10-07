import {Entity} from "./entity.js"

import { rocketTtl } from '../../config/settings.js';

class MiniRocket extends Entity {
  #ttl = explosionTtl;

  constructor(pos, vel, radius, angle, kind, owner){
    super(pos, vel, radius, true, angle, kind);

    this.owner = owner;
  }

  update(dt){
    this.#ttl -= dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    if(this.#ttl <= 0){
        this.alive = false;
    }
  }
}

export { MiniRocket };
