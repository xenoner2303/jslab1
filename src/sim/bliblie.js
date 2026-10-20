import {Entity} from "./entity.js"

class BliBlie extends Entity {
  constructor(pos, vel, radius, angle){
    super(pos, vel, radius, true, angle, "bliblie");
  }

  update(dt){
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }
}

export { BliBlie };
