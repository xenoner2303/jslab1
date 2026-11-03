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
import {
  BinaryMessageSchema,
  EntityIdSchema,
  SeqSchema,
  TickSchema,
  type BinaryMessage,
  type ClientInputMessage,
  type EntitySnapshot,
  type Seq,
  type SnapshotMessage,
  type Tick,
} from "../protocol.ts";
import { Vector2 } from "../sim/vector.ts";

export type {
  BinaryMessage,
  EntitySnapshot,
  Seq,
  SnapshotMessage,
  Tick,
} from "../protocol.ts";
export type EntityId = EntitySnapshot["id"];
export type InputMessage = ClientInputMessage;

export const BinaryMessageTypes: {
  readonly INPUT: 1;
  readonly SNAPSHOT: 2;
} = {
  INPUT: 1,
  SNAPSHOT: 2,
};

export const BinaryEntityKinds: {
  readonly MAIN_SHIP: 1;
  readonly MINI_ROCKET: 2;
  readonly BLIBLIE: 3;
  readonly EXPLOSION: 4;
  readonly PICKUP: 5;
} = {
  MAIN_SHIP: 1,
  MINI_ROCKET: 2,
  BLIBLIE: 3,
  EXPLOSION: 4,
  PICKUP: 5,
};

export const BINARY_PROTOCOL_VERSION = 1;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const ENTITY_KIND_BY_NAME: Record<EntitySnapshot["kind"], number> = {
  mainShip: BinaryEntityKinds.MAIN_SHIP,
  miniRocket: BinaryEntityKinds.MINI_ROCKET,
  bliblie: BinaryEntityKinds.BLIBLIE,
  explosion: BinaryEntityKinds.EXPLOSION,
  pickup: BinaryEntityKinds.PICKUP,
};

const ENTITY_NAME_BY_KIND: Record<number, EntitySnapshot["kind"]> = {
  [BinaryEntityKinds.MAIN_SHIP]: "mainShip",
  [BinaryEntityKinds.MINI_ROCKET]: "miniRocket",
  [BinaryEntityKinds.BLIBLIE]: "bliblie",
  [BinaryEntityKinds.EXPLOSION]: "explosion",
  [BinaryEntityKinds.PICKUP]: "pickup",
};

class BinaryWriter {
  private buffer: ArrayBuffer;
  private view: DataView;
  private length: number;

  constructor() {
    this.buffer = new ArrayBuffer(256);
    this.view = new DataView(this.buffer);
    this.length = 0;
  }

  private reserve(size: number): number {
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

  writeUint8(value: number): void {
    const offset = this.reserve(1);
    this.view.setUint8(offset, value);
  }

  writeInt8(value: number): void {
    const offset = this.reserve(1);
    this.view.setInt8(offset, value);
  }

  writeUint16(value: number): void {
    const offset = this.reserve(2);
    this.view.setUint16(offset, value, true);
  }

  writeInt16(value: number): void {
    const offset = this.reserve(2);
    this.view.setInt16(offset, value, true);
  }

  writeUint32(value: number): void {
    const offset = this.reserve(4);
    this.view.setUint32(offset, value, true);
  }

  writeFloat32(value: number): void {
    const offset = this.reserve(4);
    this.view.setFloat32(offset, value, true);
  }

  writeFloat64(value: number): void {
    const offset = this.reserve(8);
    this.view.setFloat64(offset, value, true);
  }

  writeString(value: string | null): void {
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

  finish(): ArrayBuffer {
    return this.buffer.slice(0, this.length);
  }
}

class BinaryReader {
  private view: DataView;
  private offset: number;

  constructor(data: ArrayBuffer | ArrayBufferView) {
    if (data instanceof ArrayBuffer) {
      this.view = new DataView(data);
    } else if (ArrayBuffer.isView(data)) {
      this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    } else {
      throw new TypeError("Binary message must be an ArrayBuffer or view");
    }
    this.offset = 0;
  }

  private read(
    size: number,
    getter: (view: DataView, offset: number) => number,
  ): number {
    if (this.offset + size > this.view.byteLength) {
      throw new RangeError("Binary message is truncated");
    }
    const value = getter(this.view, this.offset);
    this.offset += size;
    return value;
  }

  readUint8(): number {
    return this.read(1, (view, offset) => view.getUint8(offset));
  }
  readInt8(): number {
    return this.read(1, (view, offset) => view.getInt8(offset));
  }
  readUint16(): number {
    return this.read(2, (view, offset) => view.getUint16(offset, true));
  }
  readInt16(): number {
    return this.read(2, (view, offset) => view.getInt16(offset, true));
  }
  readUint32(): number {
    return this.read(4, (view, offset) => view.getUint32(offset, true));
  }
  readFloat32(): number {
    return this.read(4, (view, offset) => view.getFloat32(offset, true));
  }
  readFloat64(): number {
    return this.read(8, (view, offset) => view.getFloat64(offset, true));
  }

  readString(): string | null {
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

  finish(): void {
    if (this.offset !== this.view.byteLength) {
      throw new RangeError("Binary message has trailing bytes");
    }
  }
}

function assertInteger(value: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`${field} must be an integer from 0 to ${max}`);
  }
}

function isAxisInput(value: number): value is -1 | 0 | 1 {
  return value === -1 || value === 0 || value === 1;
}

function writeFiniteFloat32(writer: BinaryWriter, value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
  writer.writeFloat32(value);
}

function writeAngle(writer: BinaryWriter, angle: number): void {
  if (!Number.isFinite(angle)) {
    throw new TypeError("Entity angle must be a finite number");
  }
  const normalized = Math.atan2(Math.sin(angle), Math.cos(angle));
  writer.writeInt16(Math.round(normalized * 1000));
}

function writeEntity(writer: BinaryWriter, entity: EntitySnapshot): void {
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

  switch (entity.kind) {
    case "mainShip":
      writer.writeString(entity.playerId);
      writer.writeString(entity.playerName);
      writeFiniteFloat32(writer, entity.thrust, "Ship thrust");
      assertInteger(entity.score, 0xffffffff, "Ship score");
      writer.writeUint32(entity.score);
      writer.writeUint8(entity.hasShield ? 1 : 0);
      break;
    case "miniRocket":
      writer.writeString(entity.ownerPlayerId);
      writer.writeUint8(entity.fireSeq === null ? 0 : 1);
      if (entity.fireSeq !== null) {
        assertInteger(entity.fireSeq, 0xffffffff, "Rocket fire sequence");
        writer.writeUint32(entity.fireSeq);
      }
      break;
    case "pickup":
      if (entity.effect !== "shield") {
        throw new TypeError(`Unsupported pickup effect: ${entity.effect}`);
      }
      writer.writeUint8(1);
      break;
    case "explosion":
      if (entity.particles.length > 255) {
        throw new RangeError("Explosion exceeds 255 particles");
      }
      writer.writeUint8(entity.particles.length);
      for (const particle of entity.particles) {
        writeFiniteFloat32(writer, particle.pos.x, "Particle x");
        writeFiniteFloat32(writer, particle.pos.y, "Particle y");
        writeFiniteFloat32(writer, particle.radius, "Particle radius");
      }
      break;
    case "bliblie":
      break;
    default: {
      const _exhaustive: never = entity;
      return _exhaustive;
    }
  }
}

function readEntity(reader: BinaryReader): EntitySnapshot {
  const id = EntityIdSchema.parse(reader.readUint32());
  const kindNum = reader.readUint8();
  const kind = ENTITY_NAME_BY_KIND[kindNum];
  if (!kind) throw new TypeError("Unsupported binary entity kind");
  const aliveValue = reader.readUint8();
  if (aliveValue > 1) throw new TypeError("Invalid entity alive flag");
  const x = reader.readFloat32();
  const y = reader.readFloat32();
  const velX = reader.readFloat32();
  const velY = reader.readFloat32();
  const angle = reader.readInt16() / 1000;
  const radius = reader.readFloat32();
  
  // Створюємо справжні інстанси Vector2 замість звичайних об'єктів
  const pos = new Vector2(x, y);
  const vel = new Vector2(velX, velY);
  const alive = aliveValue === 1;

  if (kind === "mainShip") {
    const playerId = reader.readString();
    const playerName = reader.readString();
    const thrust = reader.readFloat32();
    const score = reader.readUint32();
    const hasShield = reader.readUint8();
    if (hasShield > 1) throw new TypeError("Invalid ship shield flag");
    return {
      id,
      kind,
      pos,
      vel,
      x,
      y,
      angle,
      radius,
      alive,
      playerId,
      playerName: playerName ?? "",
      thrust,
      score,
      hasShield: hasShield === 1,
    };
  } else if (kind === "miniRocket") {
    const ownerPlayerId = reader.readString();
    const hasFireSeq = reader.readUint8();
    if (hasFireSeq > 1) {
      throw new TypeError("Invalid rocket sequence flag");
    }
    const fireSeq =
      hasFireSeq === 1 ? SeqSchema.parse(reader.readUint32()) : null;
    return {
      id,
      kind,
      pos,
      vel,
      x,
      y,
      angle,
      radius,
      alive,
      playerId: null,
      ownerPlayerId,
      fireSeq,
    };
  } else if (kind === "pickup") {
    if (reader.readUint8() !== 1) {
      throw new TypeError("Unsupported binary pickup effect");
    }
    return {
      id,
      kind,
      pos,
      vel,
      x,
      y,
      angle,
      radius,
      alive,
      playerId: null,
      effect: "shield",
    };
  } else if (kind === "explosion") {
    const particleCount = reader.readUint8();
    const particles = Array.from({ length: particleCount }, () => ({
      pos: new Vector2(reader.readFloat32(), reader.readFloat32()),
      radius: reader.readFloat32(),
    }));
    return {
      id,
      kind,
      pos,
      vel,
      x,
      y,
      angle,
      radius,
      alive,
      playerId: null,
      particles,
    };
  } else if (kind === "bliblie") {
    return {
      id,
      kind,
      pos,
      vel,
      x,
      y,
      angle,
      radius,
      alive,
      playerId: null,
    };
  } else {
    const _exhaustive: never = kind;
    throw new TypeError(`Unknown entity kind: ${_exhaustive}`);
  }
}

export function encodeBinaryMessage(message: BinaryMessage): ArrayBuffer {
  const validation = BinaryMessageSchema.safeParse(message);
  if (!validation.success) {
    throw new TypeError(`Invalid binary message: ${validation.error.message}`);
  }

  const writer = new BinaryWriter();
  writer.writeUint8(BINARY_PROTOCOL_VERSION);

  switch (message.type) {
    case "input":
      writer.writeUint8(BinaryMessageTypes.INPUT);
      writer.writeUint32(message.seq);
      writer.writeUint32(message.tick);
      writer.writeInt8(message.thrust);
      writer.writeInt8(message.turn);
      writer.writeUint8(message.fire ? 1 : 0);
      break;
    case "snapshot": {
      writer.writeUint8(BinaryMessageTypes.SNAPSHOT);
      const acknowledgements = Object.entries(message.lastProcessedSeq);
      if (acknowledgements.length > 255) {
        throw new RangeError("Snapshot contains too many acknowledgements");
      }

      writer.writeUint32(message.tick);
      writer.writeUint32(message.seed);
      writer.writeFloat64(message.serverTime);
      writer.writeUint8(acknowledgements.length);
      writer.writeUint16(message.entities.length);
      for (const [playerId, seq] of acknowledgements) {
        writer.writeString(playerId);
        writer.writeUint32(seq);
      }
      for (const entity of message.entities) writeEntity(writer, entity);
      break;
    }
    default: {
      const _exhaustive: never = message;
      throw new TypeError(
        `Unsupported binary message type: ${JSON.stringify(_exhaustive)}`,
      );
    }
  }

  return writer.finish();
}

export function decodeBinaryMessage(data: ArrayBuffer | ArrayBufferView): BinaryMessage {
  const reader = new BinaryReader(data);
  const version = reader.readUint8();
  if (version !== BINARY_PROTOCOL_VERSION) {
    throw new TypeError(`Unsupported binary protocol version: ${version}`);
  }

  const messageType = reader.readUint8();
  let message: BinaryMessage;
  switch (messageType) {
    case BinaryMessageTypes.INPUT: {
      const seq = SeqSchema.parse(reader.readUint32());
      const tick = TickSchema.parse(reader.readUint32());
      const thrust = reader.readInt8();
      const turn = reader.readInt8();
      const fire = reader.readUint8();
      if (!isAxisInput(thrust) || !isAxisInput(turn)) {
        throw new TypeError("Invalid binary input values");
      }
      if (fire > 1) throw new TypeError("Invalid binary fire flag");
      message = {
        type: "input",
        seq,
        tick,
        thrust,
        turn,
        fire: fire === 1,
      };
      break;
    }
    case BinaryMessageTypes.SNAPSHOT: {
      const tick = TickSchema.parse(reader.readUint32());
      const seed = reader.readUint32();
      const serverTime = reader.readFloat64();
      const ackCount = reader.readUint8();
      const entityCount = reader.readUint16();
      const lastProcessedSeq: Record<string, Seq> = {};
      for (let i = 0; i < ackCount; i += 1) {
        const playerId = reader.readString();
        if (playerId === null) {
          throw new TypeError("Acknowledgement player id cannot be null");
        }
        lastProcessedSeq[playerId] = SeqSchema.parse(reader.readUint32());
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
      break;
    }
    default:
      throw new TypeError(`Unsupported binary message type: ${messageType}`);
  }

  reader.finish();
  const validation = BinaryMessageSchema.safeParse(message);
  if (!validation.success) {
    throw new TypeError(`Invalid binary message: ${validation.error.message}`);
  }
  return message;
}
