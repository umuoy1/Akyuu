import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closeDb, pool } from "./client/index.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(currentDir, "../migrations");

async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    create table if not exists app_migration (
      name text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>("select name from app_migration");
  return new Set(result.rows.map((row) => row.name));
}

async function applyMigration(name: string, sql: string): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into app_migration(name) values ($1)", [name]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  await ensureMigrationsTable();

  const applied = await getAppliedMigrations();
  const files = (await readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    await applyMigration(file, sql);
    console.log(`applied migration ${file}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
