import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { decodeBinaryMessage, encodeBinaryMessage } from "../codec/binary.ts";
import {
  InputMessageSchema,
  parseClientMessage,
  SnapshotMessageSchema,
} from "../protocol.ts";
import { createSeededRandom } from "../sim/prng.ts";
import { integrateShip } from "../sim/integrate.ts";
import { wrap } from "../sim/arena.ts";
import { Vector2 } from "../sim/vector.ts";

const uint32 = fc.integer({ min: 0, max: 0xffffffff });
const finiteFloat = fc.double({
  min: -100_000,
  max: 100_000,
  noNaN: true,
  noDefaultInfinity: true,
});
const idString = fc.stringMatching(/^[a-zA-Z0-9]{1,12}$/);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fast-check properties (100 generated cases each)", () => {
  it("round-trips every generated valid binary input", () => {
    fc.assert(
      fc.property(
        uint32,
        uint32,
        fc.constantFrom(-1, 0, 1),
        fc.constantFrom(-1, 0, 1),
        fc.boolean(),
        (seq, tick, thrust, turn, fire) => {
          const message = InputMessageSchema.parse({
            type: "input" as const,
            seq,
            tick,
            thrust,
            turn,
            fire,
          });
          const encoded = encodeBinaryMessage(message);
          expect(encoded.byteLength).toBe(13);
          const decoded = decodeBinaryMessage(encoded);
          expect(decoded).toEqual(message);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("round-trips generated snapshots within Float32 and angle precision", () => {
    fc.assert(
      fc.property(
        uint32,
        uint32,
        finiteFloat,
        finiteFloat,
        finiteFloat,
        finiteFloat,
        finiteFloat,
        (tick, seed, x, y, vx, vy, angle) => {
          const message = SnapshotMessageSchema.parse({
            type: "snapshot",
            tick,
            seed,
            serverTime: 1_700_000_000_000,
            lastProcessedSeq: {},
            entities: [
              {
                id: 1,
                kind: "bliblie",
                pos: new Vector2(x, y),
                vel: new Vector2(vx, vy),
                x,
                y,
                angle,
                radius: 5,
                alive: true,
                playerId: null,
              },
            ],
          });
          const decoded = decodeBinaryMessage(encodeBinaryMessage(message));
          if (decoded.type !== "snapshot") throw new Error("Expected snapshot");
          expect(decoded.tick).toBe(tick);
          expect(decoded.seed).toBe(seed);
          expect(decoded.entities[0]?.x).toBeCloseTo(Math.fround(x), 2);
          expect(decoded.entities[0]?.y).toBeCloseTo(Math.fround(y), 2);
          expect(decoded.entities[0]?.vel.x).toBeCloseTo(Math.fround(vx), 2);
          expect(decoded.entities[0]?.vel.y).toBeCloseTo(Math.fround(vy), 2);
          expect(decoded.entities[0]?.angle).toBeCloseTo(
            Math.round(Math.atan2(Math.sin(angle), Math.cos(angle)) * 1000) /
              1000,
            3,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("encodes an empty snapshot to its specified 21-byte header", () => {
    fc.assert(
      fc.property(uint32, uint32, finiteFloat, (tick, seed, serverTime) => {
        const message = SnapshotMessageSchema.parse({
          type: "snapshot",
          tick,
          seed,
          serverTime,
          lastProcessedSeq: {},
          entities: [],
        });
        expect(encodeBinaryMessage(message).byteLength).toBe(21);
      }),
      { numRuns: 100 },
    );
  });

  it("never leaks unexpected exceptions when decoding arbitrary byte buffers", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 128 }), (bytes) => {
        try {
          decodeBinaryMessage(bytes);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(["TypeError", "RangeError"]).toContain((error as Error).name);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("keeps a ship inside the arena through 1,000 random control steps", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1200, noNaN: true }),
        fc.double({ min: 0, max: 800, noNaN: true }),
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.double({ min: -300, max: 300, noNaN: true }),
        fc.array(
          fc.record({
            turn: fc.integer({ min: -1, max: 1 }),
            thrust: fc.integer({ min: -1, max: 1 }),
          }),
          { minLength: 1000, maxLength: 1000 },
        ),
        (x, y, vx, vy, controls) => {
          let ship = {
            pos: new Vector2(x, y),
            vel: new Vector2(vx, vy),
            angle: 0,
            thrust: 0,
          };
          for (const control of controls) {
            ship = integrateShip(ship, control, 1 / 30);
            wrap(ship, 1200, 800);
            if (
              ship.pos.x < 0 ||
              ship.pos.x > 1200 ||
              ship.pos.y < 0 ||
              ship.pos.y > 800
            ) {
              throw new Error("Ship left the arena");
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 30_000);

  it("accepts generated valid client messages and rejects generated mutations", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const message = fc.oneof(
      fc.record({
        type: fc.constant("join" as const),
        room: idString,
        name: idString,
      }),
      fc.record({
        type: fc.constant("input" as const),
        seq: uint32,
        tick: uint32,
        thrust: fc.integer({ min: -1, max: 1 }),
        turn: fc.integer({ min: -1, max: 1 }),
        fire: fc.boolean(),
      }),
      fc.record({
        type: fc.constant("chat" as const),
        text: idString,
      }),
    );

    fc.assert(
      fc.property(
        message,
        fc.constantFrom("type", "extra", "nullField"),
        (validMessage, mutation) => {
          expect(parseClientMessage(validMessage).success).toBe(true);
          const firstKey = Object.keys(validMessage)[0] ?? "type";
          const mutated =
            mutation === "type"
              ? { ...validMessage, type: "invalid" }
              : mutation === "extra"
                ? { ...validMessage, extraField: true }
                : { ...validMessage, [firstKey]: null };
          expect(parseClientMessage(mutated).success).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
    expect(errorSpy).toHaveBeenCalled();
  });

  it("produces the same random sequence from the same seed", () => {
    fc.assert(
      fc.property(uint32, fc.integer({ min: 1, max: 100 }), (seed, count) => {
        const first = createSeededRandom(seed);
        const second = createSeededRandom(seed);
        for (let i = 0; i < count; i += 1) {
          expect(first()).toBe(second());
        }
      }),
      { numRuns: 100 },
    );
  });
});
