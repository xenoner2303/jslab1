import { describe, expect, it, vi } from "vitest";
import { BliBlie } from "../sim/bliblie.ts";
import { Entity } from "../sim/entity.ts";
import { Explosion } from "../sim/explosion.ts";
import { applyHoming } from "../sim/homing.ts";
import { MiniRocket, getMiniRocketLaunchState } from "../sim/miniRocket.ts";
import { Pickup } from "../sim/pickup.ts";
import { Ship, type ShipInputHandler } from "../sim/ship.ts";
import { Vector2 } from "../sim/vector.ts";
import {
  explosionParticleCount,
  miniRocketSpeed,
  rocketTtl,
} from "../config/settings.ts";
import { EntityIdSchema, SeqSchema } from "../protocol.ts";

function quietInput(): ShipInputHandler {
  return {
    isDown: () => false,
    isJustPressed: () => false,
    consumeFireSequence: () => null,
  };
}

function shipAt(x = 10, y = 20, angle = 0) {
  return new Ship(
    new Vector2(x, y),
    new Vector2(0, 0),
    10,
    angle,
    quietInput(),
    "Pilot",
  );
}

describe("simulation entities", () => {
  it("moves a bliblie by velocity times dt", () => {
    const bliblie = new BliBlie(new Vector2(1, 2), new Vector2(3, -4), 5, 0);
    bliblie.update(0.5);
    expect(bliblie.pos).toEqual(new Vector2(2.5, 0));
  });

  it("launches a rocket from the ship in its facing direction", () => {
    const launch = getMiniRocketLaunchState(shipAt(10, 20, 0));
    expect(launch.pos.x).toBeGreaterThan(10);
    expect(launch.pos.y).toBeCloseTo(20);
    expect(launch.vel.x).toBe(miniRocketSpeed);
    expect(launch.vel.y).toBeCloseTo(0);
    expect(launch.angle).toBe(0);
  });

  it("turns a rocket toward its target by at most one frame of turn speed", () => {
    const owner = shipAt();
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(1, 0),
      2,
      0,
      owner,
    );
    rocket.behaviors.push((entity, _dt, context) => {
      applyHoming(entity, 1 / 30, context);
    });
    const target = new BliBlie(new Vector2(0, 100), new Vector2(0, 0), 5, 0);

    rocket.update(1 / 30, { target });

    expect(rocket.angle).toBeGreaterThan(0);
    expect(rocket.angle).toBeLessThanOrEqual(Math.PI / 60);
    expect(rocket.vel.length()).toBeCloseTo(miniRocketSpeed);
  });

  it("does not turn a rocket when it has no target", () => {
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(1, 0),
      2,
      0.25,
      shipAt(),
    );
    applyHoming(rocket, 1 / 30, {});
    expect(rocket.angle).toBe(0.25);
  });

  it("steers around an obstacle detected on its center ray", () => {
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(1, 0),
      5,
      0,
      shipAt(),
    );
    const target = new BliBlie(new Vector2(100, 0), new Vector2(0, 0), 5, 0);
    const obstacle = new BliBlie(new Vector2(40, 0), new Vector2(0, 0), 20, 0);

    applyHoming(rocket, 1 / 30, {
      target,
      worldEntities: [rocket, target, obstacle],
    });

    expect(rocket.angle).toBeGreaterThan(0);
  });

  it("expires a rocket after its lifetime", () => {
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(0, 0),
      2,
      0,
      shipAt(),
    );
    rocket.update(rocketTtl + 0.1);
    expect(rocket.alive).toBe(false);
  });

  it("does not update a dead rocket", () => {
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(0, 0),
      2,
      0,
      shipAt(),
    );
    rocket.alive = false;
    rocket.update(1);
    expect(rocket.pos).toEqual(new Vector2(0, 0));
  });

  it("creates deterministic explosion particles from its random source", () => {
    const first = new Explosion(new Vector2(1, 2), () => 0.5);
    const second = new Explosion(new Vector2(1, 2), () => 0.5);
    expect(first.particles).toHaveLength(explosionParticleCount);
    expect(first.particles).toEqual(second.particles);
  });

  it("moves explosion particles and expires the explosion", () => {
    const explosion = new Explosion(new Vector2(0, 0), () => 0.5);
    const particle = explosion.particles[0]!;
    particle.vel = new Vector2(10, -5);
    explosion.update(0.5);
    expect(particle.pos).toEqual(new Vector2(5, -2.5));
    explosion.update(0.6);
    expect(explosion.alive).toBe(false);
  });

  it("resets a ship's hit points when respawning", () => {
    const ship = shipAt();
    expect(ship.hit(1)).toBe(true);
    expect(ship.alive).toBe(false);
    expect(ship.updateRespawn(1)).toBe(false);
    expect(ship.updateRespawn(2)).toBe(true);
    expect(ship.hp).toBe(1);
    expect(ship.alive).toBe(true);
    expect(ship.updateRespawn(1)).toBe(false);
  });

  it("absorbs one hit with a shield", () => {
    const ship = shipAt();
    ship.hasShield = true;
    expect(ship.hit(1)).toBe(false);
    expect(ship.hasShield).toBe(false);
    expect(ship.hp).toBe(1);
  });

  it("updates movement and remembers a just-pressed fire sequence", () => {
    let fire = true;
    const input: ShipInputHandler = {
      isDown: (code) => code === "KeyW",
      isJustPressed: (code) => {
        if (code !== "Space" || !fire) return false;
        fire = false;
        return true;
      },
      consumeFireSequence: () => SeqSchema.parse(9),
    };
    const ship = new Ship(
      new Vector2(0, 0),
      new Vector2(0, 0),
      10,
      0,
      input,
      "Pilot",
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    ship.update(1 / 30);

    expect(ship.fireRequested).toBe(true);
    expect(ship.fireSequence).toBe(9);
    expect(ship.pos.x).toBeGreaterThan(0);
    log.mockRestore();
  });

  it("constructs a pickup with the requested effect", () => {
    const pickup = new Pickup(new Vector2(2, 3), 4, "shield");
    expect(pickup.kind).toBe("pickup");
    expect(pickup.effect).toBe("shield");
    expect(pickup.alive).toBe(true);
  });

  it("skips self and behind-target entities while searching for homing obstacles", () => {
    const rocket = new MiniRocket(
      new Vector2(0, 0),
      new Vector2(1, 0),
      2,
      0,
      shipAt(),
    );
    const target = new BliBlie(new Vector2(100, 0), new Vector2(0, 0), 3, 0);
    const behind = new BliBlie(new Vector2(-10, 0), new Vector2(0, 0), 30, 0);
    applyHoming(rocket, 1 / 30, {
      target,
      worldEntities: [rocket, target, behind],
    });
    expect(rocket.angle).toBeCloseTo(0);
  });

  it("uses entity identifiers accepted by the shared protocol", () => {
    const id = EntityIdSchema.parse(1);
    const entity = new Entity(
      new Vector2(0, 0),
      new Vector2(0, 0),
      1,
      true,
      0,
      "test",
    );
    expect(id).toBe(1);
    expect(entity.id).toBeGreaterThanOrEqual(0);
  });
});
