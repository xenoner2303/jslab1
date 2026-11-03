import { describe, expect, it } from "vitest";
import { bounce, wrap } from "../sim/arena.ts";
import { Vector2 } from "../sim/vector.ts";

describe("arena boundaries", () => {
  it.each([
    [-1, 10, 100, 100, 99, 10],
    [101, 10, 100, 100, 1, 10],
    [10, -1, 100, 100, 10, 99],
    [10, 101, 100, 100, 10, 1],
    [50, 50, 100, 100, 50, 50],
  ])(
    "wraps a ship around arena edges",
    (x, y, width, height, expectedX, expectedY) => {
      const ship = { pos: new Vector2(x, y), vel: new Vector2(1, 2) };
      wrap(ship, width, height);
      expect(ship.pos).toEqual(new Vector2(expectedX, expectedY));
      expect(ship.vel).toEqual(new Vector2(1, 2));
    },
  );

  it("keeps the existing position object when no wrap is needed", () => {
    const pos = new Vector2(50, 50);
    const ship = { pos, vel: new Vector2(0, 0) };
    wrap(ship, 100, 100);
    expect(ship.pos).toBe(pos);
  });

  it.each([
    [-2, 20, -3, 4, 5, 100, 100, 5, 20, 3, 4],
    [98, 20, 3, 4, 5, 100, 100, 95, 20, -3, 4],
    [20, -2, 3, -4, 5, 100, 100, 20, 5, 3, 4],
    [20, 98, 3, 4, 5, 100, 100, 20, 95, 3, -4],
    [20, 20, 3, 4, 5, 100, 100, 20, 20, 3, 4],
  ])(
    "bounces an object off the arena edges",
    (
      x,
      y,
      vx,
      vy,
      radius,
      width,
      height,
      expectedX,
      expectedY,
      expectedVx,
      expectedVy,
    ) => {
      const entity = {
        pos: new Vector2(x, y),
        vel: new Vector2(vx, vy),
        radius,
      };
      bounce(entity, width, height);
      expect(entity.pos.x).toBe(expectedX);
      expect(entity.pos.y).toBe(expectedY);
      expect(entity.vel.x).toBe(expectedVx);
      expect(entity.vel.y).toBe(expectedVy);
    },
  );
});
