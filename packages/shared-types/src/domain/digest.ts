export type DigestSectionSummary = {
  key: string;
  title: string;
  bullets: string[];
  markdown: string;
};

export type DigestSkeleton = {
  title: string;
  summary: string;
  sections: DigestSectionSummary[];
  markdown: string;
};

export type RecommendedItemView = {
  id: string;
  itemType: "pr" | "issue" | "repo" | "topic" | "release";
  title: string;
  href: string | null;
  reason: string;
  score: number;
};

export type DigestView = {
  id: string;
  digestType: "daily" | "weekly" | "monthly";
  title: string;
  summary: string;
  renderedMarkdown: string;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
  sections: DigestSectionSummary[];
  recommendedItems: RecommendedItemView[];
};
