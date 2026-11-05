import { z } from "zod";

const uint32 = z.number().int().min(0).max(0xffffffff);
export const EntityIdSchema = uint32.brand<"EntityId">();
export const TickSchema = uint32.brand<"Tick">();
export const SeqSchema = uint32.brand<"Seq">();
export type EntityId = z.infer<typeof EntityIdSchema>;
export type Tick = z.infer<typeof TickSchema>;
export type Seq = z.infer<typeof SeqSchema>;
type DeepReadonly<T> =
  T extends string | number | boolean | bigint | symbol | null | undefined
    ? T
    : T extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : T extends object
        ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
        : T;

const entityId = EntityIdSchema;
const tick = TickSchema;
const seq = SeqSchema;
const nonEmptyString = (max: number) =>
  z.string().max(max).refine((value) => value.trim().length > 0);
const vector = z.object({ x: z.number(), y: z.number() }).strict();
const entityFields = {
  id: entityId,
  pos: vector,
  vel: vector,
  x: z.number(),
  y: z.number(),
  angle: z.number(),
  radius: z.number().nonnegative(),
  alive: z.boolean(),
  playerId: z.string().min(1).nullable(),
};

export const MessageTypes: {
  readonly JOIN: "join";
  readonly INPUT: "input";
  readonly CHAT: "chat";
} = {
  JOIN: "join",
  INPUT: "input",
  CHAT: "chat",
};

export const ServerMessageTypes: {
  readonly JOINED: "joined";
  readonly SNAPSHOT: "snapshot";
  readonly CHAT: "chat";
  readonly ROSTER: "roster";
  readonly AUDIO_EVENT: "audioEvent";
} = {
  JOINED: "joined",
  SNAPSHOT: "snapshot",
  CHAT: "chat",
  ROSTER: "roster",
  AUDIO_EVENT: "audioEvent",
};

export const JoinMessageSchema = z
  .object({
    type: z.literal(MessageTypes.JOIN),
    room: nonEmptyString(64),
    name: nonEmptyString(30),
  })
  .strict();

export const InputMessageSchema = z
  .object({
    type: z.literal(MessageTypes.INPUT),
    seq,
    tick,
    thrust: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    turn: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    fire: z.boolean(),
  })
  .strict();

export const ClientChatMessageSchema = z
  .object({
    type: z.literal(MessageTypes.CHAT),
    text: nonEmptyString(256),
  })
  .strict();

export const MainShipSnapshotSchema = z
  .object({
    ...entityFields,
    kind: z.literal("mainShip"),
    playerName: nonEmptyString(255),
    thrust: z.number().finite(),
    score: uint32,
    hasShield: z.boolean(),
  })
  .strict();

export const MiniRocketSnapshotSchema = z
  .object({
    ...entityFields,
    kind: z.literal("miniRocket"),
    ownerPlayerId: z.string().min(1).nullable(),
    fireSeq: seq.nullable(),
  })
  .strict();

export const BliblieSnapshotSchema = z
  .object({
    ...entityFields,
    kind: z.literal("bliblie"),
  })
  .strict();

export const PickupSnapshotSchema = z
  .object({
    ...entityFields,
    kind: z.literal("pickup"),
    effect: z.literal("shield"),
  })
  .strict();

export const ExplosionSnapshotSchema = z
  .object({
    ...entityFields,
    kind: z.literal("explosion"),
    particles: z
      .array(
        z
          .object({ pos: vector, radius: z.number().finite().nonnegative() })
          .strict(),
      )
      .max(255),
  })
  .strict();

export const EntitySnapshotSchema = z.discriminatedUnion("kind", [
  MainShipSnapshotSchema,
  MiniRocketSnapshotSchema,
  BliblieSnapshotSchema,
  PickupSnapshotSchema,
  ExplosionSnapshotSchema,
]);

export const SnapshotMessageSchema = z
  .object({
    type: z.literal(ServerMessageTypes.SNAPSHOT),
    tick,
    lastProcessedSeq: z.record(z.string().min(1), seq),
    entities: z.array(EntitySnapshotSchema).max(65535),
    seed: uint32,
    serverTime: z.number().finite(),
  })
  .strict();

export const JoinedMessageSchema = z
  .object({
    type: z.literal(ServerMessageTypes.JOINED),
    playerId: nonEmptyString(255),
    state: EntitySnapshotSchema,
    seed: uint32.optional(),
  })
  .strict();

export const ServerChatMessageSchema = z
  .object({
    type: z.literal(ServerMessageTypes.CHAT),
    sender: nonEmptyString(255),
    text: nonEmptyString(256),
    time: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export const RosterMessageSchema = z
  .object({
    type: z.literal(ServerMessageTypes.ROSTER),
    players: z
      .array(
        z
          .object({
            id: nonEmptyString(255),
            name: nonEmptyString(255),
            state: EntitySnapshotSchema,
          })
          .strict(),
      )
      .max(255),
  })
  .strict();

const AudioEventPayloadSchema = z.discriminatedUnion("event", [
  z.object({
    event: z.literal("shoot"),
  }).strict(),

  z.object({
    event: z.literal("hit"),
    targetType: z.literal("bliblie"),
  }).strict(),

  z.object({
    event: z.literal("kill"),
    count: uint32,
    targetType: z.literal("bliblie"),
  }).strict(),

  z.object({
    event: z.literal("environment"),
    soundType: z.literal("bliblie"),
  }).strict(),

  z.object({
    event: z.literal("exploded"),
  }).strict(),
]);

export const AudioEventMessageSchema = z
  .object({
    type: z.literal(ServerMessageTypes.AUDIO_EVENT),
    payload: AudioEventPayloadSchema,
  })
  .strict();

export type AudioEventMessage = DeepReadonly<z.infer<typeof AudioEventMessageSchema>>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  JoinMessageSchema,
  InputMessageSchema,
  ClientChatMessageSchema,
]);

export const ServerMessageSchema = z.discriminatedUnion("type", [
  JoinedMessageSchema,
  SnapshotMessageSchema,
  ServerChatMessageSchema,
  RosterMessageSchema,
  AudioEventMessageSchema,
]);

export const ProtocolMessageSchema = z.union([
  ClientMessageSchema,
  ServerMessageSchema,
]);

export const BinaryMessageSchema = z.discriminatedUnion("type", [
  InputMessageSchema,
  SnapshotMessageSchema,
]);

export type JoinMessage = z.infer<typeof JoinMessageSchema>;
export type ClientInputMessage = z.infer<typeof InputMessageSchema>;
export type ClientChatMessage = z.infer<typeof ClientChatMessageSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type EntitySnapshot = DeepReadonly<
  z.infer<typeof EntitySnapshotSchema>
>;
export type SnapshotMessage = DeepReadonly<
  z.infer<typeof SnapshotMessageSchema>
>;
export type JoinedMessage = DeepReadonly<z.infer<typeof JoinedMessageSchema>>;
export type ServerChatMessage = DeepReadonly<
  z.infer<typeof ServerChatMessageSchema>
>;
export type RosterMessage = DeepReadonly<z.infer<typeof RosterMessageSchema>>;
export type ServerMessage = DeepReadonly<
  z.infer<typeof ServerMessageSchema>
>;
export type ProtocolMessage = DeepReadonly<
  z.infer<typeof ProtocolMessageSchema>
>;
export type BinaryMessage = DeepReadonly<
  z.infer<typeof BinaryMessageSchema>
>;

export type ParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: string };

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  direction: string,
): ParseResult<T> {
  try {
    const result = schema.safeParse(data);
    if (!result.success) {
      const error = result.error.message;
      console.error(`Invalid ${direction} message:`, error);
      return { success: false, error };
    }
    return { success: true, data: result.data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to parse ${direction} message:`, message);
    return { success: false, error: message };
  }
}

export function parseClientMessage(data: unknown): ParseResult<ClientMessage> {
  return parseWithSchema(ClientMessageSchema, data, "client");
}

export function parseServerMessage(data: unknown): ParseResult<ServerMessage> {
  return parseWithSchema(ServerMessageSchema, data, "server");
}
