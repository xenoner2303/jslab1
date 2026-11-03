import { describe, expect, it, vi } from "vitest";
import { Entity } from "../sim/entity.ts";
import { Vector2 } from "../sim/vector.ts";

const makeEntity = () =>
  new Entity(new Vector2(1, 2), new Vector2(3, 4), 5, true, 0, "test");

describe("Entity", () => {
  it("stores constructor state and assigns an id", () => {
    const entity = makeEntity();
    expect(entity.id).toBeGreaterThanOrEqual(0);
    expect(entity.pos).toEqual(new Vector2(1, 2));
    expect(entity.vel).toEqual(new Vector2(3, 4));
    expect(entity.radius).toBe(5);
    expect(entity.alive).toBe(true);
    expect(entity.kind).toBe("test");
  });

  it("rejects position and velocity values that are not Vector2 instances", () => {
    expect(
      () =>
        new Entity(
          { x: 1, y: 2 } as Vector2,
          new Vector2(0, 0),
          1,
          true,
          0,
          "x",
        ),
    ).toThrow(/Vector2/);
    expect(
      () =>
        new Entity(
          new Vector2(0, 0),
          { x: 1, y: 2 } as Vector2,
          1,
          true,
          0,
          "x",
        ),
    ).toThrow(/Vector2/);
  });

  it("rejects non-finite radius and angle", () => {
    expect(
      () =>
        new Entity(
          new Vector2(0, 0),
          new Vector2(0, 0),
          Number.NaN,
          true,
          0,
          "x",
        ),
    ).toThrow(/radius/);
    expect(
      () =>
        new Entity(
          new Vector2(0, 0),
          new Vector2(0, 0),
          1,
          true,
          Number.NaN,
          "x",
        ),
    ).toThrow(/angle/);
  });

  it("runs each behavior while alive", () => {
    const entity = makeEntity();
    const behavior = vi.fn();
    entity.behaviors.push(behavior);
    const context = { target: null };
    entity.update(0.1, context);
    expect(behavior).toHaveBeenCalledWith(entity, 0.1, context);
  });

  it("does not run behaviors after the entity is dead", () => {
    const entity = makeEntity();
    const behavior = vi.fn();
    entity.behaviors.push(behavior);
    entity.alive = false;
    entity.update(0.1);
    expect(behavior).not.toHaveBeenCalled();
  });
});
