import { Vector2 } from "./vector.ts";

export type Collidable = {
  pos: Vector2;
  radius: number;
};

export function circleCheck(a: Collidable, b: Collidable): boolean {
  const vectorBetween = a.pos.sub(b.pos);
  return vectorBetween.length() <= a.radius + b.radius;
}

export function entitiesCollision<T extends Collidable>(entities: readonly T[]): [T, T][] {
  if (entities.length <= 1) return [];

  const collisions: [T, T][] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      if (a && b && circleCheck(a, b)) {
        collisions.push([a, b]);
      }
    }
  }

  return collisions;
}

export function checkSpot(position: Vector2, radius: number, entities: readonly Collidable[]): boolean {
  for (const entity of entities) {
    const distance = position.sub(entity.pos).length();

    if (distance <= radius + entity.radius) {
      return false;
    }
  }

  return true;
}
