import type { Seq, Tick } from "../codec/binary.ts";

export const MessageTypes = {
  INPUT: "input",
} as const;

export const ServerMessageTypes = {
  SNAPSHOT: "snapshot",
} as const;

const UINT32_MAX = 0xffffffff;
const INPUT_FIELDS = ["type", "seq", "tick", "thrust", "turn", "fire"] as const;

export type InputMessagePayload = {
  readonly seq: Seq;
  readonly tick: Tick;
  readonly thrust: -1 | 0 | 1;
  readonly turn: -1 | 0 | 1;
  readonly fire: boolean;
};

export function createInputMessage({ seq, tick, thrust, turn, fire }: InputMessagePayload) {
  return {
    type: MessageTypes.INPUT,
    seq,
    tick,
    thrust,
    turn,
    fire,
  } as const;
}

export type ValidationResult = 
  | { readonly valid: true; readonly msg: ReturnType<typeof createInputMessage> }
  | { readonly valid: false; readonly error: string };

export function validateInputMessage(rawMessage: unknown): ValidationResult {
  let message: unknown = rawMessage;

  if (typeof rawMessage === "string") {
    try {
      message = JSON.parse(rawMessage);
    } catch {
      return { valid: false, error: "Invalid JSON format" };
    }
  }

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { valid: false, error: "Input must be a JSON object" };
  }

  const msgObj = message as Record<string, unknown>;

  if (
    Object.keys(msgObj).length !== INPUT_FIELDS.length ||
    INPUT_FIELDS.some((field) => !Object.hasOwn(msgObj, field))
  ) {
    return { valid: false, error: "Invalid fields for input message" };
  }

  const seq = msgObj.seq;
  const tick = msgObj.tick;
  const thrust = msgObj.thrust;
  const turn = msgObj.turn;
  const fire = msgObj.fire;

  if (
    msgObj.type !== MessageTypes.INPUT ||
    typeof seq !== "number" || !Number.isInteger(seq) || seq < 0 || seq > UINT32_MAX ||
    typeof tick !== "number" || !Number.isInteger(tick) || tick < 0 || tick > UINT32_MAX ||
    ![-1, 0, 1].includes(thrust as number) ||
    ![-1, 0, 1].includes(turn as number) ||
    typeof fire !== "boolean"
  ) {
    return { valid: false, error: "Invalid input message values" };
  }

  return { 
    valid: true, 
    msg: {
      type: MessageTypes.INPUT,
      seq: seq as Seq,
      tick: tick as Tick,
      thrust: thrust as -1 | 0 | 1,
      turn: turn as -1 | 0 | 1,
      fire,
    } 
  };
}

export function createSnapshotMessage(
  tick: Tick, 
  lastProcessedSeq: Readonly<Record<string, Seq>>, 
  entities: readonly unknown[]
) {
  return {
    type: ServerMessageTypes.SNAPSHOT,
    tick,
    lastProcessedSeq,
    entities,
  } as const;
}
