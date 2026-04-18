import { and, eq, isNull, or } from "drizzle-orm";

import { enqueueJob, waitForJobResult } from "@akyuu/infra-queue";
import { appUser, db, topic, watchTarget, workspaceMember } from "@akyuu/infra-db";
import { getMessages } from "@akyuu/shared-i18n";
import { formatDateForTimezone, getDayWindow, getMonthWindow, getWeekWindow, isoNow } from "@akyuu/shared-utils";
import type {
  JobEnvelope,
  RepoWatchConfig,
  TopicWatchConfig,
  TrendWatchConfig,
  WatchRecord
} from "@akyuu/shared-types";

type RepoPollPayload = {
  watchTargetId: string;
  repoFullName: string;
  config: RepoWatchConfig;
};

type RepoPollResult = {
  rawSignalIds: string[];
};

type SnapshotPayload = {
  watchTargetId: string;
  source: "github_trending";
  scope: string;
  snapshotDate: string;
};

type SnapshotResult = {
  rawSnapshotId: string;
};

type NormalizeSignalPayload = {
  rawSignalId: string;
};

type NormalizeSignalResult = {
  canonicalEventId: string | null;
};

type NormalizeSnapshotPayload = {
  rawSnapshotId: string;
};

type NormalizeSnapshotResult = {
  source: string;
  scope: string;
  snapshotDate: string;
  trendSnapshotId: string;
};

type MatchTopicPayload = {
  canonicalEventId: string;
};

type AggregateTopicPayload = {
  topicId: string;
  windowStart: string;
  windowEnd: string;
  updateType: "daily" | "weekly" | "monthly";
};

type ScorePayload = {
  canonicalEventId: string;
  workspaceId: string;
  watchPriority: number;
};

type TrendDiffPayload = {
  source: string;
  scope: string;
  snapshotDate: string;
};

type DigestPayload = {
  workspaceId: string;
  digestType: "daily" | "weekly" | "monthly";
  date: string;
};

type DigestResult = {
  digestId: string;
};

type NotifyDigestPayload = {
  digestId: string;
  recipient: string;
};

function makeEnvelope<TPayload>(idempotencyKey: string, payload: TPayload): JobEnvelope<TPayload> {
  return {
    payloadVersion: 1,
    idempotencyKey,
    requestedAt: isoNow(),
    trigger: "api",
    payload
  };
}

function repoWatchRowToView(row: typeof watchTarget.$inferSelect): WatchRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as WatchRecord["type"],
    name: row.name,
    status: row.status as WatchRecord["status"],
    priority: row.priority,
    config: row.config as WatchRecord["config"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function runWorkspacePipeline(input: {
  workspaceId: string;
  timezone: string;
  locale: "en-US" | "zh-CN";
  date?: string;
  digestType: "daily" | "weekly" | "monthly";
}): Promise<string> {
  const dateLabel = input.date ?? formatDateForTimezone(new Date(), input.timezone);
  const runToken = isoNow();
  const messages = getMessages(input.locale);

  const watchRows = await db.select().from(watchTarget).where(eq(watchTarget.workspaceId, input.workspaceId));
  const watches = watchRows
    .filter((row) => row.deletedAt === null && row.status === "active")
    .map(repoWatchRowToView)
    .filter((watch) => watch.type === "repo" || watch.type === "trend" || watch.type === "topic");

  if (watches.length === 0) {
    throw new Error(messages.api.noActiveWatches);
  }

  const rawSignalPriority = new Map<string, number>();
  const normalizedSignalIds = new Set<string>();
  const normalizeSignalPayloads: NormalizeSignalPayload[] = [];
  const normalizeSnapshotPayloads: NormalizeSnapshotPayload[] = [];

  for (const watch of watches) {
    if (watch.type === "repo") {
      const config = watch.config as RepoWatchConfig;
      const repoFullName = `${config.owner}/${config.repo}`;
      const job = await enqueueJob<RepoPollPayload>("ingest.poll", "poll_repo_events", makeEnvelope(
        `poll_repo:${watch.id}:${dateLabel}:${runToken}`,
        {
          watchTargetId: watch.id,
          repoFullName,
          config
        }
      ));

      const result = await waitForJobResult<RepoPollPayload, RepoPollResult>("ingest.poll", job);

      for (const rawSignalId of result.rawSignalIds) {
        rawSignalPriority.set(rawSignalId, watch.priority);
        if (!normalizedSignalIds.has(rawSignalId)) {
          normalizeSignalPayloads.push({
            rawSignalId
          });
          normalizedSignalIds.add(rawSignalId);
        }
      }
    }

    if (watch.type === "trend") {
      const config = watch.config as TrendWatchConfig;
      const job = await enqueueJob<SnapshotPayload>("ingest.snapshot", "fetch_trending_snapshot", makeEnvelope(
        `snapshot:${watch.id}:${config.scope}:${dateLabel}:${runToken}`,
        {
          watchTargetId: watch.id,
          source: "github_trending",
          scope: config.scope,
          snapshotDate: dateLabel
        }
      ));

      const result = await waitForJobResult<SnapshotPayload, SnapshotResult>("ingest.snapshot", job);

      normalizeSnapshotPayloads.push({
        rawSnapshotId: result.rawSnapshotId
      });
    }

    if (watch.type === "topic") {
      const config = watch.config as TopicWatchConfig;

      for (const repoFullName of config.repoBindings) {
        const [owner, repo] = repoFullName.split("/");
        if (!owner || !repo) {
          continue;
        }

        const job = await enqueueJob<RepoPollPayload>("ingest.poll", "poll_repo_events", makeEnvelope(
          `poll_topic_repo:${watch.id}:${repoFullName}:${dateLabel}:${runToken}`,
          {
            watchTargetId: watch.id,
            repoFullName,
            config: {
              owner,
              repo,
              pullsLimit: 5,
              issuesLimit: 5
            }
          }
        ));

        const result = await waitForJobResult<RepoPollPayload, RepoPollResult>("ingest.poll", job);

        for (const rawSignalId of result.rawSignalIds) {
          rawSignalPriority.set(rawSignalId, Math.max(rawSignalPriority.get(rawSignalId) ?? 0, watch.priority));
          if (!normalizedSignalIds.has(rawSignalId)) {
            normalizeSignalPayloads.push({
              rawSignalId
            });
            normalizedSignalIds.add(rawSignalId);
          }
        }
      }
    }
  }

  const canonicalEventIds: Array<{ eventId: string; priority: number }> = [];

  for (const payload of normalizeSignalPayloads) {
    const job = await enqueueJob<NormalizeSignalPayload>("normalize.event", "normalize_raw_signal", makeEnvelope(
      `normalize_signal:${payload.rawSignalId}:${runToken}`,
      payload
    ));

    const result = await waitForJobResult<NormalizeSignalPayload, NormalizeSignalResult>("normalize.event", job);

    if (result.canonicalEventId) {
      canonicalEventIds.push({
        eventId: result.canonicalEventId,
        priority: rawSignalPriority.get(payload.rawSignalId) ?? 3
      });
    }
  }

  const normalizedSnapshots: NormalizeSnapshotResult[] = [];

  for (const payload of normalizeSnapshotPayloads) {
    const job = await enqueueJob<NormalizeSnapshotPayload>("normalize.event", "normalize_raw_snapshot", makeEnvelope(
      `normalize_snapshot:${payload.rawSnapshotId}:${runToken}`,
      payload
    ));

    const result = await waitForJobResult<NormalizeSnapshotPayload, NormalizeSnapshotResult>("normalize.event", job);
    normalizedSnapshots.push(result);
  }

  for (const item of canonicalEventIds) {
    const [scoreJob, topicJob] = await Promise.all([
      enqueueJob<ScorePayload>("score.rank", "score_canonical_event", makeEnvelope(
        `score:${item.eventId}:${input.workspaceId}:${runToken}`,
        {
          canonicalEventId: item.eventId,
          workspaceId: input.workspaceId,
          watchPriority: item.priority
        }
      )),
      enqueueJob<MatchTopicPayload>("topic.match", "match_event_to_topics", makeEnvelope(
        `topic_match:${item.eventId}:${runToken}`,
        {
          canonicalEventId: item.eventId
        }
      ))
    ]);

    await Promise.all([
      waitForJobResult<ScorePayload, unknown>("score.rank", scoreJob),
      waitForJobResult<MatchTopicPayload, unknown>("topic.match", topicJob)
    ]);
  }

  for (const snapshot of normalizedSnapshots) {
    const job = await enqueueJob<TrendDiffPayload>("trend.diff", "build_trend_diff", makeEnvelope(
      `trend_diff:${snapshot.source}:${snapshot.scope}:${snapshot.snapshotDate}:${runToken}`,
      {
        source: snapshot.source,
        scope: snapshot.scope,
        snapshotDate: snapshot.snapshotDate
      }
    ));

    await waitForJobResult<TrendDiffPayload, unknown>("trend.diff", job);
  }

  const { start, end } =
    input.digestType === "weekly"
      ? getWeekWindow(dateLabel, input.timezone)
      : input.digestType === "monthly"
        ? getMonthWindow(dateLabel, input.timezone)
        : getDayWindow(dateLabel, input.timezone);
  const topicRows = await db
    .select({ id: topic.id })
    .from(topic)
    .where(and(eq(topic.status, "active"), or(eq(topic.workspaceId, input.workspaceId), isNull(topic.workspaceId))));

  for (const topicRow of topicRows) {
    const job = await enqueueJob<AggregateTopicPayload>("topic.match", "aggregate_topic_window", makeEnvelope(
      `topic_update:${topicRow.id}:${input.digestType}:${dateLabel}:${runToken}`,
      {
        topicId: topicRow.id,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        updateType: input.digestType
      }
    ));

    await waitForJobResult<AggregateTopicPayload, unknown>("topic.match", job);
  }

  const digestJob = await enqueueJob<DigestPayload>("digest.build", "build_digest_skeleton", makeEnvelope(
    `digest_skeleton:${input.workspaceId}:${input.digestType}:${dateLabel}:${runToken}`,
    {
      workspaceId: input.workspaceId,
      digestType: input.digestType,
      date: dateLabel
    }
  ));

  const digestResult = await waitForJobResult<DigestPayload, DigestResult>("digest.build", digestJob);

  const [recommendedJob, renderJob] = await Promise.all([
    enqueueJob<{ digestId: string }>("digest.build", "build_recommended_items", makeEnvelope(
      `digest_recommended:${digestResult.digestId}:${runToken}`,
      {
        digestId: digestResult.digestId
      }
    )),
    enqueueJob<{ digestId: string }>("digest.build", "render_digest_with_llm", makeEnvelope(
      `digest_render:${digestResult.digestId}:${runToken}`,
      {
        digestId: digestResult.digestId
      }
    ))
  ]);

  await Promise.all([
    waitForJobResult<{ digestId: string }, unknown>("digest.build", recommendedJob),
    waitForJobResult<{ digestId: string }, unknown>("digest.build", renderJob)
  ]);

  const recipientRows = await db
    .select({
      email: appUser.email
    })
    .from(workspaceMember)
    .innerJoin(appUser, eq(workspaceMember.userId, appUser.id))
    .where(eq(workspaceMember.workspaceId, input.workspaceId));

  for (const recipientRow of recipientRows) {
    const recipient = recipientRow.email.trim();
    if (!recipient) {
      continue;
    }

    const notifyJob = await enqueueJob<NotifyDigestPayload>("notify.send", "send_email_digest", makeEnvelope(
      `notify_email:${digestResult.digestId}:${recipient}:${runToken}`,
      {
        digestId: digestResult.digestId,
        recipient
      }
    ));

    await waitForJobResult<NotifyDigestPayload, unknown>("notify.send", notifyJob);
  }

  return digestResult.digestId;
}
