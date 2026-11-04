import { describe, expect, it } from "vitest";
import { createInputMessage, createSnapshotMessage } from "../protocol/messages.ts";
import { EntitySnapshotSchema, SeqSchema, TickSchema } from "../protocol.ts";
import { Vector2 } from "../sim/vector.ts";

const ship = EntitySnapshotSchema.parse({
  id: 1,
  kind: "mainShip",
  pos: new Vector2(1, 2),
  vel: new Vector2(0, 0),
  x: 1,
  y: 2,
  angle: 0,
  radius: 5,
  alive: true,
  playerId: "p1",
  playerName: "Pilot",
  thrust: 0,
  score: 0,
  hasShield: false,
});

describe("protocol message helpers", () => {
  it("creates a valid input message", () => {
    expect(
      createInputMessage({ seq: 1, tick: 2, thrust: 1, turn: -1, fire: true }),
    ).toEqual({
      type: "input",
      seq: 1,
      tick: 2,
      thrust: 1,
      turn: -1,
      fire: true,
    });
  });

  it("rejects an invalid input payload", () => {
    expect(() =>
      createInputMessage({
        seq: -1,
        tick: 2,
        thrust: 0,
        turn: 0,
        fire: false,
      }),
    ).toThrow();
  });

  it("creates a snapshot with the provided tick, acknowledgements, and entities", () => {
    expect(
      createSnapshotMessage(TickSchema.parse(3), { p1: SeqSchema.parse(2) }, [
        ship,
      ]),
    ).toEqual({
      type: "snapshot",
      tick: 3,
      lastProcessedSeq: { p1: 2 },
      entities: [ship],
    });
  });
});
