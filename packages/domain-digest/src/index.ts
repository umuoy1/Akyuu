import { buildMarkdownFromSections } from "@akyuu/shared-utils";
import type { DigestSectionSummary, DigestSkeleton, RecommendedItemView } from "@akyuu/shared-types";

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
}): DigestSkeleton {
  const sections = [
    makeSection("top_stories", "Top Stories", input.topStories),
    makeSection("repo", "Repo Summary", input.repoItems),
    makeSection("topic", "Topic Summary", input.topicItems),
    makeSection("trend", "Trend Summary", input.trendItems),
    makeSection(
      "recommended",
      "Recommended Reading",
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
