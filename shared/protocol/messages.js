export const MessageTypes = {
  INPUT: "input",
};

export const ServerMessageTypes = {
  SNAPSHOT: "snapshot",
};

const UINT32_MAX = 0xffffffff;
const INPUT_FIELDS = ["type", "seq", "tick", "thrust", "turn", "fire"];

export function createInputMessage({ seq, tick, thrust, turn, fire }) {
  return {
    type: MessageTypes.INPUT,
    seq,
    tick,
    thrust,
    turn,
    fire,
  };
}

export function validateInputMessage(rawMessage) {
  let message = rawMessage;

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

  if (
    Object.keys(message).length !== INPUT_FIELDS.length ||
    INPUT_FIELDS.some((field) => !Object.hasOwn(message, field))
  ) {
    return { valid: false, error: "Invalid fields for input message" };
  }

  if (
    message.type !== MessageTypes.INPUT ||
    !Number.isInteger(message.seq) ||
    message.seq < 0 ||
    message.seq > UINT32_MAX ||
    !Number.isInteger(message.tick) ||
    message.tick < 0 ||
    message.tick > UINT32_MAX ||
    ![-1, 0, 1].includes(message.thrust) ||
    ![-1, 0, 1].includes(message.turn) ||
    typeof message.fire !== "boolean"
  ) {
    return { valid: false, error: "Invalid input message values" };
  }

  return { valid: true, msg: message };
}

export function createSnapshotMessage(tick, lastProcessedSeq, entities) {
  return {
    type: ServerMessageTypes.SNAPSHOT,
    tick,
    lastProcessedSeq,
    entities,
  };
}
