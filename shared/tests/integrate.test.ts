import { describe, expect, it } from "vitest";
import { integrateShip } from "../sim/integrate.ts";
import { Vector2 } from "../sim/vector.ts";
import { maxSpeed, maxThrust } from "../config/settings.ts";

const state = (
  overrides: Partial<{
    pos: Vector2;
    vel: Vector2;
    angle: number;
    thrust: number;
  }> = {},
) => ({
  pos: new Vector2(100, 100),
  vel: new Vector2(0, 0),
  angle: 0,
  thrust: 0,
  ...overrides,
});

describe("integrateShip", () => {
  it("leaves a stationary ship unchanged with no input", () => {
    const result = integrateShip(state(), { turn: 0, thrust: 0 }, 1 / 30);
    expect(result.pos).toEqual(new Vector2(100, 100));
    expect(result.vel).toEqual(new Vector2(0, 0));
    expect(result.angle).toBe(0);
    expect(result.thrust).toBe(0);
  });

  it("accelerates forward in the facing direction", () => {
    const result = integrateShip(state(), { turn: 0, thrust: 1 }, 1);
    expect(result.vel.x).toBeGreaterThan(0);
    expect(result.vel.y).toBeCloseTo(0);
    expect(result.pos.x).toBeGreaterThan(100);
    expect(result.thrust).toBe(20);
  });

  it("accelerates backward on negative thrust", () => {
    expect(integrateShip(state(), { turn: 0, thrust: -1 }, 1).thrust).toBe(-20);
  });

  it("turns left and right at the configured angular speed", () => {
    expect(
      integrateShip(state(), { turn: -1, thrust: 0 }, 1).angle,
    ).toBeCloseTo(-Math.PI / 2);
    expect(integrateShip(state(), { turn: 1, thrust: 0 }, 1).angle).toBeCloseTo(
      Math.PI / 2,
    );
  });

  it("caps forward and reverse thrust", () => {
    expect(
      integrateShip(state({ thrust: maxThrust }), { turn: 0, thrust: 1 }, 1)
        .thrust,
    ).toBe(maxThrust);
    expect(
      integrateShip(state({ thrust: -maxThrust }), { turn: 0, thrust: -1 }, 1)
        .thrust,
    ).toBe(-maxThrust);
  });

  it("caps total ship speed", () => {
    const result = integrateShip(
      state({ vel: new Vector2(maxSpeed, 0) }),
      { turn: 0, thrust: 1 },
      1,
    );
    expect(result.vel.length()).toBeCloseTo(maxSpeed);
  });

  it("applies drag to both velocity axes when thrust is released", () => {
    const result = integrateShip(
      state({ vel: new Vector2(10, -10), thrust: 0 }),
      { turn: 0, thrust: 0 },
      0.1,
    );
    expect(result.vel).toEqual(new Vector2(6, -6));
  });

  it("does not let drag reverse a velocity component", () => {
    const result = integrateShip(
      state({ vel: new Vector2(1, -1) }),
      { turn: 0, thrust: 0 },
      1,
    );
    expect(result.vel).toEqual(new Vector2(0, 0));
  });

  it("decays positive and negative thrust toward zero", () => {
    expect(
      integrateShip(state({ thrust: 2 }), { turn: 0, thrust: 0 }, 0.1).thrust,
    ).toBe(0);
    expect(
      integrateShip(state({ thrust: -2 }), { turn: 0, thrust: 0 }, 0.1).thrust,
    ).toBe(0);
  });

  it("uses the updated angle to accelerate", () => {
    const result = integrateShip(state(), { turn: 1, thrust: 1 }, 0.5);
    expect(result.vel.y).toBeGreaterThan(0);
    expect(result.angle).toBeCloseTo(Math.PI / 4);
  });

  it("returns new vectors without mutating the input state", () => {
    const initial = state();
    const result = integrateShip(initial, { turn: 0, thrust: 1 }, 1 / 30);
    expect(result.pos).not.toBe(initial.pos);
    expect(result.vel).not.toBe(initial.vel);
    expect(initial.pos).toEqual(new Vector2(100, 100));
  });
});
