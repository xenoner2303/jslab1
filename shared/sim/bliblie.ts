import type { Vector2 } from "./vector.ts";
import { Entity } from './entity.ts'; 

export class BliBlie extends Entity {
  constructor(pos: Vector2, vel: Vector2, radius: number, angle: number) {
    super(pos, vel, radius, true, angle, 'bliblie');
  }

  update(dt: number): void {
    this.pos = this.pos.add(this.vel.scale(dt));
  }
}
