import assert from "node:assert/strict";
import test from "node:test";
import { decodeBinaryMessage, encodeBinaryMessage } from "./binary.js";

const float32 = (value) => new Float32Array([value])[0];
const quantizedAngle = (angle) =>
  Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) * 1000) / 1000;

const input = {
  type: "input",
  seq: 42,
  tick: 100,
  thrust: 1,
  turn: -1,
  fire: true,
};

const snapshot = {
  type: "snapshot",
  tick: 100,
  lastProcessedSeq: { "player-1": 42, "player-2": 39 },
  entities: [
    {
      id: 1,
      kind: "mainShip",
      pos: { x: 100.25, y: 200.5 },
      vel: { x: 1.25, y: -2.5 },
      x: 100.25,
      y: 200.5,
      angle: Math.PI / 2,
      radius: 30.5,
      alive: true,
      playerId: "player-1",
      playerName: "Pilot",
      thrust: 10.25,
      score: 3,
      hasShield: true,
    },
    {
      id: 2,
      kind: "miniRocket",
      pos: { x: 11.5, y: 22.25 },
      vel: { x: 3.5, y: 4.25 },
      x: 11.5,
      y: 22.25,
      angle: -0.75,
      radius: 2.5,
      alive: true,
      playerId: null,
      ownerPlayerId: "player-1",
      fireSeq: 42,
    },
    {
      id: 3,
      kind: "bliblie",
      pos: { x: 1.5, y: 2.5 },
      vel: { x: -3.5, y: 4.5 },
      x: 1.5,
      y: 2.5,
      angle: 0.125,
      radius: 12.5,
      alive: true,
      playerId: null,
    },
    {
      id: 4,
      kind: "pickup",
      pos: { x: 8.5, y: 9.5 },
      vel: { x: 0, y: 0 },
      x: 8.5,
      y: 9.5,
      angle: 0,
      radius: 5.5,
      alive: true,
      playerId: null,
      effect: "shield",
    },
    {
      id: 5,
      kind: "explosion",
      pos: { x: 40.5, y: 50.25 },
      vel: { x: 0, y: 0 },
      x: 40.5,
      y: 50.25,
      angle: 0,
      radius: 0,
      alive: true,
      playerId: null,
      particles: [
        { pos: { x: 1.25, y: 2.5 }, radius: 0.75 },
        { pos: { x: -3.5, y: 4.25 }, radius: 1.5 },
      ],
    },
  ],
  seed: 123456,
  serverTime: 1730000000123,
};

function expectedSnapshot() {
  return {
    ...snapshot,
    entities: snapshot.entities.map((entity) => ({
      ...entity,
      angle: quantizedAngle(entity.angle),
      radius: float32(entity.radius),
      pos: { x: float32(entity.x), y: float32(entity.y) },
      vel: { x: float32(entity.vel.x), y: float32(entity.vel.y) },
      x: float32(entity.x),
      y: float32(entity.y),
      ...(entity.kind === "mainShip" ? { thrust: float32(entity.thrust) } : {}),
      ...(entity.kind === "explosion"
        ? {
            particles: entity.particles.map((particle) => ({
              pos: {
                x: float32(particle.pos.x),
                y: float32(particle.pos.y),
              },
              radius: float32(particle.radius),
            })),
          }
        : {}),
    })),
  };
}

test("input binary codec round-trips", () => {
  assert.deepEqual(decodeBinaryMessage(encodeBinaryMessage(input)), input);
});

test("snapshot binary codec round-trips with float and angle quantization", () => {
  assert.deepEqual(
    decodeBinaryMessage(encodeBinaryMessage(snapshot)),
    expectedSnapshot(),
  );
});

test("binary codec accepts typed-array views with offsets", () => {
  const encoded = encodeBinaryMessage(input);
  const wrapped = new Uint8Array(encoded.byteLength + 4);
  wrapped.set(new Uint8Array(encoded), 2);
  assert.deepEqual(
    decodeBinaryMessage(wrapped.subarray(2, 2 + encoded.byteLength)),
    input,
  );
});

test("snapshot encoding grows its buffer for larger messages", () => {
  const largeSnapshot = {
    ...snapshot,
    entities: Array.from({ length: 20 }, (_, index) => ({
      ...snapshot.entities[2],
      id: index + 1,
    })),
  };
  assert.equal(
    decodeBinaryMessage(encodeBinaryMessage(largeSnapshot)).entities.length,
    largeSnapshot.entities.length,
  );
});

test("binary codec rejects unsupported versions and malformed packets", () => {
  assert.throws(
    () => decodeBinaryMessage(new Uint8Array([99, 1])),
    /Unsupported binary protocol version/,
  );
  assert.throws(
    () => decodeBinaryMessage(new Uint8Array([1, 1, 0])),
    /truncated/,
  );
  assert.throws(
    () => decodeBinaryMessage(new Uint8Array([1, 1, 0, ...new Uint8Array(13)])),
    /trailing bytes/,
  );
});
