import {
  InputMessageSchema,
  MessageTypes,
  ServerMessageTypes,
  type ClientInputMessage,
  type EntitySnapshot,
  type Seq,
  type SnapshotMessage,
  type Tick,
} from "../protocol.ts";

export { MessageTypes, ServerMessageTypes };
export type InputMessagePayload = {
  readonly seq: number;
  readonly tick: number;
  readonly thrust: -1 | 0 | 1;
  readonly turn: -1 | 0 | 1;
  readonly fire: boolean;
};

export function createInputMessage(
  payload: InputMessagePayload,
): ClientInputMessage {
  return InputMessageSchema.parse({ type: MessageTypes.INPUT, ...payload });
}

export function createSnapshotMessage(
  tick: Tick,
  lastProcessedSeq: Readonly<Record<string, Seq>>,
  entities: EntitySnapshot[],
): Omit<SnapshotMessage, "seed" | "serverTime"> {
  return {
    type: ServerMessageTypes.SNAPSHOT,
    tick,
    lastProcessedSeq,
    entities,
  };
}
