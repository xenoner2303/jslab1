import { Entity } from './entity.ts';
import {
  maxShipHp,
  shipRespawnTime,
} from '../config/settings.ts';
import { Vector2 } from './vector.ts';
import type { BehaviorContext } from './entity.ts';
import { integrateShip } from './integrate.ts';
import type { Seq } from '../codec/binary.ts';

export interface ShipInputHandler {
  isJustPressed(code: string): boolean;
  consumeFireSequence(): Seq | null;
  isDown(code: string): boolean;
}

export class Ship extends Entity {
  #hp: number = 0;
  #respawnTimer: number = 0;

  public thrust: number;
  public input: ShipInputHandler;
  public fireRequested: boolean;
  public fireSequence: Seq | null;
  public score: number;
  public hasShield: boolean;
  public playerName: string;

  constructor(
    pos: Vector2, 
    vel: Vector2, 
    radius: number, 
    angle: number, 
    input: ShipInputHandler, 
    playerName: string
  ) {
    super(pos, vel, radius, true, angle, 'mainShip');

    this.thrust = 0;
    this.input = input;
    this.fireRequested = false;
    this.fireSequence = null;
    this.#hp = maxShipHp;
    this.score = 0;
    this.hasShield = false;
    this.playerName = playerName;
  }

  get hp(): number {
    return this.#hp;
  }

  hit(amount: number): boolean {
    if (this.hasShield) {
      this.hasShield = false;
      return false;
    }

    this.#hp -= amount;

    if (this.#hp <= 0) {
      this.#hp = 0;
      this.alive = false;
      this.#respawnTimer = shipRespawnTime;
      this.vel = new Vector2(0, 0);

      return true;
    }

    return false;
  }

  updateRespawn(dt: number): boolean {
    if (this.alive) return false;

    this.#respawnTimer -= dt;

    if (this.#respawnTimer <= 0) {
      this.#hp = maxShipHp;
      this.alive = true;
      return true;
    }

    return false;
  }

  update(dt: number, context: BehaviorContext = {}): void {
    if (!this.alive) return;

    super.update(dt, context);

    if (this.input.isJustPressed('Space')) {
      this.fireRequested = true;
      this.fireSequence = this.input.consumeFireSequence();
    }

    if (this.input.isJustPressed('KeyA')) {
      console.log('started turning left');
    }

    if (this.input.isJustPressed('KeyD')) {
      console.log('started turning right');
    }

    if (this.input.isJustPressed('KeyW')) {
      console.log('started moving forward');
    }

    if (this.input.isJustPressed('KeyS')) {
      console.log('started moving backward');
    }

    const movementInput = {
      turn:
        Number(this.input.isDown('KeyD')) -
        Number(this.input.isDown('KeyA')),
      thrust:
        Number(this.input.isDown('KeyW')) -
        Number(this.input.isDown('KeyS')),
    };
    const nextState = integrateShip(
      { pos: this.pos, vel: this.vel, angle: this.angle, thrust: this.thrust },
      movementInput,
      dt
    );

    this.pos = nextState.pos;
    this.vel = nextState.vel;
    this.angle = nextState.angle;
    this.thrust = nextState.thrust;
  }
}
