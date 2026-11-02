/*
 * Binary protocol v1 uses little-endian numbers. Each packet starts with
 * version:u8 and type:u8.
 *
 * Input: seq:u32, tick:u32, thrust:i8, turn:i8, fire:u8.
 *
 * Snapshot: tick:u32, seed:u32, serverTime:f64, ackCount:u8,
 * entityCount:u16; then ackCount (playerId:string, seq:u32) records.
 * Each entity has id:u32, kind:u8, alive:u8, x/y/velX/velY:f32,
 * angle:i16 (radians * 1000), radius:f32, then:
 *   ship: playerId:string, playerName:string, thrust:f32, score:u32,
 *         hasShield:u8;
 *   rocket: ownerPlayerId:string, hasFireSeq:u8, optional fireSeq:u32;
 *   pickup: effect:u8;
 *   explosion: particleCount:u8, then that many (x/y/radius:f32) particles.
 *
 * Strings are UTF-8 with a u8 byte length; 0 means null. Decoding also fills
 * pos/vel from x/y/velX/velY. Angles are rounded to 0.001-radian steps.
 */
export const BinaryMessageTypes = {
  INPUT: 1,
  SNAPSHOT: 2,
};

export const BinaryEntityKinds = {
  MAIN_SHIP: 1,
  MINI_ROCKET: 2,
  BLIBLIE: 3,
  EXPLOSION: 4,
  PICKUP: 5,
};

export const BINARY_PROTOCOL_VERSION = 1;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const ENTITY_KIND_BY_NAME = {
  mainShip: BinaryEntityKinds.MAIN_SHIP,
  miniRocket: BinaryEntityKinds.MINI_ROCKET,
  bliblie: BinaryEntityKinds.BLIBLIE,
  explosion: BinaryEntityKinds.EXPLOSION,
  pickup: BinaryEntityKinds.PICKUP,
};

const ENTITY_NAME_BY_KIND = Object.fromEntries(
  Object.entries(ENTITY_KIND_BY_NAME).map(([name, kind]) => [kind, name]),
);

class BinaryWriter {
  constructor() {
    this.buffer = new ArrayBuffer(256);
    this.view = new DataView(this.buffer);
    this.length = 0;
  }

  reserve(size) {
    const requiredLength = this.length + size;
    if (requiredLength > this.buffer.byteLength) {
      let capacity = this.buffer.byteLength;
      while (capacity < requiredLength) capacity *= 2;
      const buffer = new ArrayBuffer(capacity);
      new Uint8Array(buffer).set(new Uint8Array(this.buffer, 0, this.length));
      this.buffer = buffer;
      this.view = new DataView(buffer);
    }

    const offset = this.length;
    this.length = requiredLength;
    return offset;
  }

  writeUint8(value) {
    this.view.setUint8(this.reserve(1), value);
  }

  writeInt8(value) {
    this.view.setInt8(this.reserve(1), value);
  }

  writeUint16(value) {
    this.view.setUint16(this.reserve(2), value, true);
  }

  writeInt16(value) {
    this.view.setInt16(this.reserve(2), value, true);
  }

  writeUint32(value) {
    this.view.setUint32(this.reserve(4), value, true);
  }

  writeFloat32(value) {
    this.view.setFloat32(this.reserve(4), value, true);
  }

  writeFloat64(value) {
    this.view.setFloat64(this.reserve(8), value, true);
  }

  writeString(value) {
    if (value === null) {
      this.writeUint8(0);
      return;
    }
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError("Binary strings must be non-empty strings or null");
    }

    const bytes = textEncoder.encode(value);
    if (bytes.length > 255) {
      throw new RangeError("Binary string exceeds 255 UTF-8 bytes");
    }

    this.writeUint8(bytes.length);
    const offset = this.reserve(bytes.length);
    new Uint8Array(this.buffer, offset, bytes.length).set(bytes);
  }

  finish() {
    return this.buffer.slice(0, this.length);
  }
}

class BinaryReader {
  constructor(data) {
    if (data instanceof ArrayBuffer) {
      this.view = new DataView(data);
    } else if (ArrayBuffer.isView(data)) {
      this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    } else {
      throw new TypeError("Binary message must be an ArrayBuffer or view");
    }
    this.offset = 0;
  }

  read(method, size, ...args) {
    if (this.offset + size > this.view.byteLength) {
      throw new RangeError("Binary message is truncated");
    }
    const value = this.view[method](this.offset, ...args);
    this.offset += size;
    return value;
  }

  readUint8() {
    return this.read("getUint8", 1);
  }

  readInt8() {
    return this.read("getInt8", 1);
  }

  readUint16() {
    return this.read("getUint16", 2, true);
  }

  readInt16() {
    return this.read("getInt16", 2, true);
  }

  readUint32() {
    return this.read("getUint32", 4, true);
  }

  readFloat32() {
    return this.read("getFloat32", 4, true);
  }

  readFloat64() {
    return this.read("getFloat64", 8, true);
  }

  readString() {
    const length = this.readUint8();
    if (length === 0) return null;
    if (this.offset + length > this.view.byteLength) {
      throw new RangeError("Binary string is truncated");
    }

    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.offset,
      length,
    );
    this.offset += length;
    return textDecoder.decode(bytes);
  }

  finish() {
    if (this.offset !== this.view.byteLength) {
      throw new RangeError("Binary message has trailing bytes");
    }
  }
}

function assertInteger(value, max, field) {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${field} must be an integer from 0 to ${max}`);
  }
}

function writeFiniteFloat32(writer, value, field) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  writer.writeFloat32(value);
}

function writeAngle(writer, angle) {
  if (!Number.isFinite(angle)) {
    throw new TypeError("Entity angle must be a finite number");
  }
  const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  writer.writeInt16(Math.round(normalized * 1000));
}

function writeEntity(writer, entity) {
  assertInteger(entity.id, 0xffffffff, "Entity id");
  const kind = ENTITY_KIND_BY_NAME[entity.kind];
  if (!kind) throw new TypeError(`Unsupported entity kind: ${entity.kind}`);

  writer.writeUint32(entity.id);
  writer.writeUint8(kind);
  writer.writeUint8(entity.alive ? 1 : 0);
  writeFiniteFloat32(writer, entity.x, "Entity x");
  writeFiniteFloat32(writer, entity.y, "Entity y");
  writeFiniteFloat32(writer, entity.vel.x, "Entity velocity x");
  writeFiniteFloat32(writer, entity.vel.y, "Entity velocity y");
  writeAngle(writer, entity.angle);
  writeFiniteFloat32(writer, entity.radius, "Entity radius");

  if (entity.kind === "mainShip") {
    writer.writeString(entity.playerId);
    writer.writeString(entity.playerName);
    writeFiniteFloat32(writer, entity.thrust, "Ship thrust");
    assertInteger(entity.score, 0xffffffff, "Ship score");
    writer.writeUint32(entity.score);
    writer.writeUint8(entity.hasShield ? 1 : 0);
  } else if (entity.kind === "miniRocket") {
    writer.writeString(entity.ownerPlayerId);
    writer.writeUint8(entity.fireSeq === null ? 0 : 1);
    if (entity.fireSeq !== null) {
      assertInteger(entity.fireSeq, 0xffffffff, "Rocket fire sequence");
      writer.writeUint32(entity.fireSeq);
    }
  } else if (entity.kind === "pickup") {
    if (entity.effect !== "shield") {
      throw new TypeError(`Unsupported pickup effect: ${entity.effect}`);
    }
    writer.writeUint8(1);
  } else if (entity.kind === "explosion") {
    if (entity.particles.length > 255) {
      throw new RangeError("Explosion exceeds 255 particles");
    }
    writer.writeUint8(entity.particles.length);
    for (const particle of entity.particles) {
      writeFiniteFloat32(writer, particle.pos.x, "Particle x");
      writeFiniteFloat32(writer, particle.pos.y, "Particle y");
      writeFiniteFloat32(writer, particle.radius, "Particle radius");
    }
  }
}

function readEntity(reader) {
  const id = reader.readUint32();
  const kind = ENTITY_NAME_BY_KIND[reader.readUint8()];
  if (!kind) throw new TypeError("Unsupported binary entity kind");
  const aliveValue = reader.readUint8();
  if (aliveValue > 1) throw new TypeError("Invalid entity alive flag");
  const x = reader.readFloat32();
  const y = reader.readFloat32();
  const velX = reader.readFloat32();
  const velY = reader.readFloat32();
  const angle = reader.readInt16() / 1000;
  const radius = reader.readFloat32();
  const entity = {
    id,
    kind,
    pos: { x, y },
    vel: { x: velX, y: velY },
    x,
    y,
    angle,
    radius,
    alive: aliveValue === 1,
    playerId: null,
  };

  if (kind === "mainShip") {
    entity.playerId = reader.readString();
    entity.playerName = reader.readString();
    entity.thrust = reader.readFloat32();
    entity.score = reader.readUint32();
    const hasShield = reader.readUint8();
    if (hasShield > 1) throw new TypeError("Invalid ship shield flag");
    entity.hasShield = hasShield === 1;
  } else if (kind === "miniRocket") {
    entity.ownerPlayerId = reader.readString();
    const hasFireSeq = reader.readUint8();
    if (hasFireSeq > 1) throw new TypeError("Invalid rocket sequence flag");
    entity.fireSeq = hasFireSeq === 1 ? reader.readUint32() : null;
  } else if (kind === "pickup") {
    if (reader.readUint8() !== 1) {
      throw new TypeError("Unsupported binary pickup effect");
    }
    entity.effect = "shield";
  } else if (kind === "explosion") {
    const particleCount = reader.readUint8();
    entity.particles = Array.from({ length: particleCount }, () => ({
      pos: { x: reader.readFloat32(), y: reader.readFloat32() },
      radius: reader.readFloat32(),
    }));
  }

  return entity;
}

export function encodeBinaryMessage(message) {
  const writer = new BinaryWriter();
  writer.writeUint8(BINARY_PROTOCOL_VERSION);

  if (message.type === "input") {
    writer.writeUint8(BinaryMessageTypes.INPUT);
    assertInteger(message.seq, 0xffffffff, "Input sequence");
    assertInteger(message.tick, 0xffffffff, "Input tick");
    if (![-1, 0, 1].includes(message.thrust)) {
      throw new RangeError("Input thrust must be -1, 0, or 1");
    }
    if (![-1, 0, 1].includes(message.turn)) {
      throw new RangeError("Input turn must be -1, 0, or 1");
    }
    if (typeof message.fire !== "boolean") {
      throw new TypeError("Input fire must be a boolean");
    }
    writer.writeUint32(message.seq);
    writer.writeUint32(message.tick);
    writer.writeInt8(message.thrust);
    writer.writeInt8(message.turn);
    writer.writeUint8(message.fire ? 1 : 0);
  } else if (message.type === "snapshot") {
    writer.writeUint8(BinaryMessageTypes.SNAPSHOT);
    assertInteger(message.tick, 0xffffffff, "Snapshot tick");
    assertInteger(message.seed, 0xffffffff, "Snapshot seed");
    if (!Number.isFinite(message.serverTime)) {
      throw new TypeError("Snapshot serverTime must be a finite number");
    }
    const acknowledgements = Object.entries(message.lastProcessedSeq);
    if (acknowledgements.length > 255 || message.entities.length > 65535) {
      throw new RangeError("Snapshot contains too many records");
    }

    writer.writeUint32(message.tick);
    writer.writeUint32(message.seed);
    writer.writeFloat64(message.serverTime);
    writer.writeUint8(acknowledgements.length);
    writer.writeUint16(message.entities.length);
    for (const [playerId, seq] of acknowledgements) {
      writer.writeString(playerId);
      assertInteger(seq, 0xffffffff, "Acknowledged input sequence");
      writer.writeUint32(seq);
    }
    for (const entity of message.entities) writeEntity(writer, entity);
  } else {
    throw new TypeError(`Unsupported binary message type: ${message.type}`);
  }

  return writer.finish();
}

export function decodeBinaryMessage(data) {
  const reader = new BinaryReader(data);
  const version = reader.readUint8();
  if (version !== BINARY_PROTOCOL_VERSION) {
    throw new TypeError(`Unsupported binary protocol version: ${version}`);
  }

  const messageType = reader.readUint8();
  let message;
  if (messageType === BinaryMessageTypes.INPUT) {
    const seq = reader.readUint32();
    const tick = reader.readUint32();
    const thrust = reader.readInt8();
    const turn = reader.readInt8();
    const fire = reader.readUint8();
    if (![-1, 0, 1].includes(thrust) || ![-1, 0, 1].includes(turn)) {
      throw new TypeError("Invalid binary input values");
    }
    if (fire > 1) throw new TypeError("Invalid binary fire flag");
    message = { type: "input", seq, tick, thrust, turn, fire: fire === 1 };
  } else if (messageType === BinaryMessageTypes.SNAPSHOT) {
    const tick = reader.readUint32();
    const seed = reader.readUint32();
    const serverTime = reader.readFloat64();
    const ackCount = reader.readUint8();
    const entityCount = reader.readUint16();
    const lastProcessedSeq = {};
    for (let i = 0; i < ackCount; i += 1) {
      const playerId = reader.readString();
      if (playerId === null) {
        throw new TypeError("Acknowledgement player id cannot be null");
      }
      lastProcessedSeq[playerId] = reader.readUint32();
    }
    const entities = Array.from({ length: entityCount }, () =>
      readEntity(reader),
    );
    message = {
      type: "snapshot",
      tick,
      lastProcessedSeq,
      entities,
      seed,
      serverTime,
    };
  } else {
    throw new TypeError(`Unsupported binary message type: ${messageType}`);
  }

  reader.finish();
  return message;
}
