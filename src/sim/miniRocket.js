import {Entity} from "./entity.js"

import { rocketTtl } from '../../config/settings.js';

class MiniRocket extends Entity {
  constructor(pos, vel, radius, angle, kind){
    super(pos, vel, radius, true, angle, kind);

    this.innerTtl = rocketTtl;
  }

  update(dt){
    this.innerTtl -= dt;

    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    if(this.innerTtl <= 0){
        this.alive = false;
    }
  }
}

export { MiniRocket };
