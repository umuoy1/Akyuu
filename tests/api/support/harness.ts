import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

import Redis from "ioredis";
import { Client } from "pg";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../../..");
const healthcheckTimeoutMs = 120_000;
const shutdownTimeoutMs = 10_000;
const fixturePath = path.join(repoRoot, "tests/fixtures/api/real-workspace-snapshot.json");

type HarnessMode = "fixture" | "live";

type ManagedProcess = {
  name: string;
  child: ChildProcess;
  detached: boolean;
  logs: string[];
};

type ApiFixtureSnapshot = {
  meta: {
    workspaceSlug: string;
    workspaceName: string;
    timezone: string;
    userEmail: string;
    userDisplayName: string;
  };
  tables: Record<string, Array<Record<string, unknown>>>;
};

export type ApiIntegrationHarness = {
  apiBaseUrl: string;
  workerBaseUrl: string;
  schedulerBaseUrl: string | null;
  webBaseUrl: string | null;
  databaseUrl: string;
  redisUrl: string;
  dates: {
    today: string;
    yesterday: string;
  };
  env: NodeJS.ProcessEnv;
  stop: () => Promise<void>;
};

function formatDateLabel(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format date label");
  }

  return `${year}-${month}-${day}`;
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function sanitizeDatabaseName(databaseName: string): string {
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
    throw new Error(`Unsafe test database name: ${databaseName}`);
  }

  return databaseName;
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function buildDatabaseUrls(databaseName: string): {
  databaseUrl: string;
  adminUrl: string;
} {
  const sanitized = sanitizeDatabaseName(databaseName);
  const baseUrl = new URL(process.env.DATABASE_URL ?? "postgres://akyuu:akyuu@localhost:15432/akyuu");
  baseUrl.pathname = `/${sanitized}`;

  const adminUrl = new URL(baseUrl.toString());
  adminUrl.pathname = "/postgres";

  return {
    databaseUrl: baseUrl.toString(),
    adminUrl: adminUrl.toString()
  };
}

async function ensureIsolatedDatabase(databaseUrl: string, adminUrl: string): Promise<void> {
  const databaseName = sanitizeDatabaseName(new URL(databaseUrl).pathname.replace(/^\//, ""));
  const adminClient = new Client({
    connectionString: adminUrl
  });

  await adminClient.connect();

  try {
    const exists = await adminClient.query<{ datname: string }>("select datname from pg_database where datname = $1", [
      databaseName
    ]);

    if (exists.rowCount === 0) {
      await adminClient.query(`create database "${databaseName}"`);
    }

    await adminClient.query(
      `
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where datname = $1 and pid <> pg_backend_pid()
      `,
      [databaseName]
    );
  } finally {
    await adminClient.end();
  }

  const databaseClient = new Client({
    connectionString: databaseUrl
  });

  await databaseClient.connect();

  try {
    await databaseClient.query("drop schema if exists public cascade");
    await databaseClient.query("create schema public");
  } finally {
    await databaseClient.end();
  }
}

async function flushRedisDatabase(redisUrl: string): Promise<void> {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null
  });

  try {
    await redis.flushdb();
  } finally {
    await redis.quit();
  }
}

async function loadFixtureSnapshot(databaseUrl: string): Promise<ApiFixtureSnapshot["meta"]> {
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as ApiFixtureSnapshot;
  const client = new Client({
    connectionString: databaseUrl
  });
  const insertOrder = [
    "workspace",
    "app_user",
    "workspace_member",
    "watch_target",
    "topic",
    "topic_alias",
    "topic_rule",
    "trend_snapshot",
    "trend_snapshot_item",
    "trend_diff",
    "canonical_entity",
    "canonical_event",
    "topic_evidence",
    "topic_update",
    "digest",
    "digest_section",
    "recommended_item",
    "outbound_notification"
  ];

  await client.connect();

  try {
    await client.query("begin");

    for (const tableName of insertOrder) {
      const rows = fixture.tables[tableName] ?? [];

      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((column) => row[column] ?? null);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const sql = `insert into ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(", ")}) values (${placeholders})`;
        await client.query(sql, values);
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    await client.end();
  }

  return fixture.meta;
}

function spawnCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  name: string,
  options?: {
    detached?: boolean;
  }
): ManagedProcess {
  const detached = options?.detached ?? false;
  const child = spawn(command, args, {
    cwd: repoRoot,
    detached,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const logs: string[] = [];
  const pushLog = (chunk: Buffer | string) => {
    const text = chunk.toString();
    logs.push(text);
  };

  child.stdout?.on("data", pushLog);
  child.stderr?.on("data", pushLog);

  return {
    name,
    child,
    detached,
    logs
  };
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, name: string): Promise<void> {
  const processRef = spawnCommand(command, args, env, name);

  const exitCode = await new Promise<number>((resolve, reject) => {
    processRef.child.once("error", reject);
    processRef.child.once("exit", (code) => resolve(code ?? 0));
  });

  if (exitCode !== 0) {
    throw new Error(`${name} failed with exit code ${exitCode}\n${processRef.logs.join("")}`);
  }
}

async function waitForHealthcheck(url: string, processRef: ManagedProcess): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < healthcheckTimeoutMs) {
    if (processRef.child.exitCode !== null) {
      throw new Error(`${processRef.name} exited before becoming healthy\n${processRef.logs.join("")}`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // ignore until timeout
    }

    await delay(500);
  }

  throw new Error(`${processRef.name} healthcheck timed out: ${url}\n${processRef.logs.join("")}`);
}

function sendSignal(processRef: ManagedProcess, signal: NodeJS.Signals): void {
  try {
    if (processRef.detached && processRef.child.pid) {
      process.kill(-processRef.child.pid, signal);
      return;
    }

    processRef.child.kill(signal);
  } catch {
    // ignore races during shutdown
  }
}

async function stopProcess(processRef: ManagedProcess): Promise<void> {
  if (processRef.child.exitCode !== null) {
    return;
  }

  sendSignal(processRef, "SIGTERM");

  const exited = await Promise.race([
    new Promise<boolean>((resolve) => {
      processRef.child.once("exit", () => resolve(true));
    }),
    delay(shutdownTimeoutMs).then(() => false)
  ]);

  if (!exited && processRef.child.exitCode === null) {
    sendSignal(processRef, "SIGKILL");
  }
}

export async function createApiIntegrationHarness(options?: {
  mode?: HarnessMode;
  startScheduler?: boolean;
  startWeb?: boolean;
}): Promise<ApiIntegrationHarness> {
  const mode = options?.mode ?? "fixture";
  const startScheduler = options?.startScheduler ?? false;
  const startWeb = options?.startWeb ?? false;
  const apiPort = await findFreePort();
  const workerPort = await findFreePort();
  const schedulerPort = startScheduler ? await findFreePort() : null;
  const webPort = startWeb ? await findFreePort() : null;
  const databaseName = `akyuu_api_test_${mode}_${process.pid}_${Date.now()}`;
  const redisDb = ((Date.now() + process.pid) % 15) + 1;
  const { databaseUrl, adminUrl } = buildDatabaseUrls(databaseName);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl,
    REDIS_URL: `redis://localhost:16379/${redisDb}`,
    API_HOST: "127.0.0.1",
    API_PORT: String(apiPort),
    SCHEDULER_HOST: "127.0.0.1",
    SCHEDULER_PORT: String(schedulerPort ?? 3002),
    WORKER_HOST: "127.0.0.1",
    WORKER_PORT: String(workerPort),
    HOSTNAME: "127.0.0.1",
    WEB_PORT: String(webPort ?? 3100),
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${apiPort}`,
    DEFAULT_TIMEZONE: "Asia/Shanghai",
    SCHEDULER_AUTO_RUN: "false"
  };

  await ensureIsolatedDatabase(databaseUrl, adminUrl);
  await flushRedisDatabase(env.REDIS_URL);
  await runCommand("pnpm", ["--filter", "@akyuu/infra-db", "migrate"], env, "db:migrate");

  if (mode === "fixture") {
    const meta = await loadFixtureSnapshot(databaseUrl);
    env.DEFAULT_USER_EMAIL = meta.userEmail;
    env.DEFAULT_USER_NAME = meta.userDisplayName;
    env.DEFAULT_WORKSPACE_SLUG = meta.workspaceSlug;
    env.DEFAULT_WORKSPACE_NAME = meta.workspaceName;
    env.DEFAULT_TIMEZONE = meta.timezone;
  } else {
    env.DEFAULT_USER_EMAIL = "api-test@akyuu.local";
    env.DEFAULT_USER_NAME = "API Test User";
    env.DEFAULT_WORKSPACE_SLUG = "api-test";
    env.DEFAULT_WORKSPACE_NAME = "API Test Workspace";
    await runCommand("pnpm", ["--filter", "@akyuu/infra-db", "seed"], env, "db:seed");
  }

  let worker: ManagedProcess | null = null;
  let api: ManagedProcess | null = null;
  let scheduler: ManagedProcess | null = null;
  let web: ManagedProcess | null = null;

  try {
    worker = spawnCommand("pnpm", ["exec", "tsx", "apps/worker/src/server.ts"], env, "worker", {
      detached: true
    });
    await waitForHealthcheck(`http://127.0.0.1:${workerPort}/health`, worker);

    api = spawnCommand("pnpm", ["exec", "tsx", "apps/api/src/server.ts"], env, "api", {
      detached: true
    });
    await waitForHealthcheck(`http://127.0.0.1:${apiPort}/health`, api);

    scheduler =
      schedulerPort === null
        ? null
        : spawnCommand("pnpm", ["exec", "tsx", "apps/scheduler/src/server.ts"], env, "scheduler", {
            detached: true
          });

    if (scheduler && schedulerPort !== null) {
      await waitForHealthcheck(`http://127.0.0.1:${schedulerPort}/health`, scheduler);
    }

    web =
      webPort === null
        ? null
        : null;

    if (webPort !== null) {
      await runCommand("pnpm", ["--filter", "@akyuu/web", "build"], env, "web:build");
      web = spawnCommand("pnpm", ["--filter", "@akyuu/web", "start"], env, "web", {
        detached: true
      });
    }

    if (web && webPort !== null) {
      await waitForHealthcheck(`http://127.0.0.1:${webPort}/today`, web);
    }
  } catch (error) {
    if (web) {
      await stopProcess(web);
    }
    if (scheduler) {
      await stopProcess(scheduler);
    }
    if (api) {
      await stopProcess(api);
    }
    if (worker) {
      await stopProcess(worker);
    }
    await flushRedisDatabase(env.REDIS_URL);
    await ensureIsolatedDatabase(databaseUrl, adminUrl);
    throw error;
  }

  return {
    apiBaseUrl: `http://127.0.0.1:${apiPort}`,
    workerBaseUrl: `http://127.0.0.1:${workerPort}`,
    schedulerBaseUrl: schedulerPort === null ? null : `http://127.0.0.1:${schedulerPort}`,
    webBaseUrl: webPort === null ? null : `http://127.0.0.1:${webPort}`,
    databaseUrl,
    redisUrl: env.REDIS_URL,
    dates: {
      today: formatDateLabel(new Date(), env.DEFAULT_TIMEZONE ?? "Asia/Shanghai"),
      yesterday: formatDateLabel(new Date(Date.now() - 24 * 60 * 60 * 1000), env.DEFAULT_TIMEZONE ?? "Asia/Shanghai")
    },
    env,
    stop: async () => {
      if (web) {
        await stopProcess(web);
      }
      if (scheduler) {
        await stopProcess(scheduler);
      }
      if (api) {
        await stopProcess(api);
      }
      if (worker) {
        await stopProcess(worker);
      }
      await flushRedisDatabase(env.REDIS_URL);
      await ensureIsolatedDatabase(databaseUrl, adminUrl);
    }
  };
}
