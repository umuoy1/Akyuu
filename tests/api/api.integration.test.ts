import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
  ListTrendDiffsResponse,
  ListWatchesResponse,
  PreferenceProfileResponse,
  WorkspaceSettingsResponse,
  TopicResponse
} from "@akyuu/shared-types";

import { createApiIntegrationHarness, type ApiIntegrationHarness } from "./support/harness.js";

type CreatedWatchIds = {
  repoWatchId: string;
  topicWatchId: string;
  trendWatchId: string;
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

describe.sequential("API integration over HTTP with isolated PostgreSQL/Redis and real fixture data", () => {
  let harness: ApiIntegrationHarness;
  let baselineWatchCount = 0;
  let baselineTopicCount = 0;
  let fixtureTopicId = "";
  let latestDailyDigest: DigestResponse;
  let latestMonthlyDigest: DigestResponse;
  let createdWatchIds: CreatedWatchIds;

  beforeAll(async () => {
    harness = await createApiIntegrationHarness();
  });

  afterAll(async () => {
    if (harness) {
      await harness.stop();
    }
  });

  it("serves fixture-backed watch, topic, trend, notification, and empty preference state", async () => {
    const [watches, topics, trends, notifications, feedback, preferences] = await Promise.all([
      jsonRequest<ListWatchesResponse>(harness.apiBaseUrl, "/api/v1/watches"),
      jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics"),
      jsonRequest<ListTrendDiffsResponse>(harness.apiBaseUrl, "/api/v1/trends"),
      jsonRequest<ListNotificationsResponse>(harness.apiBaseUrl, "/api/v1/notifications"),
      jsonRequest<ListFeedbackResponse>(harness.apiBaseUrl, "/api/v1/feedback"),
      jsonRequest<PreferenceProfileResponse>(harness.apiBaseUrl, "/api/v1/preferences")
    ]);

    baselineWatchCount = watches.watches.length;
    baselineTopicCount = topics.topics.length;

    expect(watches.watches).toHaveLength(2);
    expect(watches.watches.map((watch) => watch.type).sort()).toEqual(["repo", "topic"]);

    const watchBackedTopic = topics.topics.find((topic) => topic.watchTargetId !== null);
    expect(watchBackedTopic).toBeDefined();
    expect(topics.topics.length).toBeGreaterThan(0);
    fixtureTopicId = watchBackedTopic!.id;

    const topicDetail = await jsonRequest<TopicResponse>(harness.apiBaseUrl, `/api/v1/topics/${fixtureTopicId}`);
    expect(topicDetail.id).toBe(fixtureTopicId);
    expect(topicDetail.aliases.length).toBeGreaterThan(0);
    expect(topicDetail.repoBindings.length).toBeGreaterThan(0);
    expect(topicDetail.recentUpdates.length).toBeGreaterThan(0);

    expect(trends.trends).toHaveLength(1);
    expect(trends.trends[0]?.items.length ?? 0).toBeGreaterThan(0);
    expect(notifications.notifications.length).toBeGreaterThan(0);
    expect(notifications.notifications[0]?.contentRefType).toBe("digest");
    expect(feedback.feedback).toHaveLength(0);
    expect(preferences.profile).toBeNull();
  });

  it("reads digest latest/detail/history endpoints for daily and monthly digests", async () => {
    latestDailyDigest = await jsonRequest<DigestResponse>(
      harness.apiBaseUrl,
      "/api/v1/digests/latest?digestType=daily"
    );
    expect(latestDailyDigest.digestType).toBe("daily");
    expect(latestDailyDigest.sections.length).toBeGreaterThan(0);
    expect(latestDailyDigest.recommendedItems.length).toBeGreaterThan(0);

    const dailyDetail = await jsonRequest<DigestResponse>(
      harness.apiBaseUrl,
      `/api/v1/digests/${latestDailyDigest.id}`
    );
    expect(dailyDetail.id).toBe(latestDailyDigest.id);
    expect(dailyDetail.renderedMarkdown.length).toBeGreaterThan(0);

    const dailyHistory = await jsonRequest<ListDigestsResponse>(
      harness.apiBaseUrl,
      "/api/v1/digests?digestType=daily&q=Daily"
    );
    expect(dailyHistory.digests.length).toBeGreaterThan(0);
    expect(dailyHistory.digests.some((digest) => digest.id === latestDailyDigest.id)).toBe(true);

    latestMonthlyDigest = await jsonRequest<DigestResponse>(
      harness.apiBaseUrl,
      "/api/v1/digests/latest?digestType=monthly"
    );
    expect(latestMonthlyDigest.digestType).toBe("monthly");
    expect(latestMonthlyDigest.recommendedItems.length).toBeGreaterThan(0);
    expect(latestMonthlyDigest.recommendedItems.some((item) => item.itemType === "pr")).toBe(true);

    const monthlyHistory = await jsonRequest<ListDigestsResponse>(
      harness.apiBaseUrl,
      "/api/v1/digests?digestType=monthly&q=Monthly"
    );
    expect(monthlyHistory.digests.length).toBeGreaterThan(0);
    expect(monthlyHistory.digests.some((digest) => digest.id === latestMonthlyDigest.id)).toBe(true);
  });

  it("creates an ask session anchored to a fixture digest and lists it back through the API", async () => {
    const sessionsBefore = await jsonRequest<ListAskSessionsResponse>(harness.apiBaseUrl, "/api/v1/ask/sessions");
    expect(sessionsBefore.sessions).toHaveLength(0);

    const askSession = await jsonRequest<AskSessionResponse>(
      harness.apiBaseUrl,
      "/api/v1/ask",
      {
        method: "POST",
        body: JSON.stringify({
          question: "今天最值得看的 3 个 PR 是什么？",
          anchorType: "digest",
          anchorId: latestDailyDigest.id
        })
      },
      201
    );
    expect(askSession.answerMarkdown.length).toBeGreaterThan(0);
    expect(askSession.retrievalContext.digestId).toBe(latestDailyDigest.id);

    const sessionsAfter = await jsonRequest<ListAskSessionsResponse>(harness.apiBaseUrl, "/api/v1/ask/sessions");
    expect(sessionsAfter.sessions).toHaveLength(1);
    expect(sessionsAfter.sessions[0]?.sessionId).toBe(askSession.sessionId);
  });

  it("records feedback through the API and materializes a workspace preference profile", async () => {
    const prItem = latestMonthlyDigest.recommendedItems.find((item) => item.itemType === "pr");
    expect(prItem).toBeDefined();

    const feedbackRecord = await jsonRequest<FeedbackResponse>(
      harness.apiBaseUrl,
      "/api/v1/feedback",
      {
        method: "POST",
        body: JSON.stringify({
          targetType: "recommended_item",
          targetId: prItem!.id,
          feedbackType: "worthwhile",
          metadata: {
            itemType: "pr",
            title: prItem!.title
          }
        })
      },
      201
    );
    expect(feedbackRecord.feedbackType).toBe("worthwhile");
    expect(feedbackRecord.targetId).toBe(prItem!.id);

    const [feedback, preferences] = await Promise.all([
      jsonRequest<ListFeedbackResponse>(harness.apiBaseUrl, "/api/v1/feedback"),
      jsonRequest<PreferenceProfileResponse>(harness.apiBaseUrl, "/api/v1/preferences")
    ]);

    expect(feedback.feedback).toHaveLength(1);
    expect(feedback.feedback[0]?.targetId).toBe(prItem!.id);
    expect(preferences.profile).not.toBeNull();
    expect((preferences.profile?.profile.itemTypeWeights.pr ?? 0)).toBeGreaterThan(0);
    expect(preferences.profile?.profile.feedbackCount).toBe(1);
  });

  it("updates workspace locale and regenerates localized digest and ask output", async () => {
    const settingsBefore = await jsonRequest<WorkspaceSettingsResponse>(harness.apiBaseUrl, "/api/v1/settings");
    expect(settingsBefore.locale).toBe("en-US");

    const updatedSettings = await jsonRequest<WorkspaceSettingsResponse>(
      harness.apiBaseUrl,
      "/api/v1/settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          locale: "zh-CN"
        })
      }
    );
    expect(updatedSettings.locale).toBe("zh-CN");

    const localizedRun = await jsonRequest<{ digestId: string }>(
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

    const localizedDigest = await jsonRequest<DigestResponse>(
      harness.apiBaseUrl,
      "/api/v1/digests/latest?digestType=daily"
    );
    expect(localizedDigest.id).toBe(localizedRun.digestId);
    expect(localizedDigest.title).toContain("日报");
    expect(localizedDigest.sections.some((section) => section.title === "重点变化")).toBe(true);

    const localizedAsk = await jsonRequest<AskSessionResponse>(
      harness.apiBaseUrl,
      "/api/v1/ask",
      {
        method: "POST",
        body: JSON.stringify({
          question: "今天最值得看的 3 个 PR 是什么？",
          anchorType: "digest",
          anchorId: localizedDigest.id
        })
      },
      201
    );
    expect(localizedAsk.answerMarkdown).toContain("### 建议先看");
  });

  it("creates repo/topic/trend watches and archives them through the HTTP API", async () => {
    const uniqueSuffix = String(Date.now());
    const repoWatch: CreateWatchRequest = {
      type: "repo",
      name: `Next.js Repo ${uniqueSuffix}`,
      priority: 3,
      config: {
        owner: "vercel",
        repo: "next.js",
        pullsLimit: 2,
        issuesLimit: 2
      }
    };
    const topicWatch: CreateWatchRequest = {
      type: "topic",
      name: `Runtime Security Topic ${uniqueSuffix}`,
      priority: 4,
      config: {
        aliases: ["runtime security"],
        keywords: ["permission", "security"],
        repoBindings: ["nodejs/node"]
      }
    };
    const trendWatch: CreateWatchRequest = {
      type: "trend",
      name: `Trending Global ${uniqueSuffix}`,
      priority: 2,
      config: {
        source: "github_trending",
        scope: "global"
      }
    };

    const repoResult = await jsonRequest<{ watch: { id: string } }>(
      harness.apiBaseUrl,
      "/api/v1/watches",
      {
        method: "POST",
        body: JSON.stringify(repoWatch)
      },
      201
    );
    const topicResult = await jsonRequest<{ watch: { id: string } }>(
      harness.apiBaseUrl,
      "/api/v1/watches",
      {
        method: "POST",
        body: JSON.stringify(topicWatch)
      },
      201
    );
    const trendResult = await jsonRequest<{ watch: { id: string } }>(
      harness.apiBaseUrl,
      "/api/v1/watches",
      {
        method: "POST",
        body: JSON.stringify(trendWatch)
      },
      201
    );

    createdWatchIds = {
      repoWatchId: repoResult.watch.id,
      topicWatchId: topicResult.watch.id,
      trendWatchId: trendResult.watch.id
    };

    const watchesAfterCreate = await jsonRequest<ListWatchesResponse>(harness.apiBaseUrl, "/api/v1/watches");
    expect(watchesAfterCreate.watches).toHaveLength(baselineWatchCount + 3);

    const topicsAfterCreate = await jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics");
    expect(topicsAfterCreate.topics).toHaveLength(baselineTopicCount + 1);

    const createdTopic = topicsAfterCreate.topics.find((topic) => topic.watchTargetId === createdWatchIds.topicWatchId);
    expect(createdTopic).toBeDefined();

    const createdTopicDetail = await jsonRequest<TopicResponse>(
      harness.apiBaseUrl,
      `/api/v1/topics/${createdTopic!.id}`
    );
    expect(createdTopicDetail.aliases).toContain("runtime security");
    expect(createdTopicDetail.keywords).toContain("permission");
    expect(createdTopicDetail.repoBindings).toContain("nodejs/node");

    await jsonRequest<{ ok: true }>(
      harness.apiBaseUrl,
      `/api/v1/watches/${createdWatchIds.repoWatchId}`,
      {
        method: "DELETE"
      }
    );
    await jsonRequest<{ ok: true }>(
      harness.apiBaseUrl,
      `/api/v1/watches/${createdWatchIds.topicWatchId}`,
      {
        method: "DELETE"
      }
    );
    await jsonRequest<{ ok: true }>(
      harness.apiBaseUrl,
      `/api/v1/watches/${createdWatchIds.trendWatchId}`,
      {
        method: "DELETE"
      }
    );

    const [watchesAfterDelete, topicsAfterDelete] = await Promise.all([
      jsonRequest<ListWatchesResponse>(harness.apiBaseUrl, "/api/v1/watches"),
      jsonRequest<ListTopicsResponse>(harness.apiBaseUrl, "/api/v1/topics")
    ]);

    expect(watchesAfterDelete.watches).toHaveLength(baselineWatchCount);
    expect(topicsAfterDelete.topics).toHaveLength(baselineTopicCount);
    expect(topicsAfterDelete.topics.some((topic) => topic.watchTargetId === createdWatchIds.topicWatchId)).toBe(false);
  });
});
