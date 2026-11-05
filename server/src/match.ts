import { randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import {
  SeqSchema,
  TickSchema,
  type EntitySnapshot,
  type Seq,
} from "../../shared/protocol.ts";
import { createSnapshotMessage } from "../../shared/protocol/messages.ts";
import {
  arenaHeight,
  arenaWidth,
  shipHeight,
  shipWidth,
  simulationTickRate,
} from "../../shared/config/settings.ts";
import { wrap } from "../../shared/sim/arena.ts";
import { BliBlie } from "../../shared/sim/bliblie.ts";
import { Entity } from "../../shared/sim/entity.ts";
import { Explosion } from "../../shared/sim/explosion.ts";
import { MiniRocket } from "../../shared/sim/miniRocket.ts";
import { Pickup } from "../../shared/sim/pickup.ts";
import { Ship } from "../../shared/sim/ship.ts";
import { Vector2 } from "../../shared/sim/vector.ts";
import { World } from "../../shared/sim/world.ts";
import { calculatePercentile } from "./metrics.ts";
import type { Room } from "./rooms.ts";

const TICK_INTERVAL_MS = 1000 / simulationTickRate;
const MAX_QUEUED_INPUTS = 120;

type PlayerInputMessage = {
  readonly seq: Seq;
  readonly thrust: -1 | 0 | 1;
  readonly turn: -1 | 0 | 1;
  readonly fire: boolean;
};

type MatchPlayer = {
  readonly id: string;
  readonly name: string;
  state?: EntitySnapshot;
};

type PlayerMatchState = {
  readonly player: MatchPlayer;
  readonly ship: Ship;
  readonly input: PlayerInput;
  readonly queuedInputs: PlayerInputMessage[];
  lastReceivedSeq: number;
  lastProcessedSeq: Seq;
  isBot: boolean;
  fireCooldown: number;
};

class PlayerInput {
  current: { thrust: -1 | 0 | 1; turn: -1 | 0 | 1 } = {
    thrust: 0,
    turn: 0,
  };
  firePending = false;
  fireSequence: Seq | null = null;

  apply(message: PlayerInputMessage): void {
    this.current = { thrust: message.thrust, turn: message.turn };
    if (message.fire && !this.firePending) {
      this.firePending = true;
      this.fireSequence = message.seq;
    }
  }

  isDown(key: string): boolean {
    if (key === "KeyW") return this.current.thrust > 0;
    if (key === "KeyS") return this.current.thrust < 0;
    if (key === "KeyA") return this.current.turn < 0;
    if (key === "KeyD") return this.current.turn > 0;
    return false;
  }

  isJustPressed(key: string): boolean {
    if (key !== "Space" || !this.firePending) return false;
    this.firePending = false;
    return true;
  }

  consumeFireSequence(): Seq | null {
    const fireSequence = this.fireSequence;
    this.fireSequence = null;
    return fireSequence;
  }
}

export class Match {
  readonly room: Room;
  readonly seed: number;
  readonly world: World;
  readonly players = new Map<string, PlayerMatchState>();
  tick = 0;
  lastTickDurationMs = 0;
  lastTickJitterMs = 0;
  totalTicks = 0;
  readonly recentTickDurations: number[] = [];
  #timer: ReturnType<typeof setTimeout> | null = null;
  #nextTickAt = 0;
  #nextBotId = 1;

  constructor(room: Room) {
    this.room = room;
    this.seed = randomInt(0, 0x100000000);
    this.world = new World(arenaWidth, arenaHeight, this.seed);

    this.#bindWorldAudioEvents();
  }

  addPlayer(player: MatchPlayer): EntitySnapshot {
    const spawnAngle = (2 * Math.PI * this.players.size) / this.room.maxPlayers;
    const input = new PlayerInput();
    const radius = Math.sqrt(shipWidth ** 2 + shipHeight ** 2) / 2;
    const ship = new Ship(
      new Vector2(
        arenaWidth / 2 + Math.cos(spawnAngle) * 220,
        arenaHeight / 2 + Math.sin(spawnAngle) * 160,
      ),
      new Vector2(0, 0),
      radius,
      spawnAngle + Math.PI / 2,
      input,
      player.name,
    );

    this.world.spawn(ship);
    const initialState = this.#serializeEntity(ship, player.id);
    player.state = initialState;
    this.players.set(player.id, {
      player,
      ship,
      input,
      queuedInputs: [],
      lastReceivedSeq: 0,
      lastProcessedSeq: SeqSchema.parse(0),
      isBot: false,
      fireCooldown: 0,
    });

    this.start();
    return initialState;
  }

  addBot(name?: string): EntitySnapshot {
    const id = `bot-${this.room.id}-${this.#nextBotId++}`;
    const botName = name ?? `Bot ${this.#nextBotId - 1}`;
    const state = this.addPlayer({ id, name: botName });
    const botState = this.players.get(id);
    if (botState) botState.isBot = true;
    return state;
  }

  removePlayer(playerId: string): void {
    const state = this.players.get(playerId);
    if (!state) return;

    this.world.remove(state.ship.id);
    this.players.delete(playerId);
    if (this.players.size === 0) this.stop();
  }

  enqueueInput(playerId: string, input: PlayerInputMessage): boolean {
    const state = this.players.get(playerId);
    if (!state || input.seq <= state.lastReceivedSeq) return false;
    if (state.queuedInputs.length >= MAX_QUEUED_INPUTS) return false;

    state.lastReceivedSeq = input.seq;
    state.queuedInputs.push(input);
    return true;
  }

  start(): void {
    if (this.#timer || this.players.size === 0) return;
    this.#nextTickAt = performance.now() + TICK_INTERVAL_MS;
    this.#scheduleTick();
  }

  stop(): void {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  getStats(): {
    tick: number;
    targetTickRate: number;
    players: number;
    lastTickDurationMs: number;
    lastTickJitterMs: number;
    totalTicks: number;
    tickTimeP99Ms: number;
  } {
    return {
      tick: this.tick,
      targetTickRate: simulationTickRate,
      players: this.players.size,
      lastTickDurationMs: this.lastTickDurationMs,
      lastTickJitterMs: this.lastTickJitterMs,
      totalTicks: this.totalTicks,
      tickTimeP99Ms: Number(calculatePercentile(this.recentTickDurations, 0.99).toFixed(3)),
    };
  }

  #scheduleTick(): void {
    const delay = Math.max(0, this.#nextTickAt - performance.now());
    this.#timer = setTimeout(() => this.#runTick(), delay);
  }

  #runTick(): void {
    this.#timer = null;
    if (this.players.size === 0) return;

    const tickStartedAt = performance.now();
    this.lastTickJitterMs = tickStartedAt - this.#nextTickAt;

    for (const [playerId, state] of this.players) {
      if (state.isBot) this.#updateBotInput(state, 1 / simulationTickRate);
      const input = state.queuedInputs.shift();
      if (input) {
        state.input.apply(input);
        state.lastProcessedSeq = input.seq;
      }

      state.player.state = this.#serializeEntity(state.ship, playerId);
    }

    this.world.step(1 / simulationTickRate);
    for (const state of this.players.values()) {
      wrap(state.ship, arenaWidth, arenaHeight);
      state.player.state = this.#serializeEntity(state.ship, state.player.id);
    }

    this.tick += 1;
    this.totalTicks += 1;
    this.lastTickDurationMs = performance.now() - tickStartedAt;
    this.recentTickDurations.push(this.lastTickDurationMs);
    if (this.recentTickDurations.length > 300) {
      this.recentTickDurations.shift();
    }

    const playerIdByShip = new Map(
      [...this.players].map(([playerId, state]) => [state.ship, playerId]),
    );
    const entities = [...this.world].map((entity) =>
      this.#serializeEntity(
        entity,
        entity instanceof Ship ? (playerIdByShip.get(entity) ?? null) : null,
      ),
    );
    const lastProcessedSeq: Record<string, Seq> = Object.fromEntries(
      [...this.players].map(([id, state]) => [id, state.lastProcessedSeq]),
    );
    const snapshot = {
      ...createSnapshotMessage(
        TickSchema.parse(this.tick),
        lastProcessedSeq,
        entities,
      ),
      seed: this.seed,
      serverTime: Date.now(),
    };

    this.room.broadcast(snapshot);
    this.#nextTickAt += TICK_INTERVAL_MS;
    this.#scheduleTick();
  }

  #updateBotInput(state: PlayerMatchState, dt: number): void {
    const targets = [...this.players.values()].filter(
      (candidate) => candidate !== state && candidate.ship.alive,
    );
    if (targets.length === 0) {
      state.input.current = { thrust: 0, turn: 0 };
      return;
    }

    let target = targets[0];
    if (!target) return;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of targets) {
      const dx = candidate.ship.pos.x - state.ship.pos.x;
      const dy = candidate.ship.pos.y - state.ship.pos.y;
      const distance = dx * dx + dy * dy;
      if (distance < nearestDistance) {
        nearestDistance = distance;
        target = candidate;
      }
    }

    const dx = target.ship.pos.x - state.ship.pos.x;
    const dy = target.ship.pos.y - state.ship.pos.y;
    const desiredAngle = Math.atan2(dy, dx);
    let angleDifference = desiredAngle - state.ship.angle;
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;

    const turn: -1 | 0 | 1 =
      Math.abs(angleDifference) < 0.12 ? 0 : angleDifference > 0 ? 1 : -1;
    const distance = Math.sqrt(nearestDistance);
    // Keep some distance instead of flying directly into the target.
    const thrust: -1 | 0 | 1 = distance > 180 ? 1 : distance < 110 ? -1 : 0;
    state.input.current = { thrust, turn };

    state.fireCooldown -= dt;
    if (
      distance < 650 &&
      Math.abs(angleDifference) < 0.2 &&
      state.fireCooldown <= 0
    ) {
      state.input.firePending = true;
      state.fireCooldown = 0.8;
    }
  }

  #bindWorldAudioEvents(): void {
    this.world.addEventListener("shoot", () => {
      this.room.broadcast({
        type: "audioEvent",
        payload: { event: "shoot" },
      });
    });

    this.world.addEventListener("hit", (event) => {
      const { type } = (event as CustomEvent<{ type: "bliblie" }>).detail;

      this.room.broadcast({
        type: "audioEvent",
        payload: {
          event: "hit",
          targetType: type,
        },
      });
    });

    this.world.addEventListener("kill", (event) => {
      const { count, type } = (
        event as CustomEvent<{ count: number; type: "bliblie" }>
      ).detail;

      this.room.broadcast({
        type: "audioEvent",
        payload: {
          event: "kill",
          count,
          targetType: type,
        },
      });
    });

    this.world.addEventListener("environment", (event) => {
      const { type } = (event as CustomEvent<{ type: "bliblie" }>).detail;

      this.room.broadcast({
        type: "audioEvent",
        payload: {
          event: "environment",
          soundType: type,
        },
      });
    });

    this.world.addEventListener("exploded", () => {
      this.room.broadcast({
        type: "audioEvent",
        payload: { event: "exploded" },
      });
    });
  }

  #serializeEntity(entity: Entity, playerId: string | null): EntitySnapshot {
    const common = {
      id: entity.id,
      pos: { x: entity.pos.x, y: entity.pos.y },
      vel: { x: entity.vel.x, y: entity.vel.y },
      x: entity.pos.x,
      y: entity.pos.y,
      angle: entity.angle,
      radius: entity.radius,
      alive: entity.alive,
      playerId,
    };

    if (entity instanceof Ship) {
      return {
        ...common,
        kind: "mainShip",
        playerName: entity.playerName,
        thrust: entity.thrust,
        score: entity.score,
        hasShield: entity.hasShield,
      };
    }
    if (entity instanceof MiniRocket) {
      return {
        ...common,
        kind: "miniRocket",
        ownerPlayerId: playerIdByOwner(this.players, entity.owner),
        fireSeq: entity.fireSeq,
      };
    }
    if (entity instanceof Pickup) {
      return { ...common, kind: "pickup", effect: "shield" };
    }
    if (entity instanceof Explosion) {
      return {
        ...common,
        kind: "explosion",
        particles: entity.particles.map((particle) => ({
          pos: { x: particle.pos.x, y: particle.pos.y },
          radius: particle.radius,
        })),
      };
    }
    if (entity instanceof BliBlie) {
      return { ...common, kind: "bliblie" };
    }
    throw new TypeError(`Unsupported entity kind: ${entity.kind}`);
  }
}

function playerIdByOwner(
  players: Map<string, PlayerMatchState>,
  owner: unknown,
): string | null {
  for (const [playerId, state] of players) {
    if (state.ship === owner) return playerId;
  }
  return null;
}
