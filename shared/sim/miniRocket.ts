import { Entity } from './entity.ts';
import { Vector2 } from './vector.ts';
import type { BehaviorContext } from './entity.ts';
import {
  miniRocketHeight,
  miniRocketSpeed,
  miniRocketWidth,
  rocketTtl,
} from '../config/settings.ts';
import type { Seq } from '../codec/binary.ts';

export type ShipLaunchSource = {
  readonly angle: number;
  readonly radius: number;
  readonly pos: Vector2;
};

export type RocketLaunchState = {
  readonly pos: Vector2;
  readonly vel: Vector2;
  readonly radius: number;
  readonly angle: number;
};

export function getMiniRocketLaunchState(ship: ShipLaunchSource): RocketLaunchState {
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

export class MiniRocket extends Entity {
  #ttl: number = rocketTtl;
  public owner: unknown;
  public fireSeq: Seq | null;

  constructor(
    pos: Vector2, 
    vel: Vector2, 
    radius: number, 
    angle: number, 
    owner: unknown, 
    fireSeq: Seq | null = null
  ) {
    super(pos, vel, radius, true, angle, 'miniRocket');

    this.owner = owner;
    this.fireSeq = fireSeq;
  }

  update(dt: number, context: BehaviorContext = {}): void {
    if (!this.alive) return;

    super.update(dt, context);

    const direction = Vector2.fromAngle(this.angle);
    this.vel = direction.scale(miniRocketSpeed);

    this.#ttl -= dt;

    this.pos = this.pos.add(this.vel.scale(dt));

    if (this.#ttl <= 0) {
      this.alive = false;
    }
  }
}
