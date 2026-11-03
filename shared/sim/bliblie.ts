import type { Vector2 } from "./vector.ts";
import { Entity } from './entity.ts'; 

export class BliBlie extends Entity {
  constructor(pos: Vector2, vel: Vector2, radius: number, angle: number) {
    super(pos, vel, radius, true, angle, 'bliblie');
  }

  update(dt: number): void {
    const pos = this.pos as { x: number; y: number };
    pos.x += this.vel.x * dt;
    pos.y += this.vel.y * dt;
  }
}
