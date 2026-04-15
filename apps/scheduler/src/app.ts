import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { and, eq, isNull, lte } from "drizzle-orm";

import { db, watchSchedule, watchTarget } from "@akyuu/infra-db";
import { enqueueJob } from "@akyuu/infra-queue";
import { createLogger } from "@akyuu/infra-observability";
import { isoNow } from "@akyuu/shared-utils";
import type { JobEnvelope, RepoWatchConfig, TopicWatchConfig, TrendWatchConfig } from "@akyuu/shared-types";

function makeEnvelope<TPayload>(idempotencyKey: string, payload: TPayload): JobEnvelope<TPayload> {
  return {
    payloadVersion: 1,
    idempotencyKey,
    requestedAt: isoNow(),
    trigger: "scheduler",
    payload
  };
}

export async function runSchedulerTick(): Promise<{ queued: number }> {
  const now = new Date();
  const rows = await db
    .select({
      scheduleId: watchSchedule.id,
      watchTargetId: watchTarget.id,
      type: watchTarget.type,
      priority: watchTarget.priority,
      config: watchTarget.config
    })
    .from(watchSchedule)
    .innerJoin(watchTarget, eq(watchSchedule.watchTargetId, watchTarget.id))
    .where(
      and(
        eq(watchSchedule.enabled, true),
        isNull(watchTarget.deletedAt),
        lte(watchSchedule.nextRunAt, now)
      )
    );

  let queued = 0;

  for (const row of rows) {
    if (row.type === "repo") {
      const config = row.config as RepoWatchConfig;
      await enqueueJob("ingest.poll", "poll_repo_events", makeEnvelope(`schedule:${row.watchTargetId}:${now.toISOString()}`, {
        watchTargetId: row.watchTargetId,
        repoFullName: `${config.owner}/${config.repo}`,
        config
      }));
      queued += 1;
    }

    if (row.type === "trend") {
      const config = row.config as TrendWatchConfig;
      await enqueueJob("ingest.snapshot", "fetch_trending_snapshot", makeEnvelope(
        `schedule_trending:${row.watchTargetId}:${now.toISOString()}`,
        {
          watchTargetId: row.watchTargetId,
          source: "github_trending",
          scope: config.scope,
          snapshotDate: now.toISOString().slice(0, 10)
        }
      ));
      queued += 1;
    }

    if (row.type === "topic") {
      const config = row.config as TopicWatchConfig;

      for (const repoFullName of config.repoBindings) {
        const [owner, repo] = repoFullName.split("/");
        if (!owner || !repo) {
          continue;
        }

        await enqueueJob("ingest.poll", "poll_repo_events", makeEnvelope(`schedule_topic:${row.watchTargetId}:${repoFullName}:${now.toISOString()}`, {
          watchTargetId: row.watchTargetId,
          repoFullName,
          config: {
            owner,
            repo,
            pullsLimit: 5,
            issuesLimit: 5
          }
        }));
        queued += 1;
      }
    }

    await db
      .update(watchSchedule)
      .set({
        lastRunAt: now,
        nextRunAt: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      })
      .where(eq(watchSchedule.id, row.scheduleId));
  }

  return {
    queued
  };
}

export async function createApp() {
  const app = Fastify({
    loggerInstance: createLogger("scheduler")
  });

  await app.register(cors, { origin: true });
  await app.register(helmet);
  await app.register(sensible);

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.post("/run-once", async () => runSchedulerTick());

  return app;
}
