import {Entity} from "./entity.js"

class BliBlie extends Entity {
  constructor(pos, vel, radius, angle, kind){
    super(pos, vel, radius, true, angle, kind);
  }

  update(dt){
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
}

export { BliBlie };
