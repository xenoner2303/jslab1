import { BliBlie } from './bliblie.js';
import { Entity } from './entity.js';
import { Vector2 } from './vector.js';
import { applyHoming } from './homing.js';
import { bounce } from './arena.js';
import { MiniRocket } from './miniRocket.js';
import { entitiesCollision, checkSpot } from './collision.js';
import { Explosion } from './explosion.js';
import {
  pickupItemsCount,
  blibliesCount,
  maxBliblieSpeed,
  bliblieHeight,
  bliblieWidth,
  miniRocketSpeed,
  damageFromObjects,
  damageFromMiniRocket,
  miniRocketHeight,
  miniRocketWidth,
  shieldWidth,
  shieldHeight,
} from '../../config/settings.js';
import { Pickup } from './pickup.js';

class World {
  #entities = new Map(); // entities storage/ key - id
  #pickupItems = ['shield'];

  constructor(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error('Trying to create world entity with no num edges');
    }

    this.width = width;
    this.height = height;
  }

  #getRandomFreeSpot(radius) {
    let potentialSpot = new Vector2(
      Math.random() * this.width,
      Math.random() * this.height
    );
    const aliveEntities = [...this].filter((e) => e.alive);
    // const [one, two] = [1, 2];

    while (!checkSpot(potentialSpot, radius, aliveEntities)) {
      potentialSpot = new Vector2(
        Math.random() * this.width,
        Math.random() * this.height
      );
    }

    return potentialSpot;
  }

  spawn(e) {
    if (!(e instanceof Entity)) {
      throw new Error('Trying add noEntity to entities');
    }

    this.#entities.set(e.id, e);
  }

  despawn(id) {
    let entity = this.#entities.get(id);

    if (entity != null) {
      entity.alive = false;
    }
  }

  get(id) {
    return this.#entities.get(id);
  }

  [Symbol.iterator]() {
    // availble us use for entity of world
    return this.#entities.values();
  }

  *ofKind(kind) {
    for (const entity of this.#entities.values()) {
      // values() to dont get pairs [id, value], but only values
      if (entity.kind === kind) {
        yield entity; // return current entity
      }
    }
  }

  findNearestTarget(entity, kind) {
    let nearest = null;
    let minDistance = Math.sqrt(this.width ** 2 + this.height ** 2);

    for (const current of this.ofKind(kind)) {
      if (current.id === entity.id || !current.alive) continue;

      const distance = current.pos.sub(entity.pos).length();

      if (distance < minDistance) {
        minDistance = distance;
        nearest = current;
      }
    }

    return nearest;
  }

  step(dt, inputs) {
    let localBlibliesCount = 0;
    let localPickupItemsCount = 0;

    for (const entity of this.ofKind('bliblie')) {
      localBlibliesCount++;
    }

    for (const entity of this.ofKind('pickup')) {
      localPickupItemsCount++;
    }

    if (localBlibliesCount < blibliesCount) {
      // if bliblie < 5 we spawn new
      const difference = blibliesCount - localBlibliesCount;

      for (let i = 0; i < difference; i++) {
        const speedXDirection = Math.random() < 0.5 ? 1 : -1;
        const speedYDirection = Math.random() < 0.5 ? 1 : -1;

        const newVelocity = new Vector2(
          Math.random() * maxBliblieSpeed * speedXDirection,
          Math.random() * maxBliblieSpeed * speedYDirection
        );

        const bliblieRadius =
          Math.sqrt(bliblieWidth ** 2 + bliblieHeight ** 2) / 2; // rectangle diag formula
        const newPosition = this.#getRandomFreeSpot(bliblieRadius);

        const newBliBlie = new BliBlie(
          newPosition,
          newVelocity,
          bliblieRadius,
          0
        );
        this.spawn(newBliBlie);
      }
    }

    if (localPickupItemsCount < pickupItemsCount) {
      const difference = pickupItemsCount - localPickupItemsCount;

      for (let i = 0; i < difference; i++) {
        const itemType =
          this.#pickupItems[
            Math.floor(Math.random() * this.#pickupItems.length)
          ];

        if (itemType == 'shield') {
          const shieldRadius =
            Math.sqrt(shieldWidth ** 2 + shieldHeight ** 2) / 2; // rectangle diag formula
          const newPosition = this.#getRandomFreeSpot(shieldRadius);

          const newShield = new Pickup(newPosition, shieldRadius, itemType);
          this.spawn(newShield);
          console.log('Pickup spawned:', newShield);
        }
      }
    }

    for (const entity of this.ofKind('mainShip')) {
      if (entity.fireRequested) {
        entity.fireRequested = false;

        const direction = Vector2.fromAngle(entity.angle); // for direction
        const rocketRadius =
          Math.sqrt(miniRocketWidth ** 2 + miniRocketHeight ** 2) / 2; // rectangle diag formula
        const spawnDistance = entity.radius + rocketRadius + 2; // ro avoid collisison riocket iisue
        const shipNose = entity.pos.add(direction.scale(spawnDistance)); // receive new Vector2
        const rocketVelocity = direction.scale(miniRocketSpeed);

        const miniRocket = new MiniRocket(
          shipNose,
          rocketVelocity,
          rocketRadius,
          entity.angle,
          entity
        );
        miniRocket.behaviors.push(applyHoming);
        this.spawn(miniRocket);
      }
    }

    for (const entity of this) {
      const context = {}; // sup data for obj behavior

      if (entity.kind === 'miniRocket') {
        context.target = this.findNearestTarget(entity, 'bliblie');
        context.worldEntities = this;
      }

      entity.update(dt, context);

      if (entity.kind == 'bliblie') {
        bounce(entity, this.width, this.height);
      }
    }

    const collisions = entitiesCollision([...this]);

    for (const [a, b] of collisions) {
      if (!a.alive || !b.alive) continue;

      if (
        (a.kind == 'bliblie' && b.kind == 'bliblie') ||
        (a.kind == 'mainShip' && b.kind == 'mainShip')
      ) {
        a.vel = new Vector2(-a.vel.x, -a.vel.y);
        b.vel = new Vector2(-b.vel.x, -b.vel.y);
      }

      if (
        (a.kind == 'miniRocket' && b.kind == 'bliblie') ||
        (a.kind == 'bliblie' && b.kind == 'miniRocket')
      ) {
        const rocket = a.kind == 'miniRocket' ? a : b;
        const bliblie = a.kind == 'bliblie' ? a : b;

        rocket.alive = false;
        bliblie.alive = false;
        rocket.owner.score += 1;
      }

      if (
        (a.kind == 'mainShip' && b.kind == 'bliblie') ||
        (a.kind == 'bliblie' && b.kind == 'mainShip')
      ) {
        const ship = a.kind == 'mainShip' ? a : b;
        const bliblie = a.kind == 'bliblie' ? a : b;

        if (ship.hit(damageFromObjects)) {
          this.spawn(new Explosion(ship.pos));
        }

        bliblie.vel = new Vector2(-bliblie.vel.x, -bliblie.vel.y);
        ship.vel = new Vector2(-ship.vel.x, -ship.vel.y);
      }

      if (
        (a.kind == 'mainShip' && b.kind == 'miniRocket') ||
        (a.kind == 'miniRocket' && b.kind == 'mainShip')
      ) {
        const ship = a.kind == 'mainShip' ? a : b;
        const rocket = a.kind == 'miniRocket' ? a : b;

        if (rocket.owner != ship && ship.hit(damageFromMiniRocket)) {
          this.spawn(new Explosion(ship.pos));
        }

        rocket.alive = false;
      }

      if (
        (a.kind == 'mainShip' && b.kind == 'pickup') ||
        (a.kind == 'pickup' && b.kind == 'mainShip')
      ) {
        const ship = a.kind == 'mainShip' ? a : b;
        const pickup = a.kind == 'pickup' ? a : b;

        if (pickup.effect == 'shield') {
          ship.hasShield = true;
        }

        pickup.alive = false;
      }
    }

    for (const entity of this) {
      if (!entity.alive) {
        if (entity.kind == 'mainShip') {
          // ship respawns
          if (entity.updateRespawn(dt)) {
            entity.pos = this.#getRandomFreeSpot(entity.radius);
          }
        } else {
          this.#entities.delete(entity.id);
        }
      }
    }
  }
}

export { World };
