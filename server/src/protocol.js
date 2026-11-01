export const MessageTypes = {
  JOIN: "join",
  JOINED: "joined",
  CHAT: "chat",
  ROSTER: "roster",
  STATE: "state",
};

export function validateMessage(rawData) {
  try {
    const text = typeof rawData === "string" ? rawData : rawData.toString();
    const msg = JSON.parse(text);

    if (!msg || typeof msg !== "object" || Array.isArray(msg)) {
      return { valid: false, error: "Message must be a JSON object" };
    }

    if (!msg.type || typeof msg.type !== "string") {
      return { valid: false, error: "Missing or invalid 'type' field" };
    }

    const expectedKeys = {
      [MessageTypes.JOIN]: ["type", "room", "name"],
      [MessageTypes.CHAT]: ["type", "text"],
      [MessageTypes.STATE]: [
        "type",
        "x",
        "y",
        "angle",
        "thrust",
        "alive",
      ],
    }[msg.type];

    if (!expectedKeys) {
      return { valid: false, error: `Unknown message type '${msg.type}'` };
    }

    if (
      Object.keys(msg).length !== expectedKeys.length ||
      expectedKeys.some((key) => !Object.hasOwn(msg, key))
    ) {
      return { valid: false, error: `Invalid fields for '${msg.type}' message` };
    }

    if (
      msg.type === MessageTypes.JOIN &&
      (typeof msg.room !== "string" ||
        msg.room.trim().length === 0 ||
        msg.room.length > 64 ||
        typeof msg.name !== "string" ||
        msg.name.trim().length === 0 ||
        msg.name.length > 30)
    ) {
      return { valid: false, error: "Invalid join message fields" };
    }

    if (
      msg.type === MessageTypes.CHAT &&
      (typeof msg.text !== "string" ||
        msg.text.trim().length === 0 ||
        msg.text.length > 256)
    ) {
      return { valid: false, error: "Invalid chat message fields" };
    }

    if (
      msg.type === MessageTypes.STATE &&
      (!Number.isFinite(msg.x) ||
        !Number.isFinite(msg.y) ||
        !Number.isFinite(msg.angle) ||
        !Number.isFinite(msg.thrust) ||
        Math.abs(msg.thrust) > 100 ||
        typeof msg.alive !== "boolean")
    ) {
      return { valid: false, error: "Invalid player state fields" };
    }

    return { valid: true, msg };
  } catch {
    return { valid: false, error: "Invalid JSON format" };
  }
}
