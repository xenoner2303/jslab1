import { describe, expect, it, vi } from "vitest";
import { World } from "../sim/world.ts";
import { Vector2 } from "../sim/vector.ts";
import { Ship, type ShipInputHandler } from "../sim/ship.ts";
import { BliBlie } from "../sim/bliblie.ts";
import { Pickup } from "../sim/pickup.ts";
import { MiniRocket } from "../sim/miniRocket.ts";
import { Entity } from "../sim/entity.ts";
import { SeqSchema } from "../protocol.ts";
import { Explosion } from "../sim/explosion.ts";

function inputHandler({
  thrust = 0,
  turn = 0,
  fire = false,
}: {
  thrust?: number;
  turn?: number;
  fire?: boolean;
} = {}): ShipInputHandler {
  let pendingFire = fire;
  return {
    isDown(code) {
      if (code === "KeyW") return thrust > 0;
      if (code === "KeyS") return thrust < 0;
      if (code === "KeyD") return turn > 0;
      if (code === "KeyA") return turn < 0;
      return false;
    },
    isJustPressed(code) {
      if (code !== "Space" || !pendingFire) return false;
      pendingFire = false;
      return true;
    },
    consumeFireSequence: () => SeqSchema.parse(1),
  };
}

function shipAt(x: number, y: number, input = inputHandler()) {
  return new Ship(new Vector2(x, y), new Vector2(0, 0), 10, 0, input, "Pilot");
}

function stableState(world: World) {
  return [...world].map((entity) => ({
    kind: entity.kind,
    pos: [entity.pos.x, entity.pos.y],
    vel: [entity.vel.x, entity.vel.y],
    radius: entity.radius,
    angle: entity.angle,
    alive: entity.alive,
    ...(entity instanceof Ship
      ? {
          thrust: entity.thrust,
          score: entity.score,
          shield: entity.hasShield,
          hp: entity.hp,
        }
      : {}),
    ...(entity instanceof Explosion
      ? {
          particles: entity.particles.map((particle) => [
            particle.pos.x,
            particle.pos.y,
            particle.radius,
          ]),
        }
      : {}),
  }));
}

describe("World", () => {
  it.each([1, 17, 0xffffffff])(
    "repeats the same simulation from matching seeded state (seed %s)",
    (seed) => {
      const first = new World(1200, 800, seed);
      const second = new World(1200, 800, seed);
      first.spawn(shipAt(600, 400, inputHandler({ thrust: 1, turn: 1 })));
      second.spawn(shipAt(600, 400, inputHandler({ thrust: 1, turn: 1 })));

      for (let tick = 0; tick < 60; tick += 1) {
        first.step(1 / 30);
        second.step(1 / 30);
      }

      expect(stableState(first)).toEqual(stableState(second));
    },
  );

  it("rejects invalid world dimensions", () => {
    expect(() => new World(Number.NaN, 10)).toThrow();
    expect(() => new World(10, Number.POSITIVE_INFINITY)).toThrow();
  });

  it("stores, finds, despawns, and removes entities", () => {
    const world = new World(100, 100);
    const ship = shipAt(50, 50);
    world.spawn(ship);
    expect(world.get(ship.id)).toBe(ship);
    expect([...world]).toContain(ship);
    expect([...world.ofKind("mainShip")]).toEqual([ship]);
    world.despawn(ship.id);
    expect(ship.alive).toBe(false);
    world.remove(ship.id);
    expect(world.get(ship.id)).toBeUndefined();
  });

  it("rejects spawning a plain object", () => {
    const world = new World(100, 100);
    expect(() => world.spawn({} as Entity)).toThrow(/noEntity/);
  });

  it("finds the nearest live entity of a requested kind", () => {
    const world = new World(100, 100);
    const origin = new BliBlie(new Vector2(0, 0), new Vector2(0, 0), 1, 0);
    const far = new BliBlie(new Vector2(20, 0), new Vector2(0, 0), 1, 0);
    const near = new BliBlie(new Vector2(5, 0), new Vector2(0, 0), 1, 0);
    world.spawn(origin);
    world.spawn(far);
    world.spawn(near);
    far.alive = false;

    expect(world.findNearestTarget(origin, "bliblie")).toBe(near);
    expect(world.findNearestTarget(origin, "pickup")).toBeNull();
  });

  it("fires and records a rocket using the input sequence", () => {
    const world = new World(1200, 800, 4);
    const ship = shipAt(600, 400, inputHandler({ fire: true }));
    world.spawn(ship);
    const shoot = vi.fn();
    world.addEventListener("shoot", shoot);

    world.step(1 / 30);
    world.step(1 / 30);

    expect([...world.ofKind("miniRocket")]).toHaveLength(1);
    expect(ship.fireRequested).toBe(false);
    expect(shoot).toHaveBeenCalledOnce();
  });

  it("collects a shield pickup", () => {
    const world = new World(1200, 800, 2);
    const ship = shipAt(500, 400);
    world.spawn(ship);
    const pickup = new Pickup(new Vector2(500, 400), 10, "shield");
    world.spawn(pickup);

    world.step(1 / 30);

    expect(ship.hasShield).toBe(true);
    expect(world.get(pickup.id)).toBeUndefined();
  });

  it("uses a swept collision so a fast rocket cannot pass through a target", () => {
    const world = new World(1200, 800, 3);
    const owner = shipAt(900, 700);
    const target = new BliBlie(new Vector2(120, 100), new Vector2(0, 0), 1, 0);
    world.spawn(owner);
    world.spawn(target);
    for (const [x, y] of [
      [20, 20],
      [40, 20],
      [60, 20],
      [80, 20],
    ] as [number, number][]) {
      world.spawn(new BliBlie(new Vector2(x, y), new Vector2(0, 0), 1, 0));
    }
    world.spawn(new Pickup(new Vector2(20, 70), 1, "shield"));
    world.spawn(new Pickup(new Vector2(40, 70), 1, "shield"));
    const rocket = new MiniRocket(
      new Vector2(100, 100),
      new Vector2(400, 0),
      1,
      0,
      owner,
      SeqSchema.parse(1),
    );
    world.spawn(rocket);

    world.step(0.1);

    expect(owner.score).toBe(1);
    expect(world.get(target.id)).toBeUndefined();
    expect(world.get(rocket.id)).toBeUndefined();
  });

  it("respawns a destroyed ship after its timer expires", () => {
    const world = new World(1200, 800, 11);
    const ship = shipAt(600, 400);
    world.spawn(ship);
    ship.hit(1);
    expect(ship.alive).toBe(false);

    world.step(2.1);

    expect(ship.alive).toBe(true);
    expect(ship.hp).toBe(1);
  });
});
