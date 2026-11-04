import pino from "pino";
import { config } from "./config.ts";

export const logger = pino({
  level: config.logLevel,
});

export type LogContext = {
  roomId?: string;
  playerId?: string;
  event?: string;
  [key: string]: unknown;
};

export function createChildLogger(bindings: LogContext) {
  return logger.child(bindings);
}

