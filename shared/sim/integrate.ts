import { Vector2 } from "./vector.ts";
import {
  angleSpeed,
  dragSpeed,
  maxSpeed,
  maxThrust,
  thrustDecrement,
  thrustIncrement,
} from '../config/settings.ts';

export type ShipState = {
  readonly angle: number;
  readonly thrust: number;
  readonly pos: Vector2;
  readonly vel: Vector2;
};

export type ShipInput = {
  readonly turn: number;
  readonly thrust: number;
};

export type IntegratedShipResult = {
  readonly pos: Vector2;
  readonly vel: Vector2;
  readonly angle: number;
  readonly thrust: number;
};

export function integrateShip(
  state: ShipState, 
  input: ShipInput, 
  dt: number
): IntegratedShipResult {
  let angle = state.angle;
  if (input.turn < 0) {
    angle -= ((angleSpeed * Math.PI) / 180) * dt;
  } else if (input.turn > 0) {
    angle += ((angleSpeed * Math.PI) / 180) * dt;
  }

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
    pos: new Vector2(
      state.pos.x + vx * dt,
      state.pos.y + vy * dt
    ),
    vel: new Vector2(vx, vy),
    angle,
    thrust,
  };
}
