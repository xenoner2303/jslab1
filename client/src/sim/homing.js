import { Vector2 } from './vector.js';
import { getAngleDelta } from '../supFunctions.js';
import {
  angleSpeed,
  homingDirectionChangeMultiplier,
} from '../../config/settings.js';

function applyHoming(entity, dt, context) {
  const { target, worldEntities } = context;

  if (!target || !target.alive) return; // protect for no target on the map

  let linecount = 3; // left center right
  let rayMaxCheck = 150;

  let direction = target.pos.sub(entity.pos);
  direction = direction.normalize();
  const side = new Vector2(-direction.y, direction.x); // perpendicular to direction

  const obstacles = [0, 0, 0]; // 0 - left, 1 - center, 2 - right

  for (let i = 0; i < linecount; i++) {
    const offset = (i - 1) * entity.radius;
    let startPos = entity.pos.add(side.scale(offset));

    for (const current of worldEntities) {
      if (current.id == entity.id || current.id == target.id) {
        continue;
      }

      const objectDirection = current.pos.sub(entity.pos);
      const toCurrent = objectDirection.dot(direction);

      if (toCurrent < 0) {
        continue; // it is not in front to us
      }

      if (objectDirection.length() > rayMaxCheck) {
        // cannot check this right now
        continue;
      }

      let dinPos = startPos;

      for (let check = 0; check < rayMaxCheck; check++) {
        // check for obstacle
        if (circleDotCheck(current, dinPos, entity.radius)) {
          if (i == 0) {
            obstacles[0] = 1;
          }

          if (i == 1) {
            obstacles[1] = 1;
          }

          if (i == 2) {
            obstacles[2] = 1;
          }

          break;
        }

        dinPos = dinPos.add(direction);
      }
    }
  }

  if (obstacles[0] == 1 && obstacles[2] == 1) {
    // all obstacles
    direction = direction.add(side.scale(3 * homingDirectionChangeMultiplier));
  } else if (obstacles[0] == 1 && obstacles[1] == 1) {
    direction = direction.sub(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[1] == 1 && obstacles[2] == 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[0] == 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[1] == 1) {
    direction = direction.add(side.scale(homingDirectionChangeMultiplier));
  } else if (obstacles[2] == 1) {
    direction = direction.sub(side.scale(homingDirectionChangeMultiplier));
  }

  const targetAngle = Math.atan2(direction.y, direction.x);
  const angleDelta = getAngleDelta(entity.angle, targetAngle);

  const angleStep = ((angleSpeed * Math.PI) / 180) * dt;
  entity.angle += Math.max(-angleStep, Math.min(angleDelta, angleStep)); // correct with neg - pos delta

  function circleDotCheck(a, dot, radius) {
    const vectorBetween = a.pos.sub(dot);

    return vectorBetween.length() <= a.radius + radius;
  }
}

export { applyHoming };
