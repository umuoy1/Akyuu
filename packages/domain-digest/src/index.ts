import { buildMarkdownFromSections } from "@akyuu/shared-utils";
import { getMessages } from "@akyuu/shared-i18n";
import type { DigestSectionSummary, DigestSkeleton, RecommendedItemView, SupportedLocale } from "@akyuu/shared-types";

type DigestEventItem = {
  title: string;
  summary: string;
};

export function makeSection(
  key: string,
  title: string,
  items: DigestEventItem[]
): DigestSectionSummary {
  const bullets = items.map((item) => `${item.title}: ${item.summary}`);
  const markdown = [`## ${title}`, "", ...bullets.map((item) => `- ${item}`)].join("\n");

  return {
    key,
    title,
    bullets,
    markdown
  };
}

export function buildDigestSkeleton(input: {
  title: string;
  summary: string;
  topStories: DigestEventItem[];
  repoItems: DigestEventItem[];
  topicItems: DigestEventItem[];
  trendItems: DigestEventItem[];
  recommendedItems: RecommendedItemView[];
  locale?: SupportedLocale;
  sectionTitles?: {
    topStories: string;
    repo: string;
    topic: string;
    trend: string;
    recommended: string;
  };
}): DigestSkeleton {
  const messages = getMessages(input.locale ?? "en-US");
  const sectionTitles = input.sectionTitles ?? {
    topStories: messages.digest.topStories,
    repo: messages.digest.repoSummary,
    topic: messages.digest.topicSummary,
    trend: messages.digest.trendSummary,
    recommended: messages.digest.recommendedReading
  };
  const sections = [
    makeSection("top_stories", sectionTitles.topStories, input.topStories),
    makeSection("repo", sectionTitles.repo, input.repoItems),
    makeSection("topic", sectionTitles.topic, input.topicItems),
    makeSection("trend", sectionTitles.trend, input.trendItems),
    makeSection(
      "recommended",
      sectionTitles.recommended,
      input.recommendedItems.map((item) => ({
        title: item.title,
        summary: item.reason
      }))
    )
  ];

  return {
    title: input.title,
    summary: input.summary,
    sections,
    markdown: buildMarkdownFromSections(input.title, input.summary, sections)
  };
}
