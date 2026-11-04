import { describe, expect, it } from "vitest";
import { getAngleDelta } from "../sim/math.ts";

describe("getAngleDelta", () => {
  it.each([
    [0, Math.PI / 2, Math.PI / 2],
    [Math.PI / 2, 0, -Math.PI / 2],
    [Math.PI - 0.1, -Math.PI + 0.1, 0.2],
    [-Math.PI + 0.1, Math.PI - 0.1, -0.2],
    [1, 1, 0],
  ])(
    "returns the shortest angular difference",
    (previous, current, expected) => {
      expect(getAngleDelta(previous, current)).toBeCloseTo(expected);
    },
  );
});
