import { randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";
import { World } from "../../shared/sim/world.js";
import { Ship } from "../../shared/sim/ship.js";
import { Vector2 } from "../../shared/sim/vector.js";
import { wrap } from "../../shared/sim/arena.js";
import {
  createSnapshotMessage,
} from "../../shared/protocol/messages.js";
import {
  shipHeight,
  shipWidth,
  arenaWidth,
  arenaHeight,
} from "../../shared/config/settings.js";

const TICK_RATE = 30;
const TICK_INTERVAL_MS = 1000 / TICK_RATE;
const MAX_QUEUED_INPUTS = 120;

class PlayerInput {
  current = { thrust: 0, turn: 0 };
  firePending = false;

  apply(message) {
    this.current = { thrust: message.thrust, turn: message.turn };
    this.firePending ||= message.fire;
  }

  isDown(key) {
    if (key === "KeyW") return this.current.thrust > 0;
    if (key === "KeyS") return this.current.thrust < 0;
    if (key === "KeyA") return this.current.turn < 0;
    if (key === "KeyD") return this.current.turn > 0;
    return false;
  }

  isJustPressed(key) {
    if (key !== "Space" || !this.firePending) return false;
    this.firePending = false;
    return true;
  }
}

export class Match {
  constructor(room) {
    this.room = room;
    this.seed = randomInt(0, 0x100000000);
    this.world = new World(arenaWidth, arenaHeight, this.seed);
    this.tick = 0;
    this.players = new Map();
    this.lastTickDurationMs = 0;
    this.lastTickJitterMs = 0;
    this.totalTicks = 0;
    this.#timer = null;
    this.#nextTickAt = 0;
  }

  #timer;
  #nextTickAt;

  addPlayer(player) {
    const spawnAngle = (2 * Math.PI * this.players.size) / this.room.maxPlayers;
    const input = new PlayerInput();
    const radius = Math.sqrt(shipWidth ** 2 + shipHeight ** 2) / 2;
    const ship = new Ship(
      new Vector2(
        arenaWidth / 2 + Math.cos(spawnAngle) * 220,
        arenaHeight / 2 + Math.sin(spawnAngle) * 160
      ),
      new Vector2(0, 0),
      radius,
      spawnAngle + Math.PI / 2,
      input,
      player.name
    );

    this.world.spawn(ship);
    this.players.set(player.id, {
      player,
      ship,
      input,
      queuedInputs: [],
      lastReceivedSeq: 0,
      lastProcessedSeq: 0,
    });

    player.ship = ship;
    player.state = this.#serializeEntity(ship, player.id);
    this.start();
    return player.state;
  }

  removePlayer(playerId) {
    const state = this.players.get(playerId);
    if (!state) return;

    this.world.remove(state.ship.id);
    this.players.delete(playerId);
    if (this.players.size === 0) this.stop();
  }

  enqueueInput(playerId, input) {
    const state = this.players.get(playerId);
    if (!state || input.seq <= state.lastReceivedSeq) return false;
    if (state.queuedInputs.length >= MAX_QUEUED_INPUTS) return false;

    state.lastReceivedSeq = input.seq;
    state.queuedInputs.push(input);
    return true;
  }

  start() {
    if (this.#timer || this.players.size === 0) return;
    this.#nextTickAt = performance.now() + TICK_INTERVAL_MS;
    this.#scheduleTick();
  }

  stop() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
  }

  getStats() {
    return {
      tick: this.tick,
      targetTickRate: TICK_RATE,
      players: this.players.size,
      lastTickDurationMs: this.lastTickDurationMs,
      lastTickJitterMs: this.lastTickJitterMs,
      totalTicks: this.totalTicks,
    };
  }

  #scheduleTick() {
    const delay = Math.max(0, this.#nextTickAt - performance.now());
    this.#timer = setTimeout(() => this.#runTick(), delay);
  }

  #runTick() {
    this.#timer = null;
    if (this.players.size === 0) return;

    const tickStartedAt = performance.now();
    this.lastTickJitterMs = tickStartedAt - this.#nextTickAt;

    for (const [playerId, state] of this.players) {
      for (const input of state.queuedInputs.splice(0)) {
        state.input.apply(input);
        state.lastProcessedSeq = input.seq;
      }

      state.player.state = this.#serializeEntity(state.ship, playerId);
    }

    this.world.step(1 / TICK_RATE);
    for (const state of this.players.values()) {
      wrap(state.ship, arenaWidth, arenaHeight);
      state.player.state = this.#serializeEntity(state.ship, state.player.id);
    }

    this.tick += 1;
    this.totalTicks += 1;
    this.lastTickDurationMs = performance.now() - tickStartedAt;

    const playerIdByShip = new Map(
      [...this.players].map(([playerId, state]) => [state.ship, playerId])
    );
    const entities = [...this.world].map((entity) =>
      this.#serializeEntity(entity, playerIdByShip.get(entity) ?? null)
    );
    const snapshot = {
      ...createSnapshotMessage(
        this.tick,
        Object.fromEntries(
          [...this.players].map(([id, state]) => [id, state.lastProcessedSeq])
        ),
        entities
      ),
      seed: this.seed,
      serverTime: Date.now(),
    };

    this.room.broadcast(snapshot);
    this.#nextTickAt += TICK_INTERVAL_MS;
    this.#scheduleTick();
  }

  #serializeEntity(entity, playerId = null) {
    const snapshot = {
      id: entity.id,
      kind: entity.kind,
      pos: { x: entity.pos.x, y: entity.pos.y },
      vel: { x: entity.vel.x, y: entity.vel.y },
      x: entity.pos.x,
      y: entity.pos.y,
      angle: entity.angle,
      radius: entity.radius,
      alive: entity.alive,
      playerId,
    };

    if (entity.kind === "mainShip") {
      snapshot.playerName = entity.playerName;
      snapshot.thrust = entity.thrust;
      snapshot.score = entity.score;
      snapshot.hasShield = entity.hasShield;
    } else if (entity.kind === "miniRocket") {
      snapshot.ownerPlayerId = playerIdByOwner(this.players, entity.owner);
    } else if (entity.kind === "pickup") {
      snapshot.effect = entity.effect;
    } else if (entity.kind === "explosion") {
      snapshot.particles = entity.particles.map((particle) => ({
        pos: { x: particle.pos.x, y: particle.pos.y },
        radius: particle.radius,
      }));
    }

    return snapshot;
  }
}

function playerIdByOwner(players, owner) {
  for (const [playerId, state] of players) {
    if (state.ship === owner) return playerId;
  }
  return null;
}
