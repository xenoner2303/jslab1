import { Vector2 } from "./vector.ts";

export type Collidable = {
  pos: Vector2;
  radius: number;
};

export function sweptCircleCheck(
  a: Collidable,
  b: Collidable,
  previousA: Vector2,
  previousB: Vector2,
): boolean {
  const start = previousA.sub(previousB);
  const end = a.pos.sub(b.pos);
  const movement = end.sub(start);
  const movementLengthSquared = movement.dot(movement);
  const closestTime =
    movementLengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, -start.dot(movement) / movementLengthSquared));
  const closest = start.add(movement.scale(closestTime));
  const radius = a.radius + b.radius;

  return closest.dot(closest) <= radius * radius;
}

export function circleCheck(a: Collidable, b: Collidable): boolean {
  const vectorBetween = a.pos.sub(b.pos);
  return vectorBetween.length() <= a.radius + b.radius;
}

export function entitiesCollision<T extends Collidable>(entities: readonly T[], previousPositions?: ReadonlyMap<object, Vector2>): [T, T][] {
  if (entities.length <= 1) return [];

  const collisions: [T, T][] = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      const previousA = a ? previousPositions?.get(a) : undefined;
      const previousB = b ? previousPositions?.get(b) : undefined;
      if (
        a &&
        b &&
        (circleCheck(a, b) ||
          (previousA &&
            previousB &&
            sweptCircleCheck(a, b, previousA, previousB)))
      ) {
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
