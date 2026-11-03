import { Entity } from './entity.ts';
import { Vector2 } from './vector.ts';

export class Pickup extends Entity {
  public effect: string;

  constructor(pos: Vector2, radius: number, effect: string) {
    super(pos, new Vector2(0, 0), radius, true, 0, 'pickup');
    this.effect = effect;
  }
}
