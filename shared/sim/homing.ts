import { Vector2 } from './vector.ts';
import { getAngleDelta } from './math.ts';
import type { BehaviorContext } from './entity.ts';
import {
  angleSpeed,
  homingDirectionChangeMultiplier,
} from '../config/settings.ts';
import type { EntityId } from '../codec/binary.ts';

export type HomingEntity = {
  readonly id: EntityId;
  readonly pos: Vector2;
  readonly radius: number;
  angle: number;
};

export function applyHoming(
  entity: HomingEntity, 
  dt: number, 
  context: BehaviorContext
): void {
  const { target, worldEntities = [] } = context;

  if (!target) return;

  const linecount = 3; // left center right
  const rayMaxCheck = 150;

  let direction = target.pos.sub(entity.pos);
  direction = direction.normalize();
  const side = new Vector2(-direction.y, direction.x); // perpendicular to direction

  const obstacles: [number, number, number] = [0, 0, 0]; // 0 - left, 1 - center, 2 - right

  for (let i = 0; i < linecount; i++) {
    const offset = (i - 1) * entity.radius;
    let startPos = entity.pos.add(side.scale(offset));

    for (const current of worldEntities) {
      if (current.id === entity.id || current.id === target.id) {
        continue;
      }

      const objectDirection = current.pos.sub(entity.pos);
      const toCurrent = objectDirection.dot(direction);

      if (toCurrent < 0) {
        continue;
      }

      if (objectDirection.length() > rayMaxCheck) {
        continue;
      }

      let dinPos = startPos;

      for (let check = 0; check < rayMaxCheck; check++) {
        if (circleDotCheck(current, dinPos, entity.radius)) {
          if (i === 0) obstacles[0] = 1;
          if (i === 1) obstacles[1] = 1;
          if (i === 2) obstacles[2] = 1;
          break;
        }

        dinPos = dinPos.add(direction);
      }
    }
  }

  if (obstacles[0] === 1 && obstacles[2] === 1) {
    direction = direction.add(side.scale(3 * homingDirectionChangeMultiplier));
  } else if (obstacles[0] === 1 && obstacles[1] === 1) {
    direction = direction.sub(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[1] === 1 && obstacles[2] === 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[0] === 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[1] === 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[2] === 1) {
    direction = direction.sub(side.scale(homingDirectionChangeMultiplier));
  }

  const targetAngle = Math.atan2(direction.y, direction.x);
  const angleDelta = getAngleDelta(entity.angle, targetAngle);

  const angleStep = ((angleSpeed * Math.PI) / 180) * dt;
  entity.angle += Math.max(-angleStep, Math.min(angleDelta, angleStep));

  function circleDotCheck(a: HomingEntity, dot: Vector2, radius: number): boolean {
    const vectorBetween = a.pos.sub(dot);
    return vectorBetween.length() <= a.radius + radius;
  }
}
