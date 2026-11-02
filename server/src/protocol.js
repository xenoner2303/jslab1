import {
  MessageTypes as SharedMessageTypes,
  validateInputMessage,
} from "../../shared/protocol/messages.js";
import { decodeJsonMessage } from "../../shared/codec/json.js";

export const MessageTypes = {
  JOIN: "join",
  JOINED: "joined",
  CHAT: "chat",
  ROSTER: "roster",
  INPUT: SharedMessageTypes.INPUT,
  SNAPSHOT: "snapshot",
};

function hasExactKeys(message, fields) {
  return (
    Object.keys(message).length === fields.length &&
    fields.every((field) => Object.hasOwn(message, field))
  );
}

export function validateMessage(rawData) {
  let message;
  try {
    message = decodeJsonMessage(rawData);
  } catch {
    return { valid: false, error: "Invalid JSON format" };
  }

  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return { valid: false, error: "Message must be a JSON object" };
  }

  if (message.type === MessageTypes.INPUT) {
    return validateInputMessage(message);
  }

  if (message.type === MessageTypes.JOIN) {
    if (
      !hasExactKeys(message, ["type", "room", "name"]) ||
      typeof message.room !== "string" ||
      message.room.trim().length === 0 ||
      message.room.length > 64 ||
      typeof message.name !== "string" ||
      message.name.trim().length === 0 ||
      message.name.length > 30
    ) {
      return { valid: false, error: "Invalid join message fields" };
    }

    return { valid: true, msg: message };
  }

  if (message.type === MessageTypes.CHAT) {
    if (
      !hasExactKeys(message, ["type", "text"]) ||
      typeof message.text !== "string" ||
      message.text.trim().length === 0 ||
      message.text.length > 256
    ) {
      return { valid: false, error: "Invalid chat message fields" };
    }

    return { valid: true, msg: message };
  }

  return {
    valid: false,
    error: `Unknown message type '${String(message.type)}'`,
  };
}
