import pino, { type Logger } from "pino";

import { getEnv } from "@akyuu/shared-config";

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: getEnv().NODE_ENV === "development" ? "debug" : "info"
  });
}
