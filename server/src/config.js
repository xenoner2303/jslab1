import path from "node:path";

export const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || "localhost",
  logDir: path.resolve(process.cwd(), process.env.LOG_DIR || "logs"),
};
