import path from "node:path";
import { z } from "zod";

const serverConfigSchema = z.object({
  PORT: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(3000),
  HOST: z.string().min(1).default("localhost"),
  LOG_DIR: z.string().min(1).default("logs"),
  ALLOWED_ORIGINS: z.string().default(""),
  MAX_CONNECTIONS_PER_IP: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default(10),
  MAX_ROOMS: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default(100),
  MAX_PLAYERS_PER_ROOM: z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(1))
    .default(8),
});

export type ServerConfig = {
  readonly port: number;
  readonly host: string;
  readonly logDir: string;
  readonly allowedOrigins: readonly string[];
  readonly limits: {
    readonly messagesPerSecond: number;
    readonly messageBurst: number;
    readonly maxRooms: number;
    readonly maxPlayersPerRoom: number;
    readonly maxConnectionsPerIp: number;
    readonly maxPayloadBytes: number;
    readonly maxBufferedBytes: number;
  };
};

const env = serverConfigSchema.parse(process.env);

export const config: ServerConfig = {
  port: env.PORT,
  host: env.HOST,
  logDir: path.resolve(process.cwd(), env.LOG_DIR),
  allowedOrigins: env.ALLOWED_ORIGINS
    ? env.ALLOWED_ORIGINS.split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [],
  limits: {
    messagesPerSecond: 75,
    messageBurst: 75,
    maxRooms: env.MAX_ROOMS,
    maxPlayersPerRoom: env.MAX_PLAYERS_PER_ROOM,
    maxConnectionsPerIp: env.MAX_CONNECTIONS_PER_IP,
    maxPayloadBytes: 64 * 1024,
    maxBufferedBytes: 256 * 1024,
  },
};
