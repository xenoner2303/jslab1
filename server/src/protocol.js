export const MessageTypes = {
  JOIN: "join",
  CHAT: "chat",
  ROSTER: "roster",
};

export function validateMessage(rawData) {
  try {
    const text = typeof rawData === "string" ? rawData : rawData.toString();
    const msg = JSON.parse(text);

    if (!msg || typeof msg !== "object") {
      return { valid: false, error: "Message must be a JSON object" };
    }

    if (!msg.type || typeof msg.type !== "string") {
      return { valid: false, error: "Missing or invalid 'type' field" };
    }

    return { valid: true, msg };
  } catch (err) {
    return { valid: false, error: "Invalid JSON format" };
  }
}
