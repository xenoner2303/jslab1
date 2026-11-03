import {
  MessageTypes,
  ServerMessageTypes,
  type ClientInputMessage,
  type EntitySnapshot,
  type Seq,
  type SnapshotMessage,
  type Tick,
} from "../protocol.ts";

export { MessageTypes, ServerMessageTypes };
export type InputMessagePayload = Omit<ClientInputMessage, "type">;

export function createInputMessage(
  payload: InputMessagePayload,
): ClientInputMessage {
  return { type: MessageTypes.INPUT, ...payload };
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
