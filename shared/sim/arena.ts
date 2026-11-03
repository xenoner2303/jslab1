import type { Vector2 } from "./vector.ts";

type MovableEntity = {
  readonly pos: Vector2;
  vel: Vector2;
};

type BouncableEntity = MovableEntity & {
  readonly radius: number;
};

export function wrap(ship: MovableEntity, width: number, height: number): void {
  if (ship.pos.x < 0) (ship.pos as { x: number; y: number }).x += width;
  if (ship.pos.x > width) (ship.pos as { x: number; y: number }).x -= width;
  if (ship.pos.y < 0) (ship.pos as { x: number; y: number }).y += height;
  if (ship.pos.y > height) (ship.pos as { x: number; y: number }).y -= height;
}

export function bounce(something: BouncableEntity, width: number, height: number): void {
  const pos = something.pos as { x: number; y: number };
  const vel = something.vel as { x: number; y: number };

  if (pos.x - something.radius < 0) {
    vel.x = Math.abs(vel.x);
    pos.x = something.radius;
  }

  if (pos.x + something.radius > width) {
    vel.x = -Math.abs(vel.x);
    pos.x = width - something.radius;
  }

  if (pos.y - something.radius < 0) {
    vel.y = Math.abs(vel.y);
    pos.y = something.radius;
  }

  if (pos.y + something.radius > height) {
    vel.y = -Math.abs(vel.y);
    pos.y = height - something.radius;
  }
}
