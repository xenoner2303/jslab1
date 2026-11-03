import { BliBlie } from './bliblie.ts';
import { Entity } from './entity.ts';
import type { BehaviorContext } from './entity.ts';
import { Vector2 } from './vector.ts';
import { applyHoming } from './homing.ts';
import { bounce } from './arena.ts';
import { MiniRocket, getMiniRocketLaunchState } from './miniRocket.ts';
import { entitiesCollision, checkSpot } from './collision.ts';
import { Explosion } from './explosion.ts';
import {
  pickupItemsCount,
  blibliesCount,
  maxBliblieSpeed,
  bliblieHeight,
  bliblieWidth,
  damageFromObjects,
  damageFromMiniRocket,
  shieldWidth,
  shieldHeight,
  bliblieScreamTimer,
} from '../config/settings.ts';
import { Pickup } from './pickup.ts';
import { createSeededRandom } from './prng.ts';
import type { EntityId } from '../codec/binary.ts';
import { Ship } from './ship.ts';

export class World extends EventTarget {
  #entities = new Map<EntityId, Entity>();
  #pickupItems = ['shield'];
  #shipKillCount = new Map<Ship, number>();

  public width: number;
  public height: number;
  public seed: number;
  public random: () => number;
  public bliblieScreamTimer: number;

  constructor(width: number, height: number, seed: number = 12345) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error('Trying to create world entity with no num edges');
    }

    super();

    this.width = width;
    this.height = height;
    this.seed = seed >>> 0;
    this.random = createSeededRandom(this.seed);
    this.bliblieScreamTimer = bliblieScreamTimer;
  }

  #getRandomFreeSpot(radius: number): Vector2 {
    let potentialSpot = new Vector2(
      this.random() * this.width,
      this.random() * this.height
    );
    const aliveEntities = [...this].filter((e) => e.alive);

    while (!checkSpot(potentialSpot, radius, aliveEntities)) {
      potentialSpot = new Vector2(
        this.random() * this.width,
        this.random() * this.height
      );
    }

    return potentialSpot;
  }

  spawn(e: Entity): void {
    if (!(e instanceof Entity)) {
      throw new Error('Trying add noEntity to entities');
    }

    this.#entities.set(e.id, e);

    if (e instanceof Ship) {
      this.#shipKillCount.set(e, 0);
    }
  }

  despawn(id: EntityId): void {
    const entity = this.#entities.get(id);

    if (entity != null) {
      entity.alive = false;
    }
  }

  remove(id: EntityId): void {
    this.#entities.delete(id);
  }

  get(id: EntityId): Entity | undefined {
    return this.#entities.get(id);
  }

  [Symbol.iterator](): IterableIterator<Entity> {
    return this.#entities.values();
  }

  *ofKind(kind: string): IterableIterator<Entity> {
    for (const entity of this.#entities.values()) {
      if (entity.kind === kind) {
        yield entity;
      }
    }
  }

  findNearestTarget(entity: Entity, kind: string): Entity | null {
    let nearest: Entity | null = null;
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

  step(dt: number, inputs?: unknown): void {
    let localBlibliesCount = 0;
    let localPickupItemsCount = 0;

    for (const _entity of this.ofKind('bliblie')) {
      localBlibliesCount++;
    }

    for (const _entity of this.ofKind('pickup')) {
      localPickupItemsCount++;
    }

    if (localBlibliesCount > 0) {
      this.bliblieScreamTimer -= dt * (1 + 0.7 * localBlibliesCount);

      if (this.bliblieScreamTimer <= 0) {
        this.dispatchEvent(
          new CustomEvent('environment', { detail: { type: 'bliblie' } })
        );
        this.bliblieScreamTimer = 5;
      }
    }

    if (localBlibliesCount < blibliesCount) {
      const difference = blibliesCount - localBlibliesCount;

      for (let i = 0; i < difference; i++) {
        const speedXDirection = this.random() < 0.5 ? 1 : -1;
        const speedYDirection = this.random() < 0.5 ? 1 : -1;

        const newVelocity = new Vector2(
          this.random() * maxBliblieSpeed * speedXDirection,
          this.random() * maxBliblieSpeed * speedYDirection
        );

        const bliblieRadius =
          Math.sqrt(bliblieWidth ** 2 + bliblieHeight ** 2) / 2;
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
        const itemType = this.#pickupItems[
          Math.floor(this.random() * this.#pickupItems.length)
        ];

        if (itemType === 'shield') {
          const shieldRadius =
            Math.sqrt(shieldWidth ** 2 + shieldHeight ** 2) / 2;
          const newPosition = this.#getRandomFreeSpot(shieldRadius);

          const newShield = new Pickup(newPosition, shieldRadius, itemType);
          this.spawn(newShield);
        }
      }
    }

    for (const entity of this.ofKind('mainShip')) {
      if (!(entity instanceof Ship)) continue;
      const ship = entity;
      if (ship.fireRequested) {
        ship.fireRequested = false;

        const launch = getMiniRocketLaunchState(ship);
        const miniRocket = new MiniRocket(
          launch.pos,
          launch.vel,
          launch.radius,
          launch.angle,
          ship,
          ship.fireSequence
        );
        ship.fireSequence = null;
        miniRocket.behaviors.push(applyHoming);
        this.spawn(miniRocket);

        this.dispatchEvent(new CustomEvent('shoot'));
      }
    }

    for (const entity of this) {
      const context: BehaviorContext =
        entity instanceof MiniRocket
          ? {
              target: this.findNearestTarget(entity, 'bliblie'),
              worldEntities: this,
            }
          : {};

      entity.update(dt, context);

      if (entity instanceof BliBlie) {
        bounce(entity, this.width, this.height);
      }
    }

    const collisions = entitiesCollision([...this]);

    for (const [a, b] of collisions) {
      if (!a.alive || !b.alive) continue;

      if (
        (a.kind === 'bliblie' && b.kind === 'bliblie') ||
        (a.kind === 'mainShip' && b.kind === 'mainShip')
      ) {
        a.vel = new Vector2(-a.vel.x, -a.vel.y);
        b.vel = new Vector2(-b.vel.x, -b.vel.y);
      }

      const rocket = a instanceof MiniRocket ? a : b instanceof MiniRocket ? b : null;
      const bliblie = a instanceof BliBlie ? a : b instanceof BliBlie ? b : null;
      if (rocket && bliblie) {
        rocket.alive = false;
        bliblie.alive = false;
        
        const ownerShip = rocket.owner;
        ownerShip.score += 1;

        const currentKills = (this.#shipKillCount.get(ownerShip) ?? 0) + 1;
        this.#shipKillCount.set(ownerShip, currentKills);

        this.dispatchEvent(
          new CustomEvent('hit', { detail: { type: 'bliblie' } })
        );
        this.dispatchEvent(
          new CustomEvent('kill', {
            detail: { count: currentKills, type: 'bliblie' },
          })
        );
      }

      const ship = a instanceof Ship ? a : b instanceof Ship ? b : null;
      if (ship && bliblie) {
        if (ship.hit(damageFromObjects)) {
          this.spawn(new Explosion(ship.pos, this.random));
          this.#shipKillCount.set(ship, 0);
          this.dispatchEvent(new CustomEvent('exploded'));
        }

        bliblie.vel = new Vector2(-bliblie.vel.x, -bliblie.vel.y);
        ship.vel = new Vector2(-ship.vel.x, -ship.vel.y);
      }

      if (ship && rocket) {
        if (rocket.owner !== ship && ship.hit(damageFromMiniRocket)) {
          this.spawn(new Explosion(ship.pos, this.random));
          const ownerShip = rocket.owner;
          this.#shipKillCount.set(ownerShip, 0);
          this.dispatchEvent(new CustomEvent('exploded'));
        }

        rocket.alive = false;
      }

      const pickup = a instanceof Pickup ? a : b instanceof Pickup ? b : null;
      if (ship && pickup) {
        if (pickup.effect === 'shield') {
          ship.hasShield = true;
        }

        pickup.alive = false;
      }
    }

    for (const entity of this) {
      if (!entity.alive) {
        if (entity instanceof Ship) {
          const ship = entity;
          if (ship.updateRespawn(dt)) {
            ship.pos = this.#getRandomFreeSpot(ship.radius);
          }
        } else {
          this.#entities.delete(entity.id);
        }
      }
    }
  }
}
