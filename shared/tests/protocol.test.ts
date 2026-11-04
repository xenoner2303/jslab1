import assert from "node:assert/strict";
import { it, vi, type MockInstance } from "vitest";
import {
  EntitySnapshotSchema,
  parseClientMessage,
  parseServerMessage,
} from "../protocol.ts";
import { getCodec } from "../codec/index.ts";
import { Vector2 } from "../sim/vector.ts";

const shipState = EntitySnapshotSchema.parse({
  id: 1,
  kind: "mainShip",
  pos: new Vector2(10, 20),
  vel: new Vector2(0, 0),
  x: 10,
  y: 20,
  angle: 0,
  radius: 5,
  alive: true,
  playerId: "player-1",
  playerName: "Pilot",
  thrust: 0,
  score: 0,
  hasShield: false,
});

it("client schema parses join, input, and chat messages", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  assert.equal(
    parseClientMessage({ type: "join", room: "room-1", name: "Pilot" }).success,
    true,
  );
  assert.equal(
    parseClientMessage({
      type: "input",
      seq: 1,
      tick: 2,
      thrust: 1,
      turn: -1,
      fire: false,
    }).success,
    true,
  );
  assert.equal(
    parseClientMessage({ type: "chat", text: "hello" }).success,
    true,
  );
  assert.equal(
    parseClientMessage({
      type: "input",
      seq: 1,
      tick: 2,
      thrust: 3,
      turn: 0,
      fire: false,
    }).success,
    false,
  );
  expectErrorSpy(errorSpy);
});

it("server schema parses joined, snapshot, chat, and roster messages", () => {
  const snapshot = {
    type: "snapshot",
    tick: 2,
    lastProcessedSeq: { "player-1": 1 },
    entities: [shipState],
    seed: 3,
    serverTime: Date.now(),
  };
  const messages = [
    { type: "joined", playerId: "player-1", state: shipState, seed: 3 },
    snapshot,
    { type: "chat", sender: "Pilot", text: "hello", time: Date.now() },
    {
      type: "roster",
      players: [{ id: "player-1", name: "Pilot", state: shipState }],
    },
  ];

  for (const message of messages) {
    assert.equal(parseServerMessage(message).success, true);
  }
});

it("JSON codec validates outbound data and leaves inbound parsing to protocol", () => {
  const codec = getCodec("json");
  const encoded = codec.encode({
    type: "chat",
    sender: "Pilot",
    text: "hello",
    time: Date.now(),
  });
  assert.equal(typeof encoded, "string");
  assert.equal(parseServerMessage(codec.decode(encoded)).success, true);
  assert.throws(
    () => codec.encode({ type: "chat", sender: "", text: "hello", time: 0 }),
    /Invalid JSON message/,
  );
});

it("binary codec accepts protocol binary messages without casts", () => {
  const codec = getCodec("binary");
  const parsed = parseClientMessage({
    type: "input",
    seq: 1,
    tick: 2,
    thrust: 1,
    turn: 0,
    fire: false,
  });
  if (!parsed.success) throw new Error(parsed.error);
  const decoded = codec.decode(codec.encode(parsed.data));
  assert.equal(parseClientMessage(decoded).success, true);
});

it("reports invalid client messages as parse results without throwing", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  for (const value of [null, [], "not a message", { type: "unknown" }]) {
    assert.equal(parseClientMessage(value).success, false);
  }
  expectErrorSpy(errorSpy);
});

it("reports invalid server messages as parse results", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  assert.equal(
    parseServerMessage({ type: "snapshot", entities: [] }).success,
    false,
  );
  expectErrorSpy(errorSpy);
});

it("decodes JSON from a byte view while respecting its offset", () => {
  const codec = getCodec("json");
  const message = new TextEncoder().encode('{"type":"chat","text":"hello"}');
  const wrapped = new Uint8Array(message.length + 4);
  wrapped.set(message, 2);
  assert.deepEqual(codec.decode(wrapped.subarray(2, 2 + message.length)), {
    type: "chat",
    text: "hello",
  });
});

it("rejects data with the wrong codec transport type", () => {
  const json = getCodec("json");
  const binary = getCodec("binary");
  assert.throws(() => json.decode(new ArrayBuffer(1)), /string or byte view/);
  assert.throws(() => binary.decode("not binary"), /ArrayBuffer or view/);
});

it("rejects malformed JSON", () => {
  const codec = getCodec("json");
  assert.throws(() => codec.decode("{"), SyntaxError);
});

function expectErrorSpy(spy: MockInstance<typeof console.error>) {
  assert.equal(spy.mock.calls.length > 0, true);
  spy.mockRestore();
}
