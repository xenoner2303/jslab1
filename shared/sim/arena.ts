import { Vector2 } from "./vector.ts";

type MovableEntity = {
  pos: Vector2;
  vel: Vector2;
};

type BouncableEntity = MovableEntity & {
  readonly radius: number;
};

export function wrap(ship: MovableEntity, width: number, height: number): void {
  let x = ship.pos.x;
  let y = ship.pos.y;
  if (x < 0) x += width;
  if (x > width) x -= width;
  if (y < 0) y += height;
  if (y > height) y -= height;
  if (x !== ship.pos.x || y !== ship.pos.y) {
    ship.pos = new Vector2(x, y);
  }
}

export function bounce(something: BouncableEntity, width: number, height: number): void {
  let x = something.pos.x;
  let y = something.pos.y;
  let velX = something.vel.x;
  let velY = something.vel.y;

  if (x - something.radius < 0) {
    velX = Math.abs(velX);
    x = something.radius;
  }

  if (x + something.radius > width) {
    velX = -Math.abs(velX);
    x = width - something.radius;
  }

  if (y - something.radius < 0) {
    velY = Math.abs(velY);
    y = something.radius;
  }

  if (y + something.radius > height) {
    velY = -Math.abs(velY);
    y = height - something.radius;
  }

  if (x !== something.pos.x || y !== something.pos.y) {
    something.pos = new Vector2(x, y);
  }
  if (velX !== something.vel.x || velY !== something.vel.y) {
    something.vel = new Vector2(velX, velY);
  }
}
