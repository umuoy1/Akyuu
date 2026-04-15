import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const workspace = pgTable(
  "workspace",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    planTier: text("plan_tier").notNull().default("free"),
    timezone: text("timezone").notNull().default("UTC"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("workspace_slug_unique").on(table.slug)]
);

export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("app_user_email_unique").on(table.email)]
);

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("owner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("workspace_member_unique").on(table.workspaceId, table.userId)]
);

export const watchTarget = pgTable(
  "watch_target",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("active"),
    priority: integer("priority").notNull().default(3),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => appUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => [index("watch_target_workspace_type_status_idx").on(table.workspaceId, table.type, table.status)]
);

export const watchRule = pgTable(
  "watch_rule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchTargetId: uuid("watch_target_id")
      .notNull()
      .references(() => watchTarget.id, { onDelete: "cascade" }),
    ruleType: text("rule_type").notNull(),
    operator: text("operator").notNull(),
    value: text("value").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("watch_rule_watch_target_type_idx").on(table.watchTargetId, table.ruleType)]
);

export const watchSchedule = pgTable(
  "watch_schedule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    watchTargetId: uuid("watch_target_id")
      .notNull()
      .references(() => watchTarget.id, { onDelete: "cascade" }),
    cadence: text("cadence").notNull().default("daily"),
    cronExpr: text("cron_expr").notNull().default("0 9 * * *"),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true })
  },
  (table) => [index("watch_schedule_enabled_next_run_idx").on(table.enabled, table.nextRunAt)]
);

export const sourceCursor = pgTable(
  "source_cursor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceKey: text("source_key").notNull(),
    etag: text("etag"),
    lastSeenExternalId: text("last_seen_external_id"),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    nextPollAfter: timestamp("next_poll_after", { withTimezone: true }),
    state: jsonb("state").$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("source_cursor_source_unique").on(table.sourceType, table.sourceKey)]
);

export const rawSignal = pgTable(
  "raw_signal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceKey: text("source_key").notNull(),
    externalId: text("external_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    payloadHash: text("payload_hash").notNull(),
    ingestJobId: uuid("ingest_job_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("raw_signal_source_unique").on(table.sourceType, table.sourceKey, table.externalId),
    index("raw_signal_captured_idx").on(table.capturedAt),
    index("raw_signal_occurred_idx").on(table.occurredAt)
  ]
);

export const rawSnapshot = pgTable(
  "raw_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceKey: text("source_key").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    contentFormat: text("content_format").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [uniqueIndex("raw_snapshot_source_unique").on(table.sourceType, table.sourceKey, table.snapshotDate)]
);

export const canonicalEntity = pgTable(
  "canonical_entity",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entityType: text("entity_type").notNull(),
    externalSource: text("external_source").notNull(),
    externalKey: text("external_key").notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("canonical_entity_external_unique").on(table.entityType, table.externalSource, table.externalKey),
    index("canonical_entity_type_name_idx").on(table.entityType, table.normalizedName)
  ]
);

export const canonicalEvent = pgTable(
  "canonical_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    sourceSignalId: uuid("source_signal_id").references(() => rawSignal.id, { onDelete: "set null" }),
    sourceSnapshotId: uuid("source_snapshot_id").references(() => rawSnapshot.id, { onDelete: "set null" }),
    subjectEntityId: uuid("subject_entity_id")
      .notNull()
      .references(() => canonicalEntity.id, { onDelete: "cascade" }),
    actorEntityId: uuid("actor_entity_id").references(() => canonicalEntity.id, { onDelete: "set null" }),
    repoEntityId: uuid("repo_entity_id").references(() => canonicalEntity.id, { onDelete: "set null" }),
    confidence: numeric("confidence", { precision: 4, scale: 2 }).notNull().default("1"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("canonical_event_dedupe_unique").on(table.dedupeKey),
    index("canonical_event_type_occurred_idx").on(table.eventType, table.occurredAt),
    index("canonical_event_repo_occurred_idx").on(table.repoEntityId, table.occurredAt),
    index("canonical_event_subject_occurred_idx").on(table.subjectEntityId, table.occurredAt)
  ]
);

export const eventEntityRelation = pgTable(
  "event_entity_relation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    canonicalEventId: uuid("canonical_event_id")
      .notNull()
      .references(() => canonicalEvent.id, { onDelete: "cascade" }),
    entityId: uuid("entity_id")
      .notNull()
      .references(() => canonicalEntity.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).notNull().default("1"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [
    index("event_entity_relation_event_idx").on(table.canonicalEventId),
    index("event_entity_relation_entity_type_idx").on(table.entityId, table.relationType)
  ]
);

export const topic = pgTable(
  "topic",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("topic_workspace_slug_unique").on(table.workspaceId, table.slug)]
);

export const topicAlias = pgTable(
  "topic_alias",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    aliasType: text("alias_type").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).notNull().default("1")
  },
  (table) => [index("topic_alias_type_alias_idx").on(table.aliasType, table.alias)]
);

export const topicRule = pgTable(
  "topic_rule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    ruleType: text("rule_type").notNull(),
    operator: text("operator").notNull(),
    value: text("value").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }).notNull().default("1"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("topic_rule_topic_type_enabled_idx").on(table.topicId, table.ruleType, table.enabled)]
);

export const topicEvidence = pgTable(
  "topic_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    canonicalEventId: uuid("canonical_event_id")
      .notNull()
      .references(() => canonicalEvent.id, { onDelete: "cascade" }),
    evidenceType: text("evidence_type").notNull(),
    score: numeric("score", { precision: 10, scale: 2 }).notNull().default("0"),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("topic_evidence_unique").on(table.topicId, table.canonicalEventId, table.evidenceType),
    index("topic_evidence_topic_score_idx").on(table.topicId, table.score)
  ]
);

export const topicUpdate = pgTable(
  "topic_update",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    updateType: text("update_type").notNull(),
    importanceScore: numeric("importance_score", { precision: 10, scale: 2 }).notNull().default("0"),
    summaryStruct: jsonb("summary_struct").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("topic_update_window_unique").on(table.topicId, table.windowStart, table.windowEnd, table.updateType),
    index("topic_update_topic_window_idx").on(table.topicId, table.windowEnd),
    index("topic_update_type_score_idx").on(table.updateType, table.importanceScore)
  ]
);

export const trendSnapshot = pgTable(
  "trend_snapshot",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    scope: text("scope").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    rawSnapshotId: uuid("raw_snapshot_id").references(() => rawSnapshot.id, { onDelete: "set null" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [uniqueIndex("trend_snapshot_unique").on(table.source, table.scope, table.snapshotDate)]
);

export const trendSnapshotItem = pgTable(
  "trend_snapshot_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    trendSnapshotId: uuid("trend_snapshot_id")
      .notNull()
      .references(() => trendSnapshot.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    repoFullName: text("repo_full_name").notNull(),
    language: text("language"),
    description: text("description"),
    metricPrimary: numeric("metric_primary", { precision: 14, scale: 2 }),
    metricSecondary: numeric("metric_secondary", { precision: 14, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({})
  },
  (table) => [
    uniqueIndex("trend_snapshot_item_unique").on(table.trendSnapshotId, table.repoFullName),
    index("trend_snapshot_item_repo_idx").on(table.repoFullName),
    index("trend_snapshot_item_rank_idx").on(table.trendSnapshotId, table.rank)
  ]
);

export const trendDiff = pgTable(
  "trend_diff",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: text("source").notNull(),
    scope: text("scope").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    comparedToDate: date("compared_to_date").notNull(),
    diffStruct: jsonb("diff_struct").$type<Record<string, unknown>>().notNull().default({}),
    summaryStruct: jsonb("summary_struct").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("trend_diff_unique").on(table.source, table.scope, table.snapshotDate, table.comparedToDate)]
);

export const eventScore = pgTable(
  "event_score",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    workspaceId: uuid("workspace_id").references(() => workspace.id, { onDelete: "cascade" }),
    scoreType: text("score_type").notNull(),
    score: numeric("score", { precision: 10, scale: 2 }).notNull(),
    featureBreakdown: jsonb("feature_breakdown").$type<Record<string, unknown>>().notNull().default({}),
    modelVersion: text("model_version").notNull().default("v1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("event_score_unique").on(
      table.targetType,
      table.targetId,
      table.workspaceId,
      table.scoreType,
      table.modelVersion
    ),
    index("event_score_workspace_type_score_idx").on(table.workspaceId, table.scoreType, table.score)
  ]
);

export const digest = pgTable(
  "digest",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    digestType: text("digest_type").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("building"),
    title: text("title"),
    summaryStruct: jsonb("summary_struct").$type<Record<string, unknown>>().notNull().default({}),
    renderedMarkdown: text("rendered_markdown").notNull().default(""),
    llmVersion: text("llm_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("digest_workspace_window_unique").on(table.workspaceId, table.digestType, table.windowStart, table.windowEnd),
    index("digest_status_created_idx").on(table.status, table.createdAt)
  ]
);

export const digestSection = pgTable(
  "digest_section",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    digestId: uuid("digest_id")
      .notNull()
      .references(() => digest.id, { onDelete: "cascade" }),
    sectionType: text("section_type").notNull(),
    title: text("title").notNull(),
    rank: integer("rank").notNull(),
    summaryStruct: jsonb("summary_struct").$type<Record<string, unknown>>().notNull().default({}),
    renderedMarkdown: text("rendered_markdown").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("digest_section_digest_rank_idx").on(table.digestId, table.rank)]
);

export const recommendedItem = pgTable(
  "recommended_item",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    digestId: uuid("digest_id").references(() => digest.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    itemEntityId: uuid("item_entity_id").references(() => canonicalEntity.id, { onDelete: "set null" }),
    sourceTargetType: text("source_target_type").notNull(),
    sourceTargetId: uuid("source_target_id").notNull(),
    rank: integer("rank").notNull(),
    score: numeric("score", { precision: 10, scale: 2 }).notNull(),
    reasonStruct: jsonb("reason_struct").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("recommended_item_digest_rank_idx").on(table.digestId, table.rank),
    index("recommended_item_workspace_created_idx").on(table.workspaceId, table.createdAt)
  ]
);

export const questionSession = pgTable(
  "question_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    anchorType: text("anchor_type").notNull(),
    anchorId: uuid("anchor_id"),
    question: text("question").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("question_session_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("question_session_user_created_idx").on(table.userId, table.createdAt)
  ]
);

export const answerRecord = pgTable(
  "answer_record",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionSessionId: uuid("question_session_id")
      .notNull()
      .references(() => questionSession.id, { onDelete: "cascade" }),
    answerMarkdown: text("answer_markdown").notNull(),
    retrievalContext: jsonb("retrieval_context").$type<Record<string, unknown>>().notNull().default({}),
    llmVersion: text("llm_version").notNull().default("deterministic-v1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("answer_record_question_unique").on(table.questionSessionId)]
);

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    feedbackType: text("feedback_type").notNull(),
    value: numeric("value", { precision: 10, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("feedback_user_created_idx").on(table.userId, table.createdAt),
    index("feedback_target_idx").on(table.targetType, table.targetId)
  ]
);

export const outboundNotification = pgTable(
  "outbound_notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    targetAddress: text("target_address").notNull(),
    contentRefType: text("content_ref_type").notNull(),
    contentRefId: uuid("content_ref_id").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("outbound_notification_target_unique").on(
      table.channel,
      table.targetAddress,
      table.contentRefType,
      table.contentRefId
    ),
    index("outbound_notification_status_created_idx").on(table.status, table.createdAt),
    index("outbound_notification_channel_sent_idx").on(table.channel, table.sentAt)
  ]
);

export const preferenceProfile = pgTable(
  "preference_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    profileJson: jsonb("profile_json").$type<Record<string, unknown>>().notNull().default({}),
    version: text("version").notNull().default("v1"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("preference_profile_subject_unique").on(table.workspaceId, table.subjectType, table.subjectId),
    index("preference_profile_updated_idx").on(table.workspaceId, table.updatedAt)
  ]
);

export const jobRun = pgTable(
  "job_run",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    queueName: text("queue_name").notNull(),
    jobName: text("job_name").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").notNull().default("queued"),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>().notNull().default({}),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>().notNull().default({}),
    errorText: text("error_text"),
    attemptCount: integer("attempt_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("job_run_queue_idempotency_unique").on(table.queueName, table.idempotencyKey),
    index("job_run_status_created_idx").on(table.status, table.createdAt),
    index("job_run_name_created_idx").on(table.jobName, table.createdAt)
  ]
);

export const appMigration = pgTable(
  "app_migration",
  {
    name: text("name").notNull(),
    appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.name] })]
);
