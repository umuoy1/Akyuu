import type { AskAnchorType, AskRetrievalContext, AskSessionView, DigestView, TopicView } from "@akyuu/shared-types";
import { normalizeText } from "@akyuu/shared-utils";

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function formatEvidenceLine(label: string, href: string | null): string {
  return href ? `- [${label}](${href})` : `- ${label}`;
}

function selectDigestBullets(digest: DigestView | null): string[] {
  if (!digest) {
    return [];
  }

  return digest.sections.flatMap((section) => section.bullets);
}

function selectTopicContexts(question: string, topics: TopicView[], anchorTopicId?: string): AskRetrievalContext["topics"] {
  const normalizedQuestion = normalizeText(question);
  const anchoredTopic = anchorTopicId ? topics.find((topic) => topic.id === anchorTopicId) ?? null : null;
  const candidates = anchoredTopic
    ? [anchoredTopic]
    : topics.filter((topic) => {
        if (normalizedQuestion.includes(normalizeText(topic.name))) {
          return true;
        }

        return topic.aliases.some((alias) => normalizedQuestion.includes(normalizeText(alias)));
      });

  const fallback = candidates.length > 0 ? candidates : topics.filter((topic) => topic.recentUpdates.length > 0).slice(0, 3);

  return fallback.slice(0, 3).map((topic) => {
    const update = topic.recentUpdates[0];
    return {
      topicId: topic.id,
      topicName: topic.name,
      summary: update?.summary ?? topic.latestSummary ?? "No topic summary yet.",
      highlights: update?.highlights ?? [],
      windowEnd: update?.windowEnd ?? topic.latestWindowEnd ?? new Date(0).toISOString()
    };
  });
}

function selectRecommendedItems(question: string, digest: DigestView | null): AskRetrievalContext["recommendedItems"] {
  if (!digest) {
    return [];
  }

  const normalizedQuestion = normalizeText(question);
  const filtered = digest.recommendedItems.filter((item) => {
    const haystack = normalizeText(`${item.title} ${item.reason}`);
    return haystack.includes(normalizedQuestion) || normalizedQuestion.includes(normalizeText(item.title));
  });

  return (filtered.length > 0 ? filtered : digest.recommendedItems).slice(0, 5).map((item) => ({
    id: item.id,
    title: item.title,
    href: item.href,
    reason: item.reason,
    score: item.score
  }));
}

export function buildAskSession(input: {
  anchorType: AskAnchorType;
  anchorId: string | null;
  question: string;
  digest: DigestView | null;
  topics: TopicView[];
}): Omit<AskSessionView, "sessionId" | "createdAt"> {
  const normalizedQuestion = normalizeText(input.question);
  const retrievalContext: AskRetrievalContext = {
    digestId: input.digest?.id ?? null,
    digestTitle: input.digest?.title ?? null,
    digestSummary: input.digest?.summary ?? null,
    digestBullets: selectDigestBullets(input.digest).slice(0, 8),
    recommendedItems: selectRecommendedItems(input.question, input.digest),
    topics: selectTopicContexts(
      input.question,
      input.topics,
      input.anchorType === "topic" ? input.anchorId ?? undefined : undefined
    ),
    evidence: []
  };

  retrievalContext.evidence = [
    ...retrievalContext.recommendedItems.map((item) => ({
      sourceType: "recommended_item" as const,
      sourceId: item.id,
      label: `${item.title} · ${item.reason}`,
      href: item.href
    })),
    ...retrievalContext.topics.map((topic) => ({
      sourceType: "topic_update" as const,
      sourceId: topic.topicId,
      label: `${topic.topicName} · ${topic.summary}`,
      href: null
    })),
    ...retrievalContext.digestBullets.slice(0, 4).map((bullet, index) => ({
      sourceType: "digest_section" as const,
      sourceId: null,
      label: `${input.digest?.sections[index]?.title ?? "Digest"} · ${bullet}`,
      href: null
    }))
  ].slice(0, 8);

  let answerMarkdown = "当前还没有可用上下文。先生成一份日报，或者给 TopicWatch 绑定至少一个仓库。";

  if (containsAny(normalizedQuestion, ["推荐", "值得看", "worth", "read", "pr"])) {
    const lines = retrievalContext.recommendedItems.slice(0, 3).map((item, index) => {
      const href = item.href ? `（${item.href}）` : "";
      return `${index + 1}. ${item.title}：${item.reason}${href}`;
    });

    answerMarkdown = [
      "### 建议先看",
      lines.length > 0 ? lines.join("\n") : "当前 digest 里还没有推荐对象。",
      "",
      "### 可追溯依据",
      ...retrievalContext.recommendedItems.slice(0, 3).map((item) => formatEvidenceLine(`${item.title} · ${item.reason}`, item.href))
    ].join("\n");
  } else if (containsAny(normalizedQuestion, ["topic", "主题", "proposal", "推进", "trend of"])) {
    const lines = retrievalContext.topics.flatMap((topic) => [
      `- ${topic.topicName}：${topic.summary}`,
      ...topic.highlights.slice(0, 2).map((highlight) => `  - ${highlight}`)
    ]);

    answerMarkdown = [
      "### 主题视角总结",
      lines.length > 0 ? lines.join("\n") : "当前没有命中的主题更新。",
      "",
      "### 可追溯依据",
      ...retrievalContext.topics.map((topic) => `- ${topic.topicName} · 窗口截止 ${topic.windowEnd}`)
    ].join("\n");
  } else if (containsAny(normalizedQuestion, ["trend", "trending", "热榜", "榜单"])) {
    const trendBullets = input.digest?.sections.find((section) => section.key === "trend")?.bullets ?? [];
    answerMarkdown = [
      "### 趋势结论",
      ...(trendBullets.length > 0 ? trendBullets.map((bullet) => `- ${bullet}`) : ["- 当前没有可用的趋势 diff。"]),
      "",
      "### 可追溯依据",
      ...trendBullets.slice(0, 3).map((bullet) => `- ${bullet}`)
    ].join("\n");
  } else if (input.digest) {
    answerMarkdown = [
      "### 当前结论",
      `- ${input.digest.summary}`,
      ...retrievalContext.digestBullets.slice(0, 4).map((bullet) => `- ${bullet}`),
      "",
      "### 可追溯依据",
      ...retrievalContext.evidence.slice(0, 5).map((item) => formatEvidenceLine(item.label, item.href))
    ].join("\n");
  }

  return {
    anchorType: input.anchorType,
    anchorId: input.anchorId,
    question: input.question,
    answerMarkdown,
    llmVersion: "deterministic-v1",
    retrievalContext
  };
}
