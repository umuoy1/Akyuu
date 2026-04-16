import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

import type {
  AskSessionResponse,
  CreateWatchRequest,
  DigestResponse,
  FeedbackResponse,
  ListAskSessionsResponse,
  ListDigestsResponse,
  ListFeedbackResponse,
  ListNotificationsResponse,
  ListTopicsResponse,
  ListWatchesResponse,
  PreferenceProfileResponse,
  TopicResponse
} from "@akyuu/shared-types";

import { createApiIntegrationHarness, type ApiIntegrationHarness } from "./support/harness.js";

process.loadEnvFile?.();

const runLive =
  process.env.RUN_LIVE_API_TESTS === "true" &&
  Boolean(process.env.GITHUB_TOKEN) &&
  Boolean(process.env.OPENAI_API_KEY);
const liveModel = process.env.OPENAI_MODEL ?? "glm-5";

type CreatedWatchIds = {
  nodeWatchId: string;
  nextWatchId: string;
  topicWatchId: string;
};

async function jsonRequest<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
  expectedStatus = 200
): Promise<T> {
  const headers =
    init?.body === undefined
      ? { ...(init?.headers ?? {}) }
      : {
          "content-type": "application/json",
          ...(init?.headers ?? {})
        };
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers
  });
  const text = await response.text();

  if (response.status !== expectedStatus) {
    throw new Error(`Unexpected status ${response.status} for ${path}\n${text}`);
  }

  return JSON.parse(text) as T;
}

async function waitFor(condition: () => Promise<boolean>, label: string, timeoutMs = 120_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${label}`);
}

async function loadDigestLlmVersion(dbClient: Client, digestId: string): Promise<string | null> {
  const result = await dbClient.query<{ llm_version: string | null }>(
    "select llm_version from digest where id = $1::uuid limit 1",
    [digestId]
  );

  return result.rows[0]?.llm_version ?? null;
}

describe.skipIf(!runLive)("Live end-to-end pipeline with GitHub + LLM + scheduler", () => {
  let harness: ApiIntegrationHarness;
  let dbClient: Client;
  let watchIds: CreatedWatchIds;
  let createdTopicId = "";
  let latestDailyDigest: DigestResponse;
  let latestMonthlyDigest: DigestResponse;

  beforeAll(async () => {
    harness = await createApiIntegrationHarness({
      mode: "live",
      startScheduler: true
    });

    dbClient = new Client({
      connectionString: harness.databaseUrl
    });
    await dbClient.connect();
  });

  afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }

    if (harness) {
      await harness.stop();
    }
  });

  it("boots API, worker, and scheduler health endpoints in the live environment", async () => {
    expect(harness.schedulerBaseUrl).not.toBeNull();

    const [apiHealth, workerHealth, schedulerHealth] = await Promise.all([
      jsonRequest<{ status: string }>(harness.apiBaseUrl, "/health"),
      jsonRequest<{ status: string }>(harness.workerBaseUrl, "/health"),
      jsonRequest<{ status: string }>(harness.schedulerBaseUrl!, "/health")
    ]);

    expect(apiHealth.status).toBe("ok");
    expect(workerHealth.status).toBe("ok");
    expect(schedulerHealth.status).toBe("ok");
  });

  it("creates live watches and verifies scheduler run-once enqueues work", async () => {
    const nodeWatch: CreateWatchRequest = {
      type: "repo",
      name: "Node.js Live Repo",
      priority: 5,
      config: {
        owner: "nodejs",
        repo: "node",
        pullsLimit: 1,
        issuesLimit: 1
      }
    };
    const nextWatch: CreateWatchRequest = {
      type: "repo",
      name: "Next.js Live Repo",
      priority: 4,
      config: {
        owner: "vercel",
        repo: "next.js",
        pullsLimit: 1,
        issuesLimit: 1
      }
    };
    const topicWatch: CreateWatchRequest = {
      type: "topic",
      name: "Runtime Permissions",
      priority: 4,
      config: {
        aliases: ["runtime permissions"],
        keywords: ["permission", "ffi"],
        repoBindings: ["nodejs/node"]
      }
    };
    const [nodeResult, nextResult, topicResult] = await Promise.all([
      jsonRequest<{ watch: { id: string } }>(
        harness.apiBaseUrl,
        "/api/v1/watches",
        {
          method: "POST",
          body: JSON.stringify(nodeWatch)
        },
        201
      ),
      jsonRequest<{ watch: { id: string } }>(
        harness.apiBaseUrl,
        "/api/v1/watches",
        {
          method: "POST",
          body: JSON.stringify(nextWatch)
        },
        201
      ),
      jsonRequest<{ watch: { id: string } }>(
        harness.apiBaseUrl,
        "/api/v1/watches",
        {
          method: "POST",
          body: JSON.stringify(topicWatch)
        },
        201
      )
    ]);

    watchIds = {
      nodeWatchId: nodeResult.watch.id,
      nextWatchId: nextResult.watch.id,
      topicWatchId: topicResult.watch.id
    };

    const watches = await jsonRequest<ListWatchesResponse>(harness.apiBaseUrl, "/api/v1/watches");
    expect(watches.watches).toHaveLength(3);

    const topics = await jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics");
    const createdTopic = topics.topics.find((topic) => topic.watchTargetId === watchIds.topicWatchId);
    expect(createdTopic).toBeDefined();
    createdTopicId = createdTopic!.id;

    const createdTopicDetail = await jsonRequest<TopicResponse>(
      harness.apiBaseUrl,
      `/api/v1/topics/${createdTopicId}`
    );
    expect(createdTopicDetail.repoBindings).toContain("nodejs/node");
    expect(createdTopicDetail.aliases).toContain("runtime permissions");

    await dbClient.query(
      `
        update watch_schedule
        set next_run_at = now() - interval '1 minute'
        where watch_target_id = any($1::uuid[])
      `,
      [[watchIds.nodeWatchId, watchIds.nextWatchId, watchIds.topicWatchId]]
    );

    const schedulerRun = await jsonRequest<{ queued: number }>(
      harness.schedulerBaseUrl!,
      "/run-once",
      {
        method: "POST"
      }
    );
    expect(schedulerRun.queued).toBe(3);

    await waitFor(async () => {
      const result = await dbClient.query<{ count: string }>(
        `
          select count(*)::text as count
          from watch_schedule
          where watch_target_id = any($1::uuid[])
            and last_run_at is not null
            and next_run_at is not null
        `,
        [[watchIds.nodeWatchId, watchIds.nextWatchId, watchIds.topicWatchId]]
      );

      return Number(result.rows[0]?.count ?? 0) === 3;
    }, "watch schedules to advance");

    await waitFor(async () => {
      const result = await dbClient.query<{ count: string }>(
        `
          select count(*)::text as count
          from job_run
          where input_json->>'trigger' = 'scheduler'
            and queue_name in ('ingest.poll', 'ingest.snapshot')
        `
      );

      return Number(result.rows[0]?.count ?? 0) >= 3;
    }, "scheduler jobs to be observed by worker");
  });

  it(
    "runs daily pipeline over two dates and validates digest, topic, notification, and LLM rendering",
    async () => {
      await jsonRequest<{ digestId: string }>(
        harness.apiBaseUrl,
        "/api/v1/pipeline/run",
        {
          method: "POST",
          body: JSON.stringify({
            digestType: "daily",
            date: harness.dates.yesterday
          })
        },
        202
      );

      const todayRun = await jsonRequest<{ digestId: string }>(
        harness.apiBaseUrl,
        "/api/v1/pipeline/run",
        {
          method: "POST",
          body: JSON.stringify({
            digestType: "daily",
            date: harness.dates.today
          })
        },
        202
      );

      latestDailyDigest = await jsonRequest<DigestResponse>(
        harness.apiBaseUrl,
        "/api/v1/digests/latest?digestType=daily"
      );
      expect(latestDailyDigest.id).toBe(todayRun.digestId);
      expect(latestDailyDigest.digestType).toBe("daily");
      expect(latestDailyDigest.sections.length).toBeGreaterThan(0);
      expect(latestDailyDigest.renderedMarkdown.length).toBeGreaterThan(0);
      expect(await loadDigestLlmVersion(dbClient, latestDailyDigest.id)).toBe(liveModel);

      const dailyDetail = await jsonRequest<DigestResponse>(
        harness.apiBaseUrl,
        `/api/v1/digests/${latestDailyDigest.id}`
      );
      expect(dailyDetail.id).toBe(latestDailyDigest.id);

      const dailyHistory = await jsonRequest<ListDigestsResponse>(
        harness.apiBaseUrl,
        "/api/v1/digests?digestType=daily&q=Daily"
      );
      expect(dailyHistory.digests.some((digest) => digest.id === latestDailyDigest.id)).toBe(true);

      const topics = await jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics");
      const createdTopic = topics.topics.find((topic) => topic.id === createdTopicId);
      expect(createdTopic).toBeDefined();
      expect((createdTopic?.updateCount ?? 0)).toBeGreaterThan(0);
      expect(createdTopic?.latestSummary).not.toBeNull();

      const notifications = await jsonRequest<ListNotificationsResponse>(harness.apiBaseUrl, "/api/v1/notifications");
      expect(notifications.notifications.length).toBeGreaterThan(0);
      expect(notifications.notifications.some((notification) => notification.status === "sent")).toBe(true);
    },
    300_000
  );

  it(
    "runs monthly pipeline, asks follow-up questions, records feedback, updates preferences, and rerenders recommendations",
    async () => {
      const monthlyRun = await jsonRequest<{ digestId: string }>(
        harness.apiBaseUrl,
        "/api/v1/pipeline/run",
        {
          method: "POST",
          body: JSON.stringify({
            digestType: "monthly",
            date: harness.dates.today
          })
        },
        202
      );

      latestMonthlyDigest = await jsonRequest<DigestResponse>(
        harness.apiBaseUrl,
        "/api/v1/digests/latest?digestType=monthly"
      );
      expect(latestMonthlyDigest.id).toBe(monthlyRun.digestId);
      expect(latestMonthlyDigest.digestType).toBe("monthly");
      expect(latestMonthlyDigest.recommendedItems.length).toBeGreaterThan(0);
      expect(await loadDigestLlmVersion(dbClient, latestMonthlyDigest.id)).toBe(liveModel);

      const askSession = await jsonRequest<AskSessionResponse>(
        harness.apiBaseUrl,
        "/api/v1/ask",
        {
          method: "POST",
          body: JSON.stringify({
            question: "这个月最值得先看的仓库变化是什么？",
            anchorType: "digest",
            anchorId: latestMonthlyDigest.id
          })
        },
        201
      );
      expect(askSession.answerMarkdown.length).toBeGreaterThan(0);
      expect(askSession.retrievalContext.digestId).toBe(latestMonthlyDigest.id);
      expect(askSession.llmVersion).toBe(liveModel);

      const askSessions = await jsonRequest<ListAskSessionsResponse>(harness.apiBaseUrl, "/api/v1/ask/sessions");
      expect(askSessions.sessions.some((session) => session.sessionId === askSession.sessionId)).toBe(true);
      expect(askSessions.sessions.find((session) => session.sessionId === askSession.sessionId)?.llmVersion).toBe(liveModel);

      const recommendedItem = latestMonthlyDigest.recommendedItems.find((item) => item.href);
      expect(recommendedItem).toBeDefined();

      const feedbackRecord = await jsonRequest<FeedbackResponse>(
        harness.apiBaseUrl,
        "/api/v1/feedback",
        {
          method: "POST",
          body: JSON.stringify({
            targetType: "recommended_item",
            targetId: recommendedItem!.id,
            feedbackType: "worthwhile",
            metadata: {
              itemType: recommendedItem!.itemType,
              title: recommendedItem!.title,
              href: recommendedItem!.href
            }
          })
        },
        201
      );
      expect(feedbackRecord.feedbackType).toBe("worthwhile");

      const [feedback, preferences] = await Promise.all([
        jsonRequest<ListFeedbackResponse>(harness.apiBaseUrl, "/api/v1/feedback"),
        jsonRequest<PreferenceProfileResponse>(harness.apiBaseUrl, "/api/v1/preferences")
      ]);
      expect(feedback.feedback.length).toBeGreaterThan(0);
      expect(preferences.profile).not.toBeNull();
      expect(preferences.profile?.profile.feedbackCount).toBeGreaterThan(0);
      expect(Object.keys(preferences.profile?.profile.itemTypeWeights ?? {})).toContain(recommendedItem!.itemType);

      await jsonRequest<{ digestId: string }>(
        harness.apiBaseUrl,
        "/api/v1/pipeline/run",
        {
          method: "POST",
          body: JSON.stringify({
            digestType: "monthly",
            date: harness.dates.today
          })
        },
        202
      );

      const rerankedMonthlyDigest = await jsonRequest<DigestResponse>(
        harness.apiBaseUrl,
        "/api/v1/digests/latest?digestType=monthly"
      );
      expect(rerankedMonthlyDigest.recommendedItems.length).toBeGreaterThan(0);
      expect(rerankedMonthlyDigest.recommendedItems.some((item) => item.reason.includes("with preference"))).toBe(true);

      const monthlyHistory = await jsonRequest<ListDigestsResponse>(
        harness.apiBaseUrl,
        "/api/v1/digests?digestType=monthly&q=Monthly"
      );
      expect(monthlyHistory.digests.some((digest) => digest.id === rerankedMonthlyDigest.id)).toBe(true);
    },
    300_000
  );

  it("archives created watches after the live pipeline run", async () => {
    for (const watchId of [watchIds.nodeWatchId, watchIds.nextWatchId, watchIds.topicWatchId]) {
      await jsonRequest<{ ok: true }>(
        harness.apiBaseUrl,
        `/api/v1/watches/${watchId}`,
        {
          method: "DELETE"
        }
      );
    }

    const [watches, topics] = await Promise.all([
      jsonRequest<ListWatchesResponse>(harness.apiBaseUrl, "/api/v1/watches"),
      jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics")
    ]);

    expect(watches.watches).toHaveLength(0);
    expect(topics.topics.some((topic) => topic.watchTargetId === watchIds.topicWatchId)).toBe(false);
  });
});
