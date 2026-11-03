import type { EntityId } from "../codec/binary.ts";
import { Vector2 } from "./vector.ts";

export type BehaviorContext = {
  target?: Entity | null;
  worldEntities?: Iterable<Entity>;
};
export type BehaviorFn = (
  entity: Entity,
  dt: number,
  context: BehaviorContext,
) => void;

export class Entity {
  static #idNum = 0;

  public readonly id: EntityId;
  public pos: Vector2;
  public vel: Vector2;
  public radius: number;
  public alive: boolean;
  public kind: string;
  public angle: number;
  public behaviors: BehaviorFn[];

  constructor(
    pos: Vector2, 
    vel: Vector2, 
    radius: number, 
    alive: boolean, 
    angle: number, 
    kind: string
  ) {
    if (!(pos instanceof Vector2) || !(vel instanceof Vector2)) {
      throw new Error('pos or vel is not Vector2');
    }

    if (!Number.isFinite(radius)) {
      throw new Error('Trying to create entity with no num radius');
    }

    if (!Number.isFinite(angle)) {
      throw new Error('Trying to create entity with no num angle');
    }

    if (typeof alive !== 'boolean') {
      throw new Error('alive is not bool');
    }

    this.id = Entity.#idNum++ as EntityId;
    this.pos = pos;
    this.vel = vel;
    this.radius = radius;
    this.alive = alive;
    this.kind = kind;
    this.angle = angle;
    this.behaviors = [];
  }

  update(dt: number, context: BehaviorContext = {}): void {
    if (!this.alive) return;

    for (const behavior of this.behaviors) {
      behavior(this, dt, context);
    }
  }
}
