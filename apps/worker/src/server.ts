import crypto from "node:crypto";

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

import { normalizeRawSignal as normalizeSignalDomain, normalizeRawSnapshot } from "@akyuu/domain-canonical";
import { buildDigestSkeleton } from "@akyuu/domain-digest";
import { getPreferenceBonus } from "@akyuu/domain-feedback";
import { scoreCanonicalEvent } from "@akyuu/domain-score";
import { buildTrendDiffSummary } from "@akyuu/domain-trend";
import { buildTopicUpdateSummary, matchTopicRules } from "@akyuu/domain-topic";
import { hashPayload } from "@akyuu/domain-source";
import { canonicalEventTypeSchema, type JobEnvelope, type QueueName } from "@akyuu/shared-types";
import { formatDateForTimezone, getDayWindow, getMonthWindow, getWeekWindow } from "@akyuu/shared-utils";
import {
  canonicalEntity,
  canonicalEvent,
  db,
  digest,
  digestSection,
  eventEntityRelation,
  eventScore,
  jobRun,
  outboundNotification,
  preferenceProfile,
  rawSignal,
  rawSnapshot,
  recommendedItem,
  sourceCursor,
  topic,
  topicAlias,
  topicEvidence,
  topicRule,
  topicUpdate,
  trendDiff,
  trendSnapshot,
  trendSnapshotItem,
  workspace
} from "@akyuu/infra-db";
import { fetchRepoSignals } from "@akyuu/infra-github";
import { renderDigestMarkdown } from "@akyuu/infra-llm";
import { createLogger } from "@akyuu/infra-observability";
import { createQueueWorker } from "@akyuu/infra-queue";
import { fetchTrendingHtml, parseTrendingHtml } from "@akyuu/infra-scraper";
import { getEnv } from "@akyuu/shared-config";

const logger = createLogger("worker");

type QueueHandler<TPayload, TResult> = (payload: TPayload, job: JobEnvelope<TPayload>) => Promise<TResult>;

async function markJobRunning(queueName: QueueName, jobName: string, envelope: JobEnvelope<unknown>): Promise<void> {
  await db
    .insert(jobRun)
    .values({
      queueName,
      jobName,
      idempotencyKey: envelope.idempotencyKey,
      status: "running",
      inputJson: envelope as Record<string, unknown>,
      startedAt: new Date(),
      attemptCount: 1
    })
    .onConflictDoUpdate({
      target: [jobRun.queueName, jobRun.idempotencyKey],
      set: {
        status: "running",
        inputJson: envelope as Record<string, unknown>,
        startedAt: new Date(),
        attemptCount: sql`${jobRun.attemptCount} + 1`
      }
    });
}

async function markJobFinished(
  queueName: QueueName,
  jobName: string,
  envelope: JobEnvelope<unknown>,
  status: "succeeded" | "failed",
  outputJson: Record<string, unknown>,
  errorText?: string
): Promise<void> {
  await db
    .insert(jobRun)
    .values({
      queueName,
      jobName,
      idempotencyKey: envelope.idempotencyKey,
      status,
      inputJson: envelope as Record<string, unknown>,
      outputJson,
      errorText,
      finishedAt: new Date(),
      attemptCount: 1
    })
    .onConflictDoUpdate({
      target: [jobRun.queueName, jobRun.idempotencyKey],
      set: {
        status,
        outputJson,
        errorText,
        finishedAt: new Date()
      }
    });
}

function withJobRun<TPayload, TResult>(
  queueName: QueueName,
  jobName: string,
  handler: QueueHandler<TPayload, TResult>
) {
  return async (job: { data: JobEnvelope<TPayload> }) => {
    await markJobRunning(queueName, jobName, job.data);

    try {
      const result = await handler(job.data.payload, job.data);
      await markJobFinished(queueName, jobName, job.data, "succeeded", result as Record<string, unknown>);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown worker error";
      await markJobFinished(queueName, jobName, job.data, "failed", {}, message);
      throw error;
    }
  };
}

async function upsertEntity(input: {
  entityType: string;
  externalSource: string;
  externalKey: string;
  displayName: string;
  normalizedName: string;
  metadata: Record<string, unknown>;
}) {
  const [existing] = await db
    .select()
    .from(canonicalEntity)
    .where(
      and(
        eq(canonicalEntity.entityType, input.entityType),
        eq(canonicalEntity.externalSource, input.externalSource),
        eq(canonicalEntity.externalKey, input.externalKey)
      )
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const [inserted] = await db.insert(canonicalEntity).values(input).returning();
  return inserted;
}

const pollRepoEventsHandler = withJobRun(
  "ingest.poll",
  "poll_repo_events",
  async (payload: {
    watchTargetId: string;
    repoFullName: string;
    config: {
      owner: string;
      repo: string;
      pullsLimit: number;
      issuesLimit: number;
    };
  }) => {
    const signals = await fetchRepoSignals(payload.config);
    const insertedIds: string[] = [];

    for (const signal of signals) {
      const [inserted] = await db
        .insert(rawSignal)
        .values({
          sourceType: signal.sourceType,
          sourceKey: signal.sourceKey,
          externalId: signal.externalId,
          occurredAt: new Date(signal.occurredAt),
          payload: signal.payload,
          payloadHash: hashPayload(signal.payload)
        })
        .onConflictDoNothing({
          target: [rawSignal.sourceType, rawSignal.sourceKey, rawSignal.externalId]
        })
        .returning();

      if (inserted) {
        insertedIds.push(inserted.id);
      } else {
        const [existing] = await db
          .select()
          .from(rawSignal)
          .where(
            and(
              eq(rawSignal.sourceType, signal.sourceType),
              eq(rawSignal.sourceKey, signal.sourceKey),
              eq(rawSignal.externalId, signal.externalId)
            )
          )
          .limit(1);

        if (existing) {
          insertedIds.push(existing.id);
        }
      }
    }

    await db
      .insert(sourceCursor)
      .values({
        sourceType: "github_repo",
        sourceKey: payload.repoFullName,
        lastPolledAt: new Date(),
        nextPollAfter: new Date(Date.now() + 60 * 60 * 1000),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: [sourceCursor.sourceType, sourceCursor.sourceKey],
        set: {
          lastPolledAt: new Date(),
          nextPollAfter: new Date(Date.now() + 60 * 60 * 1000),
          updatedAt: new Date()
        }
      });

    return {
      rawSignalIds: insertedIds
    };
  }
);

const fetchTrendingSnapshotHandler = withJobRun(
  "ingest.snapshot",
  "fetch_trending_snapshot",
  async (payload: {
    watchTargetId: string;
    source: "github_trending";
    scope: string;
    snapshotDate: string;
  }) => {
    const html = await fetchTrendingHtml(payload.scope);
    const [inserted] = await db
      .insert(rawSnapshot)
      .values({
        sourceType: payload.source,
        sourceKey: `${payload.source}:${payload.scope}`,
        snapshotDate: payload.snapshotDate,
        contentFormat: "html",
        content: html,
        contentHash: crypto.createHash("sha256").update(html).digest("hex"),
        meta: {
          scope: payload.scope
        }
      })
      .onConflictDoUpdate({
        target: [rawSnapshot.sourceType, rawSnapshot.sourceKey, rawSnapshot.snapshotDate],
        set: {
          content: html,
          contentHash: crypto.createHash("sha256").update(html).digest("hex"),
          capturedAt: new Date()
        }
      })
      .returning();

    if (!inserted) {
      throw new Error("failed to persist raw snapshot");
    }

    return {
      rawSnapshotId: inserted.id
    };
  }
);

const normalizeRawSignalHandler = withJobRun(
  "normalize.event",
  "normalize_raw_signal",
  async (payload: { rawSignalId: string }) => {
    const [rawSignalRow] = await db.select().from(rawSignal).where(eq(rawSignal.id, payload.rawSignalId)).limit(1);

    if (!rawSignalRow) {
      throw new Error(`raw_signal ${payload.rawSignalId} not found`);
    }

    const normalized = normalizeSignalDomain({
      sourceType: rawSignalRow.sourceType,
      sourceKey: rawSignalRow.sourceKey,
      occurredAt: rawSignalRow.occurredAt.toISOString(),
      payload: rawSignalRow.payload
    });

    if (!normalized) {
      return {
        canonicalEventId: null
      };
    }

    const entityMap = new Map<string, string>();

    for (const entity of normalized.entities) {
      const entityRow = await upsertEntity(entity);
      if (!entityRow) {
        throw new Error(`failed to persist entity ${entity.externalKey}`);
      }
      entityMap.set(entity.externalKey, entityRow.id);
    }

    const [insertedEvent] = await db
      .insert(canonicalEvent)
      .values({
        eventType: normalized.event.eventType,
        occurredAt: new Date(normalized.event.occurredAt),
        sourceSignalId: rawSignalRow.id,
        subjectEntityId: entityMap.get(normalized.event.subjectExternalKey)!,
        repoEntityId: normalized.event.repoExternalKey ? entityMap.get(normalized.event.repoExternalKey) ?? null : null,
        actorEntityId: normalized.event.actorExternalKey ? entityMap.get(normalized.event.actorExternalKey) ?? null : null,
        confidence: "1",
        metadata: normalized.event.metadata,
        dedupeKey: normalized.event.dedupeKey
      })
      .onConflictDoNothing({
        target: [canonicalEvent.dedupeKey]
      })
      .returning();

    const eventRow =
      insertedEvent ??
      (await db.select().from(canonicalEvent).where(eq(canonicalEvent.dedupeKey, normalized.event.dedupeKey)).limit(1))[0];

    if (!eventRow) {
      throw new Error(`failed to persist canonical event ${normalized.event.dedupeKey}`);
    }

    if (insertedEvent) {
      for (const relation of normalized.relations) {
        const entityId = entityMap.get(relation.entityExternalKey);
        if (!entityId) {
          continue;
        }
        await db.insert(eventEntityRelation).values({
          canonicalEventId: eventRow.id,
          entityId,
          relationType: relation.relationType,
          metadata: relation.metadata
        });
      }
    }

    return {
      canonicalEventId: eventRow.id
    };
  }
);

const normalizeRawSnapshotHandler = withJobRun(
  "normalize.event",
  "normalize_raw_snapshot",
  async (payload: { rawSnapshotId: string }) => {
    const [snapshotRow] = await db.select().from(rawSnapshot).where(eq(rawSnapshot.id, payload.rawSnapshotId)).limit(1);

    if (!snapshotRow) {
      throw new Error(`raw_snapshot ${payload.rawSnapshotId} not found`);
    }

    const scope = String((snapshotRow.meta as Record<string, unknown>).scope ?? "global");
    const items = parseTrendingHtml(snapshotRow.content);
    const normalized = normalizeRawSnapshot({
      source: snapshotRow.sourceType,
      scope,
      snapshotDate: snapshotRow.snapshotDate,
      items
    });

    const [trendSnapshotRow] = await db
      .insert(trendSnapshot)
      .values({
        source: normalized.source,
        scope: normalized.scope,
        snapshotDate: normalized.snapshotDate,
        rawSnapshotId: snapshotRow.id,
        metadata: {}
      })
      .onConflictDoUpdate({
        target: [trendSnapshot.source, trendSnapshot.scope, trendSnapshot.snapshotDate],
        set: {
          rawSnapshotId: snapshotRow.id,
          capturedAt: new Date()
        }
      })
      .returning();

    if (!trendSnapshotRow) {
      throw new Error("failed to persist trend snapshot");
    }

    await db.delete(trendSnapshotItem).where(eq(trendSnapshotItem.trendSnapshotId, trendSnapshotRow.id));

    if (normalized.items.length > 0) {
      await db.insert(trendSnapshotItem).values(
        normalized.items.map((item) => ({
          trendSnapshotId: trendSnapshotRow.id,
          rank: item.rank,
          repoFullName: item.repoFullName,
          description: item.description,
          language: item.language,
          metricPrimary: item.metricPrimary ? String(item.metricPrimary) : null,
          metadata: {}
        }))
      );
    }

    return {
      source: normalized.source,
      scope: normalized.scope,
      snapshotDate: normalized.snapshotDate,
      trendSnapshotId: trendSnapshotRow.id
    };
  }
);

const matchTopicsHandler = withJobRun(
  "topic.match",
  "match_event_to_topics",
  async (payload: { canonicalEventId: string }) => {
    const [eventRow] = await db.select().from(canonicalEvent).where(eq(canonicalEvent.id, payload.canonicalEventId)).limit(1);

    if (!eventRow) {
      throw new Error(`canonical_event ${payload.canonicalEventId} not found`);
    }

    const [subject, repo, actor] = await Promise.all([
      db.select().from(canonicalEntity).where(eq(canonicalEntity.id, eventRow.subjectEntityId)).limit(1),
      eventRow.repoEntityId
        ? db.select().from(canonicalEntity).where(eq(canonicalEntity.id, eventRow.repoEntityId)).limit(1)
        : Promise.resolve([]),
      eventRow.actorEntityId
        ? db.select().from(canonicalEntity).where(eq(canonicalEntity.id, eventRow.actorEntityId)).limit(1)
        : Promise.resolve([])
    ]);

    const topicRows = await db.select().from(topic).where(eq(topic.status, "active"));
    let insertedCount = 0;

    for (const topicRow of topicRows) {
      const [aliases, rules] = await Promise.all([
        db.select().from(topicAlias).where(eq(topicAlias.topicId, topicRow.id)),
        db.select().from(topicRule).where(eq(topicRule.topicId, topicRow.id))
      ]);

      const metadata = eventRow.metadata as Record<string, unknown>;
      const evidences = matchTopicRules({
        topicId: topicRow.id,
        canonicalEventId: eventRow.id,
        repoFullName: repo[0]?.externalKey ?? null,
        title: String(metadata.title ?? subject[0]?.displayName ?? ""),
        body: String(metadata.body ?? ""),
        labels: Array.isArray(metadata.labels) ? metadata.labels.map(String) : [],
        paths: [],
        references: [],
        people: actor[0] ? [actor[0].externalKey] : [],
        aliases: aliases.map((item) => ({
          topicId: item.topicId,
          alias: item.alias,
          aliasType: item.aliasType,
          weight: Number(item.weight)
        })),
        rules: rules.map((item) => ({
          id: item.id,
          topicId: item.topicId,
          ruleType: item.ruleType as any,
          operator: item.operator as any,
          value: item.value,
          weight: Number(item.weight)
        }))
      });

      for (const evidence of evidences) {
        const [inserted] = await db
          .insert(topicEvidence)
          .values({
            topicId: evidence.topicId,
            canonicalEventId: evidence.canonicalEventId,
            evidenceType: evidence.evidenceType,
            score: String(evidence.score),
            explanation: evidence.explanation
          })
          .onConflictDoNothing({
            target: [topicEvidence.topicId, topicEvidence.canonicalEventId, topicEvidence.evidenceType]
          })
          .returning();

        if (inserted) {
          insertedCount += 1;
        }
      }
    }

    return {
      insertedCount
    };
  }
);

const buildTrendDiffHandler = withJobRun(
  "trend.diff",
  "build_trend_diff",
  async (payload: { source: string; scope: string; snapshotDate: string }) => {
    const [current] = await db
      .select()
      .from(trendSnapshot)
      .where(
        and(
          eq(trendSnapshot.source, payload.source),
          eq(trendSnapshot.scope, payload.scope),
          eq(trendSnapshot.snapshotDate, payload.snapshotDate)
        )
      )
      .limit(1);

    if (!current) {
      throw new Error("trend snapshot not found");
    }

    const [previous] = await db
      .select()
      .from(trendSnapshot)
      .where(and(eq(trendSnapshot.source, payload.source), eq(trendSnapshot.scope, payload.scope)))
      .orderBy(desc(trendSnapshot.snapshotDate))
      .offset(1)
      .limit(1);

    if (!previous) {
      return {
        trendDiffId: null
      };
    }

    const [currentItems, previousItems] = await Promise.all([
      db.select().from(trendSnapshotItem).where(eq(trendSnapshotItem.trendSnapshotId, current.id)),
      db.select().from(trendSnapshotItem).where(eq(trendSnapshotItem.trendSnapshotId, previous.id))
    ]);

    const summary = buildTrendDiffSummary(
      previousItems.map((item) => ({
        rank: item.rank,
        repoFullName: item.repoFullName,
        description: item.description,
        language: item.language,
        starsToday: item.metricPrimary ? Number(item.metricPrimary) : null
      })),
      currentItems.map((item) => ({
        rank: item.rank,
        repoFullName: item.repoFullName,
        description: item.description,
        language: item.language,
        starsToday: item.metricPrimary ? Number(item.metricPrimary) : null
      }))
    );

    const [trendDiffRow] = await db
      .insert(trendDiff)
      .values({
        source: payload.source,
        scope: payload.scope,
        snapshotDate: payload.snapshotDate,
        comparedToDate: previous.snapshotDate,
        diffStruct: summary as unknown as Record<string, unknown>,
        summaryStruct: {
          highlights: summary.highlights
        }
      })
      .onConflictDoUpdate({
        target: [trendDiff.source, trendDiff.scope, trendDiff.snapshotDate, trendDiff.comparedToDate],
        set: {
          diffStruct: summary as unknown as Record<string, unknown>,
          summaryStruct: {
            highlights: summary.highlights
          }
        }
      })
      .returning();

    if (!trendDiffRow) {
      throw new Error("failed to persist trend diff");
    }

    return {
      trendDiffId: trendDiffRow.id
    };
  }
);

const aggregateTopicWindowHandler = withJobRun(
  "topic.match",
  "aggregate_topic_window",
  async (payload: { topicId: string; windowStart: string; windowEnd: string; updateType: "daily" | "weekly" | "monthly" }) => {
    const [topicRow] = await db.select().from(topic).where(eq(topic.id, payload.topicId)).limit(1);

    if (!topicRow) {
      throw new Error("topic not found");
    }

    const evidenceResult = await db.execute(sql`
      select
        te.id as topic_evidence_id,
        te.explanation,
        te.score,
        ce.event_type,
        subj.display_name as subject_name,
        subj.metadata as subject_metadata,
        repo.external_key as repo_full_name
      from topic_evidence te
      join canonical_event ce on ce.id = te.canonical_event_id
      join canonical_entity subj on subj.id = ce.subject_entity_id
      left join canonical_entity repo on repo.id = ce.repo_entity_id
      where te.topic_id = ${payload.topicId}
        and ce.occurred_at >= ${new Date(payload.windowStart)}
        and ce.occurred_at < ${new Date(payload.windowEnd)}
      order by te.score desc, ce.occurred_at desc
      limit 10
    `);

    const evidenceRows = evidenceResult.rows as Array<{
      topic_evidence_id: string;
      explanation: string;
      score: string;
      event_type: string;
      subject_name: string;
      subject_metadata: Record<string, unknown>;
      repo_full_name: string | null;
    }>;

    const summary = buildTopicUpdateSummary({
      topicName: topicRow.name,
      evidences: evidenceRows.map((row) => ({
        title: String(row.subject_metadata.title ?? row.subject_name),
        repoFullName: row.repo_full_name,
        eventType: row.event_type,
        explanation: row.explanation
      }))
    });

    const totalScore = evidenceRows.reduce((sum, row) => sum + Number(row.score), 0);

    const [topicUpdateRow] = await db
      .insert(topicUpdate)
      .values({
        topicId: topicRow.id,
        windowStart: new Date(payload.windowStart),
        windowEnd: new Date(payload.windowEnd),
        updateType: payload.updateType,
        importanceScore: String(totalScore),
        summaryStruct: {
          summary: summary.summary,
          highlights: summary.highlights,
          evidenceCount: summary.evidenceCount
        }
      })
      .onConflictDoUpdate({
        target: [topicUpdate.topicId, topicUpdate.windowStart, topicUpdate.windowEnd, topicUpdate.updateType],
        set: {
          importanceScore: String(totalScore),
          summaryStruct: {
            summary: summary.summary,
            highlights: summary.highlights,
            evidenceCount: summary.evidenceCount
          }
        }
      })
      .returning();

    if (!topicUpdateRow) {
      throw new Error("failed to persist topic update");
    }

    return {
      topicUpdateId: topicUpdateRow.id,
      evidenceCount: summary.evidenceCount
    };
  }
);

const scoreCanonicalEventHandler = withJobRun(
  "score.rank",
  "score_canonical_event",
  async (payload: { canonicalEventId: string; workspaceId: string; watchPriority: number }) => {
    const [eventRow] = await db.select().from(canonicalEvent).where(eq(canonicalEvent.id, payload.canonicalEventId)).limit(1);

    if (!eventRow) {
      throw new Error("canonical event not found");
    }

    const score = scoreCanonicalEvent({
      eventType: canonicalEventTypeSchema.parse(eventRow.eventType),
      metadata: eventRow.metadata as Record<string, unknown>,
      watchPriority: payload.watchPriority
    });

    const [eventScoreRow] = await db
      .insert(eventScore)
      .values({
        targetType: "canonical_event",
        targetId: eventRow.id,
        workspaceId: payload.workspaceId,
        scoreType: "importance",
        score: String(score.score),
        featureBreakdown: score.featureBreakdown as unknown as Record<string, unknown>,
        modelVersion: "v1"
      })
      .onConflictDoUpdate({
        target: [
          eventScore.targetType,
          eventScore.targetId,
          eventScore.workspaceId,
          eventScore.scoreType,
          eventScore.modelVersion
        ],
        set: {
          score: String(score.score),
          featureBreakdown: score.featureBreakdown as unknown as Record<string, unknown>
        }
      })
      .returning();

    if (!eventScoreRow) {
      throw new Error("failed to persist event score");
    }

    return {
      eventScoreId: eventScoreRow.id,
      score: score.score
    };
  }
);

async function buildDigestData(workspaceId: string, dateLabel: string, digestType: "daily" | "weekly" | "monthly") {
  const [workspaceRow] = await db.select().from(workspace).where(eq(workspace.id, workspaceId)).limit(1);

  if (!workspaceRow) {
    throw new Error("workspace not found");
  }

  const { start, end } =
    digestType === "weekly"
      ? getWeekWindow(dateLabel, workspaceRow.timezone)
      : digestType === "monthly"
        ? getMonthWindow(dateLabel, workspaceRow.timezone)
        : getDayWindow(dateLabel, workspaceRow.timezone);
  const startDateLabel = formatDateForTimezone(start, workspaceRow.timezone);
  const endDateLabelExclusive = formatDateForTimezone(end, workspaceRow.timezone);
  const eventRows = await db.execute(sql`
    select
      ce.id as event_id,
      ce.event_type,
      ce.occurred_at,
      ce.metadata,
      subj.display_name as subject_name,
      subj.metadata as subject_metadata,
      repo.display_name as repo_name,
      es.score
    from canonical_event ce
    join canonical_entity subj on subj.id = ce.subject_entity_id
    left join canonical_entity repo on repo.id = ce.repo_entity_id
    left join event_score es
      on es.target_id = ce.id
      and es.target_type = 'canonical_event'
      and es.workspace_id = ${workspaceId}
      and es.score_type = 'importance'
    where ce.occurred_at >= ${start} and ce.occurred_at < ${end}
    order by es.score desc nulls last, ce.occurred_at desc
    limit 10
  `);

  const trendRows = await db
    .select()
    .from(trendDiff)
    .where(and(gte(trendDiff.snapshotDate, startDateLabel), lt(trendDiff.snapshotDate, endDateLabelExclusive)))
    .orderBy(desc(trendDiff.createdAt))
    .limit(5);

  const topicRows = await db.execute(sql`
    select
      tu.id,
      tu.topic_id,
      tu.summary_struct,
      tu.window_start,
      tu.window_end,
      tu.created_at,
      t.name as topic_name
    from topic_update tu
    join topic t on t.id = tu.topic_id
    where tu.update_type = ${digestType}
      and tu.window_start >= ${start}
      and tu.window_end <= ${end}
    order by tu.importance_score desc, tu.created_at desc
    limit 5
  `);

  return {
    workspaceRow,
    start,
    end,
    eventRows: eventRows.rows as Array<{
      event_id: string;
      event_type: string;
      occurred_at: Date;
      metadata: Record<string, unknown>;
      subject_name: string;
      subject_metadata: Record<string, unknown>;
      repo_name: string | null;
      score: string | null;
    }>,
    trendRows,
    topicRows: topicRows.rows as Array<{
      id: string;
      topic_id: string;
      summary_struct: Record<string, unknown>;
      window_start: Date;
      window_end: Date;
      created_at: Date;
      topic_name: string;
    }>
  };
}

const buildDigestSkeletonHandler = withJobRun(
  "digest.build",
  "build_digest_skeleton",
  async (payload: { workspaceId: string; digestType: "daily" | "weekly" | "monthly"; date: string }) => {
    const data = await buildDigestData(payload.workspaceId, payload.date, payload.digestType);
    const rangeEndLabel = formatDateForTimezone(new Date(data.end.getTime() - 1000), data.workspaceRow.timezone);
    const title =
      payload.digestType === "weekly"
        ? `Weekly Digest · ${formatDateForTimezone(data.start, data.workspaceRow.timezone)} to ${rangeEndLabel}`
        : payload.digestType === "monthly"
          ? `Monthly Digest · ${formatDateForTimezone(data.start, data.workspaceRow.timezone)} to ${rangeEndLabel}`
        : `Daily Digest · ${payload.date}`;
    const summary =
      payload.digestType === "weekly"
        ? `Workspace weekly digest for ${formatDateForTimezone(data.start, data.workspaceRow.timezone)} to ${rangeEndLabel}.`
        : payload.digestType === "monthly"
          ? `Workspace monthly digest for ${formatDateForTimezone(data.start, data.workspaceRow.timezone)} to ${rangeEndLabel}.`
        : `Workspace digest for ${payload.date}.`;

    const topStories = data.eventRows.slice(0, 3).map((row) => ({
      title: String(row.subject_metadata.title ?? row.subject_name),
      summary: `${row.event_type} in ${row.repo_name ?? "unknown repo"}`
    }));
    const repoItems = data.eventRows.slice(0, 5).map((row) => ({
      title: row.repo_name ?? row.subject_name,
      summary: `${row.event_type} (${Number(row.score ?? 0).toFixed(1)})`
    }));
    const topicItems = data.topicRows.slice(0, 3).map((row) => {
      const summaryStruct = row.summary_struct as Record<string, unknown>;
      return {
        title: row.topic_name,
        summary: String(summaryStruct.summary ?? "")
      };
    });
    const trendItems = data.trendRows.flatMap((row) => {
      const summaryStruct = row.summaryStruct as Record<string, unknown>;
      const highlights = Array.isArray(summaryStruct.highlights)
        ? summaryStruct.highlights.map(String)
        : [];
      return highlights.map((highlight) => ({
        title: `${row.source}:${row.scope}`,
        summary: highlight
      }));
    });

    const recommendedItems = data.eventRows.slice(0, 5).map((row, index) => ({
      id: crypto.randomUUID(),
      itemType: row.event_type.startsWith("issue") ? ("issue" as const) : row.event_type.startsWith("release") ? ("release" as const) : ("pr" as const),
      title: String(row.subject_metadata.title ?? row.subject_name),
      href: typeof row.subject_metadata.htmlUrl === "string" ? row.subject_metadata.htmlUrl : null,
      reason: `Importance score ${Number(row.score ?? 0).toFixed(1)} from ${row.event_type}`,
      score: Number(row.score ?? 0),
      rank: index + 1,
      sourceTargetId: row.event_id
    }));

    const skeleton = buildDigestSkeleton({
      title,
      summary,
      topStories,
      repoItems,
      topicItems,
      trendItems,
      recommendedItems: recommendedItems.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        title: item.title,
        href: item.href,
        reason: item.reason,
        score: item.score
      }))
    });

    const [digestRow] = await db
      .insert(digest)
      .values({
        workspaceId: payload.workspaceId,
        digestType: payload.digestType,
        windowStart: data.start,
        windowEnd: data.end,
        status: "ready",
        title: skeleton.title,
        summaryStruct: {
          summary: skeleton.summary,
          date: payload.date
        },
        renderedMarkdown: skeleton.markdown,
        llmVersion: null
      })
      .onConflictDoUpdate({
        target: [digest.workspaceId, digest.digestType, digest.windowStart, digest.windowEnd],
        set: {
          status: "ready",
          title: skeleton.title,
          summaryStruct: {
            summary: skeleton.summary,
            date: payload.date
          },
          renderedMarkdown: skeleton.markdown,
          updatedAt: new Date()
        }
      })
      .returning();

    if (!digestRow) {
      throw new Error("failed to persist digest");
    }

    await db.delete(digestSection).where(eq(digestSection.digestId, digestRow.id));

    await db.insert(digestSection).values(
      skeleton.sections.map((section, index) => ({
        digestId: digestRow.id,
        sectionType: section.key,
        title: section.title,
        rank: index + 1,
        summaryStruct: {
          bullets: section.bullets
        },
        renderedMarkdown: section.markdown
      }))
    );

    return {
      digestId: digestRow.id
    };
  }
);

const buildRecommendedItemsHandler = withJobRun(
  "digest.build",
  "build_recommended_items",
  async (payload: { digestId: string }) => {
    const [digestRow] = await db.select().from(digest).where(eq(digest.id, payload.digestId)).limit(1);

    if (!digestRow) {
      throw new Error("digest not found");
    }

    const dateLabel = String(
      (digestRow.summaryStruct as Record<string, unknown>).date ?? digestRow.windowStart.toISOString().slice(0, 10)
    );
    const data = await buildDigestData(
      digestRow.workspaceId,
      dateLabel,
      digestRow.digestType as "daily" | "weekly" | "monthly"
    );
    const [profileRow] = await db
      .select()
      .from(preferenceProfile)
      .where(and(eq(preferenceProfile.workspaceId, digestRow.workspaceId), eq(preferenceProfile.subjectType, "workspace")))
      .orderBy(desc(preferenceProfile.updatedAt))
      .limit(1);

    const profile = profileRow
      ? ({
          workspaceId: profileRow.workspaceId,
          subjectType: profileRow.subjectType as "workspace" | "user",
          subjectId: profileRow.subjectId,
          version: profileRow.version,
          updatedAt: profileRow.updatedAt.toISOString(),
          profile: {
            feedbackCount: Number((profileRow.profileJson as Record<string, unknown>).feedbackCount ?? 0),
            itemTypeWeights: ((profileRow.profileJson as Record<string, unknown>).itemTypeWeights ?? {}) as Record<string, number>,
            repoWeights: ((profileRow.profileJson as Record<string, unknown>).repoWeights ?? {}) as Record<string, number>
          }
        } satisfies import("@akyuu/shared-types").PreferenceProfileView)
      : null;
    await db.delete(recommendedItem).where(eq(recommendedItem.digestId, payload.digestId));

    const rows = data.eventRows
      .map((row) => {
        const itemType = row.event_type.startsWith("issue")
          ? "issue"
          : row.event_type.startsWith("release")
            ? "release"
            : "pr";
        const preferenceBonus = getPreferenceBonus(profile, {
          itemType,
          repoFullName: row.repo_name
        });

        return {
          ...row,
          itemType,
          preferenceBonus,
          adjustedScore: Number(row.score ?? 0) + preferenceBonus
        };
      })
      .sort((left, right) => right.adjustedScore - left.adjustedScore)
      .slice(0, 5);
    for (const [index, row] of rows.entries()) {
      const [eventRow] = await db.select().from(canonicalEvent).where(eq(canonicalEvent.id, row.event_id)).limit(1);
      if (!eventRow) {
        continue;
      }
      await db.insert(recommendedItem).values({
        workspaceId: digestRow.workspaceId,
        digestId: digestRow.id,
        itemType: row.itemType,
        itemEntityId: eventRow.subjectEntityId,
        sourceTargetType: "canonical_event",
        sourceTargetId: eventRow.id,
        rank: index + 1,
        score: String(row.adjustedScore),
        reasonStruct: {
          title: String(row.subject_metadata.title ?? row.subject_name),
          href: typeof row.subject_metadata.htmlUrl === "string" ? row.subject_metadata.htmlUrl : null,
          reason:
            Math.abs(row.preferenceBonus) >= 0.1
              ? `Importance score ${Number(row.score ?? 0).toFixed(1)} with preference ${row.preferenceBonus.toFixed(1)} from ${row.event_type}`
              : `Importance score ${Number(row.score ?? 0).toFixed(1)} from ${row.event_type}`
        }
      });
    }

    return {
      recommendedCount: rows.length
    };
  }
);

const sendEmailDigestHandler = withJobRun(
  "notify.send",
  "send_email_digest",
  async (payload: { digestId: string; recipient: string }) => {
    const [digestRow] = await db.select().from(digest).where(eq(digest.id, payload.digestId)).limit(1);

    if (!digestRow) {
      throw new Error("digest not found");
    }

    await db
      .insert(outboundNotification)
      .values({
        workspaceId: digestRow.workspaceId,
        channel: "email",
        targetAddress: payload.recipient,
        contentRefType: "digest",
        contentRefId: digestRow.id,
        status: "pending",
        attemptCount: 1
      })
      .onConflictDoUpdate({
        target: [
          outboundNotification.channel,
          outboundNotification.targetAddress,
          outboundNotification.contentRefType,
          outboundNotification.contentRefId
        ],
        set: {
          status: "pending",
          attemptCount: sql`${outboundNotification.attemptCount} + 1`,
          lastError: null
        }
      });

    logger.info(
      {
        digestId: digestRow.id,
        recipient: payload.recipient,
        digestType: digestRow.digestType
      },
      "email digest preview sent"
    );

    await db
      .update(outboundNotification)
      .set({
        status: "sent",
        sentAt: new Date(),
        lastError: null
      })
      .where(
        and(
          eq(outboundNotification.channel, "email"),
          eq(outboundNotification.targetAddress, payload.recipient),
          eq(outboundNotification.contentRefType, "digest"),
          eq(outboundNotification.contentRefId, digestRow.id)
        )
      );

    return {
      digestId: digestRow.id,
      recipient: payload.recipient
    };
  }
);

const renderDigestWithLlmHandler = withJobRun(
  "digest.build",
  "render_digest_with_llm",
  async (payload: { digestId: string }) => {
    const [digestRow] = await db.select().from(digest).where(eq(digest.id, payload.digestId)).limit(1);

    if (!digestRow) {
      throw new Error("digest not found");
    }

    const result = await renderDigestMarkdown(digestRow.renderedMarkdown);

    await db
      .update(digest)
      .set({
        renderedMarkdown: result.markdown,
        llmVersion: result.llmVersion,
        updatedAt: new Date()
      })
      .where(eq(digest.id, payload.digestId));

    return {
      digestId: payload.digestId
    };
  }
);

const app = Fastify({
  loggerInstance: logger
});

await app.register(cors, { origin: true });
await app.register(helmet);
await app.register(sensible);

app.get("/health", async () => ({
  status: "ok"
}));

const env = getEnv();

const workers = [
  createQueueWorker("ingest.poll", pollRepoEventsHandler, 2),
  createQueueWorker("ingest.snapshot", fetchTrendingSnapshotHandler, 1),
  createQueueWorker("normalize.event", async (job) => {
    if (job.name === "normalize_raw_signal") {
      return normalizeRawSignalHandler(job as any);
    }
    if (job.name === "normalize_raw_snapshot") {
      return normalizeRawSnapshotHandler(job as any);
    }
    throw new Error(`unsupported normalize job ${job.name}`);
  }, 5),
  createQueueWorker("topic.match", async (job) => {
    if (job.name === "match_event_to_topics") {
      return matchTopicsHandler(job as any);
    }
    if (job.name === "aggregate_topic_window") {
      return aggregateTopicWindowHandler(job as any);
    }
    throw new Error(`Unsupported topic job: ${job.name}`);
  }, 3),
  createQueueWorker("trend.diff", buildTrendDiffHandler, 2),
  createQueueWorker("score.rank", scoreCanonicalEventHandler, 3),
  createQueueWorker("digest.build", async (job) => {
    if (job.name === "build_digest_skeleton") {
      return buildDigestSkeletonHandler(job as any);
    }
    if (job.name === "build_recommended_items") {
      return buildRecommendedItemsHandler(job as any);
    }
    if (job.name === "render_digest_with_llm") {
      return renderDigestWithLlmHandler(job as any);
    }
    throw new Error(`unsupported digest job ${job.name}`);
  }, 2),
  createQueueWorker("notify.send", async (job) => {
    if (job.name === "send_email_digest") {
      return sendEmailDigestHandler(job as any);
    }
    throw new Error(`unsupported notify job ${job.name}`);
  }, 2)
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    logger.error({ jobId: job?.id, queue: worker.name, error }, "worker job failed");
  });
}

await app.listen({
  host: env.WORKER_HOST,
  port: env.WORKER_PORT
});
