import { describe, expect, it } from "vitest";
import { Vector2 } from "../sim/vector.ts";

describe("Vector2", () => {
  it.each([
    [1, 2, 3, 5],
    [0, 0, 0, 0],
    [-1, 4, 2, 7],
    [10, -5, -2, 8],
    [0.5, 1.25, 1.75, 2.5],
  ])("adds (%s, %s) and (%s, %s)", (ax, ay, bx, by) => {
    expect(new Vector2(ax, ay).add(new Vector2(bx, by))).toEqual(
      new Vector2(ax + bx, ay + by),
    );
  });

  it.each([
    [4, 7, 1, 2, 3, 5],
    [0, 0, 0, 0, 0, 0],
    [-1, 4, 2, 7, -3, -3],
    [10, -5, -2, 8, 12, -13],
    [0.5, 1.25, 1.75, 2.5, -1.25, -1.25],
  ])("subtracts vectors", (ax, ay, bx, by, x, y) => {
    expect(new Vector2(ax, ay).sub(new Vector2(bx, by))).toEqual(
      new Vector2(x, y),
    );
  });

  it.each([
    [1, 2, 0, 0, 0],
    [1, -2, 2, 2, -4],
    [-3, 4, -2, 6, -8],
    [0.5, 2, 0.5, 0.25, 1],
    [10, 0, -0.5, -5, 0],
  ])("scales a vector", (x, y, multiplier, expectedX, expectedY) => {
    const result = new Vector2(x, y).scale(multiplier);
    expect(result.x).toBeCloseTo(expectedX);
    expect(result.y).toBeCloseTo(expectedY);
  });

  it.each([
    [3, 4, 5],
    [0, 0, 0],
    [-3, 4, 5],
    [1, 1, Math.sqrt(2)],
    [0, -2, 2],
  ])("computes vector length", (x, y, length) => {
    expect(new Vector2(x, y).length()).toBeCloseTo(length);
  });

  it.each([
    [0, 0, 0, 0],
    [3, 4, 0.6, 0.8],
    [-3, 4, -0.6, 0.8],
    [0, -2, 0, -1],
    [8, 0, 1, 0],
  ])("normalizes a vector", (x, y, expectedX, expectedY) => {
    const result = new Vector2(x, y).normalize();
    expect(result.x).toBeCloseTo(expectedX);
    expect(result.y).toBeCloseTo(expectedY);
    expect(result.length()).toBeCloseTo(x === 0 && y === 0 ? 0 : 1);
  });

  it.each([
    [1, 0, Math.PI / 2, 0, 1],
    [0, 1, Math.PI, 0, -1],
    [2, 3, 0, 2, 3],
    [-1, 0, Math.PI, 1, 0],
  ])("rotates a vector", (x, y, angle, expectedX, expectedY) => {
    const result = new Vector2(x, y).rotate(angle);
    expect(result.x).toBeCloseTo(expectedX);
    expect(result.y).toBeCloseTo(expectedY);
  });

  it.each([
    [1, 2, 3, 4, 11],
    [1, 0, 0, 1, 0],
    [-1, 3, 4, 2, 2],
  ])("computes dot product", (ax, ay, bx, by, expected) => {
    expect(new Vector2(ax, ay).dot(new Vector2(bx, by))).toBe(expected);
  });

  it.each([
    [0, 1, 0],
    [Math.PI / 2, 0, 1],
    [Math.PI, -1, 0],
    [-Math.PI / 2, 0, -1],
  ])("creates a unit vector from an angle", (angle, x, y) => {
    const result = Vector2.fromAngle(angle);
    expect(result.x).toBeCloseTo(x);
    expect(result.y).toBeCloseTo(y);
  });

  it.each([
    [Number.NaN, 0],
    [0, Number.POSITIVE_INFINITY],
    [Number.NEGATIVE_INFINITY, 0],
  ])("rejects invalid coordinates", (x, y) => {
    expect(() => new Vector2(x, y)).toThrow();
  });

  it("rejects a non-finite multiplier", () => {
    expect(() => new Vector2(1, 2).scale(Number.NaN)).toThrow();
  });

  it("rejects a non-finite rotation", () => {
    expect(() => new Vector2(1, 2).rotate(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("rejects a non-finite angle", () => {
    expect(() => Vector2.fromAngle(Number.NaN)).toThrow();
  });
});
