import {
  angleSpeed,
  dragSpeed,
  maxSpeed,
  maxThrust,
  thrustDecrement,
  thrustIncrement,
} from '../config/settings.js';

export function integrateShip(state, input, dt) {
  let angle = state.angle;
  if (input.turn < 0) {
    angle -= ((angleSpeed * Math.PI) / 180) * dt;
  } else if (input.turn > 0) {
    angle += ((angleSpeed * Math.PI) / 180) * dt;
  }

  angle += (Math.random() - 0.5) * 0.05; // only for lr

  let thrust = state.thrust;
  if (input.thrust > 0) {
    thrust = Math.min(thrust + thrustIncrement * dt, maxThrust);
  } else if (input.thrust < 0) {
    thrust = Math.max(thrust - thrustIncrement * dt, -maxThrust);
  } else if (thrust > 0) {
    thrust = Math.max(thrust - thrustDecrement * dt, 0);
  } else if (thrust < 0) {
    thrust = Math.min(thrust + thrustDecrement * dt, 0);
  }

  let vx = state.vel.x;
  let vy = state.vel.y;
  if (thrust !== 0) {
    const nextVx = vx + Math.cos(angle) * thrust * dt;
    const nextVy = vy + Math.sin(angle) * thrust * dt;
    const speed = Math.sqrt(nextVx * nextVx + nextVy * nextVy);

    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      vx = nextVx * scale;
      vy = nextVy * scale;
    } else {
      vx = nextVx;
      vy = nextVy;
    }
  } else {
    const dragAmount = dragSpeed * dt;
    if (vx > 0) vx = Math.max(0, vx - dragAmount);
    else if (vx < 0) vx = Math.min(0, vx + dragAmount);
    if (vy > 0) vy = Math.max(0, vy - dragAmount);
    else if (vy < 0) vy = Math.min(0, vy + dragAmount);
  }

  return {
    pos: {
      x: state.pos.x + vx * dt,
      y: state.pos.y + vy * dt,
    },
    vel: { x: vx, y: vy },
    angle,
    thrust,
  };
}
