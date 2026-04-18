import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getMessages } from "@akyuu/shared-i18n";

import type {
  DigestView,
  NotificationRecord,
  SupportedLocale,
  TopicUpdateView,
  TopicView,
  WatchConfig,
  WatchRecord
} from "@akyuu/shared-types";
import {
  db,
  digest,
  digestSection,
  feedback,
  outboundNotification,
  preferenceProfile,
  recommendedItem,
  topic,
  topicAlias,
  topicEvidence,
  topicRule,
  topicUpdate,
  trendDiff,
  trendSnapshot,
  trendSnapshotItem,
  watchTarget
} from "@akyuu/infra-db";
import { safeJsonParse } from "@akyuu/shared-utils";

export async function listWatchViews(workspaceId: string): Promise<WatchRecord[]> {
  const rows = await db
    .select()
    .from(watchTarget)
    .where(eq(watchTarget.workspaceId, workspaceId))
    .orderBy(desc(watchTarget.priority), desc(watchTarget.createdAt));

  return rows
    .filter((row) => row.deletedAt === null)
    .map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type as WatchRecord["type"],
      name: row.name,
      status: row.status as WatchRecord["status"],
      priority: row.priority,
      config: row.config as WatchConfig,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
}

export async function loadDigestViewById(digestId: string, locale: SupportedLocale = "en-US"): Promise<DigestView | null> {
  const [digestRow] = await db.select().from(digest).where(eq(digest.id, digestId)).limit(1);

  if (!digestRow) {
    return null;
  }

  const [sectionRows, recommendedRows] = await Promise.all([
    db.select().from(digestSection).where(eq(digestSection.digestId, digestId)).orderBy(digestSection.rank),
    db.select().from(recommendedItem).where(eq(recommendedItem.digestId, digestId)).orderBy(recommendedItem.rank)
  ]);

  const summaryStruct = digestRow.summaryStruct as Record<string, unknown>;
  const messages = getMessages(locale);

  return {
    id: digestRow.id,
    digestType: digestRow.digestType as DigestView["digestType"],
    title: digestRow.title ?? messages.common.digest,
    summary: String(summaryStruct.summary ?? ""),
    renderedMarkdown: digestRow.renderedMarkdown,
    windowStart: digestRow.windowStart.toISOString(),
    windowEnd: digestRow.windowEnd.toISOString(),
    createdAt: digestRow.createdAt.toISOString(),
    sections: sectionRows.map((row) => {
      const sectionSummary = row.summaryStruct as Record<string, unknown>;
      return {
        key: row.sectionType,
        title: row.title,
        bullets: safeJsonParse<string[]>(
          JSON.stringify(sectionSummary.bullets ?? []),
          []
        ),
        markdown: row.renderedMarkdown
      };
    }),
    recommendedItems: recommendedRows.map((row) => {
      const reasonStruct = row.reasonStruct as Record<string, unknown>;
      return {
        id: row.id,
        itemType: row.itemType as DigestView["recommendedItems"][number]["itemType"],
        title: String(
          reasonStruct.title ??
            messages.enums.itemType[
              row.itemType as keyof typeof messages.enums.itemType
            ] ??
            row.itemType
        ),
        href: typeof reasonStruct.href === "string" ? reasonStruct.href : null,
        reason: String(reasonStruct.reason ?? ""),
        score: Number(row.score)
      };
    })
  };
}

export async function listDigestViews(
  workspaceId: string,
  options?: {
    digestType?: DigestView["digestType"];
    q?: string;
  },
  locale: SupportedLocale = "en-US"
): Promise<DigestView[]> {
  const rows = await db
    .select()
    .from(digest)
    .where(eq(digest.workspaceId, workspaceId))
    .orderBy(desc(digest.windowStart))
    .limit(50);

  const digests = await Promise.all(rows.map((row) => loadDigestViewById(row.id, locale)));

  return digests
    .filter((item): item is DigestView => item !== null)
    .filter((item) => {
      if (options?.digestType && item.digestType !== options.digestType) {
        return false;
      }

      if (!options?.q) {
        return true;
      }

      const query = options.q.trim().toLowerCase();
      const haystack = [item.title, item.summary, item.renderedMarkdown].join("\n").toLowerCase();
      return haystack.includes(query);
    });
}

function mapTopicUpdateView(topicName: string, row: typeof topicUpdate.$inferSelect): TopicUpdateView {
  const summaryStruct = row.summaryStruct as Record<string, unknown>;
  return {
    id: row.id,
    topicId: row.topicId,
    topicName,
    summary: String(summaryStruct.summary ?? ""),
    highlights: safeJsonParse<string[]>(JSON.stringify(summaryStruct.highlights ?? []), []),
    evidenceCount: Number(summaryStruct.evidenceCount ?? 0),
    windowStart: row.windowStart.toISOString(),
    windowEnd: row.windowEnd.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

async function buildTopicView(row: typeof topic.$inferSelect): Promise<TopicView> {
  const [aliasRows, ruleRows, evidenceRows, allUpdateRows, recentUpdateRows] = await Promise.all([
    db.select().from(topicAlias).where(eq(topicAlias.topicId, row.id)),
    db.select().from(topicRule).where(eq(topicRule.topicId, row.id)),
    db.select().from(topicEvidence).where(eq(topicEvidence.topicId, row.id)),
    db.select().from(topicUpdate).where(eq(topicUpdate.topicId, row.id)),
    db.select().from(topicUpdate).where(eq(topicUpdate.topicId, row.id)).orderBy(desc(topicUpdate.windowEnd)).limit(3)
  ]);

  const recentUpdates = recentUpdateRows.map((updateRow) => mapTopicUpdateView(row.name, updateRow));
  const metadata = row.metadata as Record<string, unknown>;

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? null,
    aliases: aliasRows.map((item) => item.alias),
    repoBindings: ruleRows.filter((item) => item.ruleType === "repo_binding").map((item) => item.value),
    keywords: ruleRows.filter((item) => item.ruleType === "keyword").map((item) => item.value),
    watchTargetId: typeof metadata.watchTargetId === "string" ? metadata.watchTargetId : null,
    evidenceCount: evidenceRows.length,
    updateCount: allUpdateRows.length,
    latestSummary: recentUpdates[0]?.summary ?? null,
    latestWindowEnd: recentUpdates[0]?.windowEnd ?? null,
    recentUpdates
  };
}

export async function listTopicViews(workspaceId: string): Promise<TopicView[]> {
  const rows = await db
    .select()
    .from(topic)
    .where(and(eq(topic.status, "active"), or(eq(topic.workspaceId, workspaceId), isNull(topic.workspaceId))))
    .orderBy(desc(topic.updatedAt));

  return Promise.all(rows.map((row) => buildTopicView(row)));
}

export async function loadTopicViewById(topicId: string, workspaceId?: string): Promise<TopicView | null> {
  const filters = workspaceId
    ? and(eq(topic.id, topicId), or(eq(topic.workspaceId, workspaceId), isNull(topic.workspaceId)))
    : eq(topic.id, topicId);
  const [row] = await db.select().from(topic).where(filters).limit(1);

  if (!row) {
    return null;
  }

  return buildTopicView(row);
}

export async function listTrendDiffViews(): Promise<import("@akyuu/shared-types").TrendDiffView[]> {
  const rows = await db.select().from(trendDiff).orderBy(desc(trendDiff.snapshotDate), desc(trendDiff.createdAt)).limit(10);

  return Promise.all(
    rows.map(async (row) => {
      const [snapshotRow] = await db
        .select()
        .from(trendSnapshot)
        .where(
          and(
            eq(trendSnapshot.source, row.source),
            eq(trendSnapshot.scope, row.scope),
            eq(trendSnapshot.snapshotDate, row.snapshotDate)
          )
        )
        .limit(1);

      const itemRows = snapshotRow
        ? await db
            .select()
            .from(trendSnapshotItem)
            .where(eq(trendSnapshotItem.trendSnapshotId, snapshotRow.id))
            .orderBy(trendSnapshotItem.rank)
            .limit(10)
        : [];

      const diffStruct = row.diffStruct as Record<string, unknown>;
      return {
        id: row.id,
        source: row.source,
        scope: row.scope,
        snapshotDate: String(row.snapshotDate),
        comparedToDate: String(row.comparedToDate),
        highlights: safeJsonParse<string[]>(JSON.stringify((row.summaryStruct as Record<string, unknown>).highlights ?? []), []),
        newEntries: safeJsonParse<string[]>(JSON.stringify(diffStruct.newEntries ?? []), []),
        leftEntries: safeJsonParse<string[]>(JSON.stringify(diffStruct.leftEntries ?? []), []),
        movedUp: safeJsonParse<Array<{ repoFullName: string; from: number; to: number }>>(
          JSON.stringify(diffStruct.movedUp ?? []),
          []
        ),
        movedDown: safeJsonParse<Array<{ repoFullName: string; from: number; to: number }>>(
          JSON.stringify(diffStruct.movedDown ?? []),
          []
        ),
        items: itemRows.map((item) => ({
          rank: item.rank,
          repoFullName: item.repoFullName,
          description: item.description,
          language: item.language,
          starsToday: item.metricPrimary ? Number(item.metricPrimary) : null
        })),
        createdAt: row.createdAt.toISOString()
      };
    })
  );
}

export async function listFeedbackViews(workspaceId: string): Promise<import("@akyuu/shared-types").FeedbackRecord[]> {
  const rows = await db
    .select()
    .from(feedback)
    .where(eq(feedback.workspaceId, workspaceId))
    .orderBy(desc(feedback.createdAt))
    .limit(20);

  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    targetType: row.targetType as import("@akyuu/shared-types").FeedbackRecord["targetType"],
    targetId: row.targetId,
    feedbackType: row.feedbackType as import("@akyuu/shared-types").FeedbackRecord["feedbackType"],
    value: row.value ? Number(row.value) : null,
    metadata: row.metadata as Record<string, unknown>,
    createdAt: row.createdAt.toISOString()
  }));
}

export async function listNotificationViews(workspaceId: string): Promise<NotificationRecord[]> {
  const rows = await db
    .select()
    .from(outboundNotification)
    .where(eq(outboundNotification.workspaceId, workspaceId))
    .orderBy(desc(outboundNotification.createdAt))
    .limit(20);

  return Promise.all(
    rows.map(async (row) => {
      const [digestRow] =
        row.contentRefType === "digest"
          ? await db.select().from(digest).where(eq(digest.id, row.contentRefId)).limit(1)
          : [];

      return {
        id: row.id,
        workspaceId: row.workspaceId,
        channel: row.channel as NotificationRecord["channel"],
        targetAddress: row.targetAddress,
        contentRefType: row.contentRefType as NotificationRecord["contentRefType"],
        contentRefId: row.contentRefId,
        status: row.status as NotificationRecord["status"],
        attemptCount: row.attemptCount,
        lastError: row.lastError,
        createdAt: row.createdAt.toISOString(),
        sentAt: row.sentAt?.toISOString() ?? null,
        contentTitle: digestRow?.title ?? null
      };
    })
  );
}

export async function loadPreferenceProfileView(
  workspaceId: string
): Promise<import("@akyuu/shared-types").PreferenceProfileView | null> {
  const [row] = await db
    .select()
    .from(preferenceProfile)
    .where(and(eq(preferenceProfile.workspaceId, workspaceId), eq(preferenceProfile.subjectType, "workspace")))
    .orderBy(desc(preferenceProfile.updatedAt))
    .limit(1);

  if (!row) {
    return null;
  }

  const profileJson = row.profileJson as Record<string, unknown>;

  return {
    workspaceId: row.workspaceId,
    subjectType: row.subjectType as import("@akyuu/shared-types").PreferenceProfileView["subjectType"],
    subjectId: row.subjectId,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    profile: {
      feedbackCount: Number(profileJson.feedbackCount ?? 0),
      itemTypeWeights: safeJsonParse<Record<string, number>>(JSON.stringify(profileJson.itemTypeWeights ?? {}), {}),
      repoWeights: safeJsonParse<Record<string, number>>(JSON.stringify(profileJson.repoWeights ?? {}), {})
    }
  };
}
