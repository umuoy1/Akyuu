export type TopicMatchRule = {
  id: string;
  topicId: string;
  ruleType:
    | "keyword"
    | "repo_binding"
    | "label_binding"
    | "path_binding"
    | "reference_binding"
    | "person_binding";
  operator: "include" | "exclude" | "regex" | "exact";
  value: string;
  weight: number;
};

export type TopicEvidenceRecord = {
  topicId: string;
  canonicalEventId: string;
  evidenceType:
    | "repo_binding"
    | "alias_hit"
    | "keyword_hit"
    | "path_hit"
    | "label_hit"
    | "reference_hit"
    | "person_hit";
  score: number;
  explanation: string;
};

export type TopicUpdateView = {
  id: string;
  topicId: string;
  topicName: string;
  summary: string;
  highlights: string[];
  evidenceCount: number;
  windowStart: string;
  windowEnd: string;
  createdAt: string;
};

export type TopicView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  aliases: string[];
  repoBindings: string[];
  keywords: string[];
  watchTargetId: string | null;
  evidenceCount: number;
  updateCount: number;
  latestSummary: string | null;
  latestWindowEnd: string | null;
  recentUpdates: TopicUpdateView[];
};
