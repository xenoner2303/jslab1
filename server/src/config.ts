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
});

export type ServerConfig = {
  readonly port: number;
  readonly host: string;
  readonly logDir: string;
  readonly limits: {
    readonly messagesPerSecond: number;
    readonly messageBurst: number;
    readonly maxRooms: number;
    readonly maxPlayersPerRoom: number;
    readonly maxPayloadBytes: number;
    readonly maxBufferedBytes: number;
  };
};

const env = serverConfigSchema.parse(process.env);

export const config: ServerConfig = {
  port: env.PORT,
  host: env.HOST,
  logDir: path.resolve(process.cwd(), env.LOG_DIR),
  limits: {
    messagesPerSecond: 75,
    messageBurst: 75,
    maxRooms: 100,
    maxPlayersPerRoom: 8,
    maxPayloadBytes: 64 * 1024,
    maxBufferedBytes: 256 * 1024,
  },
};
