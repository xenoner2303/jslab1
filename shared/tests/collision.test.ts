import { describe, expect, it } from "vitest";
import {
  checkSpot,
  circleCheck,
  entitiesCollision,
  sweptCircleCheck,
} from "../sim/collision.ts";
import { Vector2 } from "../sim/vector.ts";

const circle = (x: number, y: number, radius: number) => ({
  pos: new Vector2(x, y),
  radius,
});

describe("circle collisions", () => {
  it.each([
    [0, 0, 1, 2, 0, 1, true],
    [0, 0, 1, 2.01, 0, 1, false],
    [0, 0, 2, 0.5, 0, 1, true],
    [0, 0, 0, 0, 0, 0, true],
    [-2, 0, 1, 2, 0, 1, false],
  ])("checks contact and overlap", (ax, ay, ar, bx, by, br, expected) => {
    expect(circleCheck(circle(ax, ay, ar), circle(bx, by, br))).toBe(expected);
  });

  it("detects fast objects that cross a target between frames", () => {
    const target = circle(0, 0, 2);
    const bulletAtEnd = circle(5, 0, 1);

    expect(circleCheck(target, bulletAtEnd)).toBe(false);
    expect(
      sweptCircleCheck(
        target,
        bulletAtEnd,
        new Vector2(0, 0),
        new Vector2(-5, 0),
      ),
    ).toBe(true);
  });

  it("detects two moving circles using their relative movement", () => {
    expect(
      sweptCircleCheck(
        circle(10, 0, 1),
        circle(0, 0, 1),
        new Vector2(0, 0),
        new Vector2(10, 0),
      ),
    ).toBe(true);
  });

  it("does not report a swept collision when paths remain apart", () => {
    expect(
      sweptCircleCheck(
        circle(10, 0, 1),
        circle(0, 5, 1),
        new Vector2(0, 0),
        new Vector2(10, 5),
      ),
    ).toBe(false);
  });

  it("handles stationary swept circles", () => {
    expect(
      sweptCircleCheck(
        circle(0, 0, 1),
        circle(1, 0, 1),
        new Vector2(0, 0),
        new Vector2(1, 0),
      ),
    ).toBe(true);
  });

  it("finds each overlapping pair once", () => {
    const entities = [circle(0, 0, 2), circle(1, 0, 2), circle(2, 0, 2)];
    expect(entitiesCollision(entities)).toEqual([
      [entities[0], entities[1]],
      [entities[0], entities[2]],
      [entities[1], entities[2]],
    ]);
  });

  it.each([{ entities: [] }, { entities: [circle(0, 0, 1)] }])(
    "returns no pairs with fewer than two entities",
    ({ entities }) => {
      expect(entitiesCollision(entities)).toEqual([]);
    },
  );

  it("does not report pairs that are far apart", () => {
    expect(entitiesCollision([circle(0, 0, 1), circle(10, 0, 1)])).toEqual([]);
  });

  it("uses previous positions to include swept pairs", () => {
    const a = { ...circle(0, 0, 1), id: 1 };
    const b = { ...circle(5, 0, 1), id: 2 };
    const previous = new Map<object, Vector2>([
      [a, new Vector2(0, 0)],
      [b, new Vector2(-5, 0)],
    ]);

    expect(entitiesCollision([a, b], previous)).toEqual([[a, b]]);
  });

  it("checks a free spot when there are no other circles", () => {
    expect(checkSpot(new Vector2(0, 0), 5, [])).toBe(true);
  });

  it.each([
    [0, 0, 2, 3, false],
    [0, 0, 2, 3.01, true],
    [10, 10, 1, 3, true],
    [-4, 0, 2, 3, true],
  ])(
    "checks whether a spot overlaps an entity",
    (x, y, radius, gap, expected) => {
      expect(checkSpot(new Vector2(x, y), radius, [circle(gap, 0, 1)])).toBe(
        expected,
      );
    },
  );
});
