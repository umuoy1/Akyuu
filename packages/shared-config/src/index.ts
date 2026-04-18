import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgres://akyuu:akyuu@localhost:15432/akyuu"),
  REDIS_URL: z.string().default("redis://localhost:16379"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  SCHEDULER_HOST: z.string().default("0.0.0.0"),
  SCHEDULER_PORT: z.coerce.number().int().positive().default(3002),
  WORKER_HOST: z.string().default("0.0.0.0"),
  WORKER_PORT: z.coerce.number().int().positive().default(3003),
  WEB_PORT: z.coerce.number().int().positive().default(3100),
  NEXT_PUBLIC_API_BASE_URL: z.string().default("http://localhost:3001"),
  DEFAULT_USER_EMAIL: z.string().default("dev@akyuu.local"),
  DEFAULT_USER_NAME: z.string().default("Dev User"),
  DEFAULT_WORKSPACE_SLUG: z.string().default("dev"),
  DEFAULT_WORKSPACE_NAME: z.string().default("Dev Workspace"),
  DEFAULT_TIMEZONE: z.string().default("Asia/Shanghai"),
  DEFAULT_LOCALE: z.enum(["en-US", "zh-CN"]).default("en-US"),
  SCHEDULER_AUTO_RUN: z
    .union([z.literal("true"), z.literal("false")])
    .default("false")
    .transform((value) => value === "true"),
  SCHEDULER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_API_BASE_URL: z.string().default("https://api.github.com"),
  GITHUB_TRENDING_URL: z.string().default("https://github.com/trending"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().default("https://open.bigmodel.cn/api/paas/v4/"),
  OPENAI_MODEL: z.string().default("glm-5")
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;
let envFileLoaded = false;

function loadEnvFileOnce(): void {
  if (envFileLoaded) {
    return;
  }

  envFileLoaded = true;

  try {
    process.loadEnvFile?.();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      throw error;
    }
  }
}

export function getEnv(): AppEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  loadEnvFileOnce();
  cachedEnv = envSchema.parse(process.env);
  return cachedEnv;
}

export function getApiBaseUrl(): string {
  return getEnv().NEXT_PUBLIC_API_BASE_URL;
}
