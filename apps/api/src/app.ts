import { z } from "zod";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import { and, eq } from "drizzle-orm";

import {
  askRequestSchema,
  createFeedbackRequestSchema,
  createWatchRequestSchema,
  deleteWatchParamsSchema,
  runPipelineRequestSchema,
  topicParamsSchema,
  type TopicWatchConfig,
  updateWorkspaceSettingsRequestSchema
} from "@akyuu/shared-types";
import { buildTopicArtifacts, buildTopicSlug } from "@akyuu/domain-topic";
import { normalizeCreateWatchInput } from "@akyuu/domain-watch";
import { buildPreferenceProfile } from "@akyuu/domain-feedback";
import { getMessages } from "@akyuu/shared-i18n";
import {
  db,
  feedback,
  preferenceProfile,
  topic,
  topicAlias,
  topicRule,
  watchSchedule,
  watchTarget,
  workspace
} from "@akyuu/infra-db";
import { createLogger } from "@akyuu/infra-observability";
import { askQuestion, listAskSessions } from "./lib/ask.js";

import { getRequestContext } from "./lib/context.js";
import {
  listDigestViews,
  listFeedbackViews,
  listNotificationViews,
  loadPreferenceProfileView,
  listTrendDiffViews,
  listTopicViews,
  listWatchViews,
  loadDigestViewById,
  loadTopicViewById
} from "./lib/views.js";
import { runWorkspacePipeline } from "./pipeline.js";

export async function createApp() {
  const app = Fastify({
    loggerInstance: createLogger("api")
  });

  await app.register(cors, {
    origin: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"]
  });
  await app.register(helmet);
  await app.register(sensible);

  app.setErrorHandler(async (error, request, reply) => {
    const context = request.url === "/health" ? null : await getRequestContext().catch(() => null);
    const messages = getMessages(context?.locale ?? "en-US");

    if (error instanceof z.ZodError) {
      return reply.status(400).send({
        message: messages.api.invalidRequest
      });
    }

    const appError = error as {
      statusCode?: number;
      message?: string;
    };
    const statusCode = typeof appError.statusCode === "number" ? appError.statusCode : 500;

    if (statusCode < 500) {
      return reply.status(statusCode).send({
        message: appError.message || messages.api.invalidRequest
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      message: messages.api.internalServerError
    });
  });

  app.get("/health", async () => ({
    status: "ok"
  }));

  app.get("/api/v1/watches", async () => {
    const context = await getRequestContext();
    return {
      watches: await listWatchViews(context.workspaceId)
    };
  });

  app.get("/api/v1/settings", async () => {
    const context = await getRequestContext();
    return {
      locale: context.locale,
      timezone: context.timezone
    };
  });

  app.patch("/api/v1/settings", async (request) => {
    const context = await getRequestContext();
    const body = updateWorkspaceSettingsRequestSchema.parse(request.body ?? {});

    await db
      .update(workspace)
      .set({
        locale: body.locale,
        updatedAt: new Date()
      })
      .where(eq(workspace.id, context.workspaceId));

    return {
      locale: body.locale,
      timezone: context.timezone
    };
  });

  app.post("/api/v1/watches", async (request, reply) => {
    const context = await getRequestContext();
    const messages = getMessages(context.locale);
    const parsed = normalizeCreateWatchInput(createWatchRequestSchema.parse(request.body));

    if (parsed.type === "topic") {
      const topicSlug = buildTopicSlug(parsed.name);
      const [existingTopic] = await db
        .select()
        .from(topic)
        .where(and(eq(topic.workspaceId, context.workspaceId), eq(topic.slug, topicSlug)))
        .limit(1);

      if (existingTopic) {
        return reply.conflict(messages.api.topicWatchExists);
      }
    }

    const watchRow = await db.transaction(async (tx) => {
      const [createdWatch] = await tx
        .insert(watchTarget)
        .values({
          workspaceId: context.workspaceId,
          type: parsed.type,
          name: parsed.name,
          priority: parsed.priority,
          config: parsed.config,
          createdBy: context.userId
        })
        .returning();

      if (!createdWatch) {
        throw new Error(messages.api.watchCreateFailed);
      }

      if (parsed.type === "topic") {
        const topicSlug = buildTopicSlug(parsed.name);
        const [topicRow] = await tx
          .insert(topic)
          .values({
            workspaceId: context.workspaceId,
            name: parsed.name,
            slug: topicSlug,
            description: messages.topics.watchDescription(parsed.name),
            metadata: {
              watchTargetId: createdWatch.id
            }
          })
          .returning();

        if (!topicRow) {
          throw new Error(messages.api.topicCreateFailed);
        }

        const artifacts = buildTopicArtifacts({
          topicId: topicRow.id,
          config: parsed.config as TopicWatchConfig
        });

        if (artifacts.aliases.length > 0) {
          await tx.insert(topicAlias).values(
            artifacts.aliases.map((item) => ({
              topicId: item.topicId,
              alias: item.alias,
              aliasType: item.aliasType,
              weight: String(item.weight)
            }))
          );
        }

        if (artifacts.rules.length > 0) {
          await tx.insert(topicRule).values(
            artifacts.rules.map((item) => ({
              topicId: item.topicId,
              ruleType: item.ruleType,
              operator: item.operator,
              value: item.value,
              weight: String(item.weight)
            }))
          );
        }

        await tx
          .update(watchTarget)
          .set({
            config: {
              ...parsed.config,
              topicId: topicRow.id,
              topicSlug
            },
            updatedAt: new Date()
          })
          .where(eq(watchTarget.id, createdWatch.id));
      }

      await tx.insert(watchSchedule).values({
        watchTargetId: createdWatch.id,
        cadence: "daily",
        cronExpr: "0 9 * * *",
        enabled: true
      });

      return createdWatch;
    });

    if (!watchRow) {
      throw new Error(messages.api.watchCreateFailed);
    }

    reply.code(201);
    return {
      watch: {
        id: watchRow.id
      }
    };
  });

  app.delete("/api/v1/watches/:watchId", async (request) => {
    const context = await getRequestContext();
    const params = deleteWatchParamsSchema.parse(request.params);
    const [watchRow] = await db
      .select()
      .from(watchTarget)
      .where(and(eq(watchTarget.workspaceId, context.workspaceId), eq(watchTarget.id, params.watchId)))
      .limit(1);

    await db
      .update(watchTarget)
      .set({
        status: "archived",
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(watchTarget.workspaceId, context.workspaceId), eq(watchTarget.id, params.watchId)));

    await db.update(watchSchedule).set({ enabled: false }).where(eq(watchSchedule.watchTargetId, params.watchId));

    const topicId = z
      .object({
        topicId: z.string().uuid().optional()
      })
      .safeParse(watchRow?.config ?? {}).data?.topicId;

    if (watchRow?.type === "topic" && topicId) {
      await db
        .update(topic)
        .set({
          status: "archived",
          updatedAt: new Date()
        })
        .where(eq(topic.id, topicId));
    }

    return {
      ok: true
    };
  });

  app.get("/api/v1/digests", async (request) => {
    const context = await getRequestContext();
    const parsedQuery = z
      .object({
        digestType: z.enum(["daily", "weekly", "monthly"]).optional(),
        q: z.string().trim().optional()
      })
      .parse(request.query ?? {});
    const query: {
      digestType?: "daily" | "weekly" | "monthly";
      q?: string;
    } = {};

    if (parsedQuery.digestType) {
      query.digestType = parsedQuery.digestType;
    }

    if (parsedQuery.q) {
      query.q = parsedQuery.q;
    }

    return {
      digests: await listDigestViews(context.workspaceId, query, context.locale)
    };
  });

  app.get("/api/v1/digests/latest", async (_request, reply) => {
    const context = await getRequestContext();
    const messages = getMessages(context.locale);
    const digestType = z
      .object({
        digestType: z.enum(["daily", "weekly", "monthly"]).default("daily")
      })
      .parse(_request.query ?? {}).digestType;
    const digests = await listDigestViews(context.workspaceId, undefined, context.locale);
    const latest = digests.find((digest) => digest.digestType === digestType);

    if (!latest) {
      return reply.notFound(messages.api.noDigestFound);
    }

    return latest;
  });

  app.get("/api/v1/digests/:digestId", async (request, reply) => {
    const context = await getRequestContext();
    const digestId = (request.params as { digestId: string }).digestId;
    const digestView = await loadDigestViewById(digestId, context.locale);

    if (!digestView) {
      return reply.notFound(getMessages(context.locale).api.digestNotFound);
    }

    return digestView;
  });

  app.get("/api/v1/topics", async () => {
    const context = await getRequestContext();
    return {
      topics: await listTopicViews(context.workspaceId)
    };
  });

  app.get("/api/v1/topics/:topicId", async (request, reply) => {
    const context = await getRequestContext();
    const params = topicParamsSchema.parse(request.params);
    const topicView = await loadTopicViewById(params.topicId, context.workspaceId);

    if (!topicView) {
      return reply.notFound(getMessages(context.locale).api.topicNotFound);
    }

    return topicView;
  });

  app.get("/api/v1/trends", async () => ({
    trends: await listTrendDiffViews()
  }));

  app.get("/api/v1/ask/sessions", async () => {
    const context = await getRequestContext();
    return {
      sessions: await listAskSessions(context.workspaceId)
    };
  });

  app.post("/api/v1/ask", async (request, reply) => {
    const context = await getRequestContext();
    const body = askRequestSchema.parse(request.body);
    const session = await askQuestion(context, body);

    reply.code(201);
    return session;
  });

  app.get("/api/v1/feedback", async () => {
    const context = await getRequestContext();
    return {
      feedback: await listFeedbackViews(context.workspaceId)
    };
  });

  app.get("/api/v1/notifications", async () => {
    const context = await getRequestContext();
    return {
      notifications: await listNotificationViews(context.workspaceId)
    };
  });

  app.get("/api/v1/preferences", async () => {
    const context = await getRequestContext();
    return {
      profile: await loadPreferenceProfileView(context.workspaceId)
    };
  });

  app.post("/api/v1/feedback", async (request, reply) => {
    const context = await getRequestContext();
    const messages = getMessages(context.locale);
    const body = createFeedbackRequestSchema.parse(request.body);

    const [feedbackRow] = await db
      .insert(feedback)
      .values({
        workspaceId: context.workspaceId,
        userId: context.userId,
        targetType: body.targetType,
        targetId: body.targetId,
        feedbackType: body.feedbackType,
        value: body.value !== undefined && body.value !== null ? String(body.value) : null,
        metadata: body.metadata ?? {}
      })
      .returning();

    if (!feedbackRow) {
      throw new Error(messages.api.feedbackPersistFailed);
    }

    const feedbackRows = await db.select().from(feedback).where(eq(feedback.workspaceId, context.workspaceId));
    const profile = buildPreferenceProfile({
      workspaceId: context.workspaceId,
      subjectId: context.workspaceId,
      updatedAt: new Date().toISOString(),
      feedbackSignals: feedbackRows.map((row) => ({
        feedbackType: row.feedbackType as import("@akyuu/shared-types").FeedbackType,
        metadata: row.metadata as Record<string, unknown>
      }))
    });

    await db
      .insert(preferenceProfile)
      .values({
        workspaceId: context.workspaceId,
        subjectType: "workspace",
        subjectId: context.workspaceId,
        profileJson: profile.profile,
        version: profile.version,
        updatedAt: new Date(profile.updatedAt)
      })
      .onConflictDoUpdate({
        target: [
          preferenceProfile.workspaceId,
          preferenceProfile.subjectType,
          preferenceProfile.subjectId
        ],
        set: {
          profileJson: profile.profile,
          version: profile.version,
          updatedAt: new Date(profile.updatedAt)
        }
      });

    reply.code(201);
    return {
      id: feedbackRow.id,
      workspaceId: feedbackRow.workspaceId,
      userId: feedbackRow.userId,
      targetType: feedbackRow.targetType,
      targetId: feedbackRow.targetId,
      feedbackType: feedbackRow.feedbackType,
      value: feedbackRow.value ? Number(feedbackRow.value) : null,
      metadata: feedbackRow.metadata,
      createdAt: feedbackRow.createdAt.toISOString()
    };
  });

  app.post("/api/v1/pipeline/run", async (request, reply) => {
    const context = await getRequestContext();
    const body = runPipelineRequestSchema.parse(request.body ?? {});
    const messages = getMessages(context.locale);
    let digestId: string;

    try {
      digestId = await runWorkspacePipeline(
        body.date
          ? {
              workspaceId: context.workspaceId,
              timezone: context.timezone,
              locale: context.locale,
              date: body.date,
              digestType: body.digestType
            }
          : {
              workspaceId: context.workspaceId,
              timezone: context.timezone,
              locale: context.locale,
              digestType: body.digestType
            }
      );
    } catch (error) {
      if (error instanceof Error && error.message === messages.api.noActiveWatches) {
        return reply.badRequest(error.message);
      }

      throw error;
    }

    reply.code(202);
    return {
      digestId
    };
  });

  return app;
}
