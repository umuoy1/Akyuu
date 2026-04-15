export type AskAnchorType = "digest" | "topic" | "history" | "search";

export type AskEvidenceItem = {
  sourceType: "digest_section" | "recommended_item" | "topic_update";
  sourceId: string | null;
  label: string;
  href: string | null;
};

export type AskTopicContext = {
  topicId: string;
  topicName: string;
  summary: string;
  highlights: string[];
  windowEnd: string;
};

export type AskRetrievalContext = {
  digestId: string | null;
  digestTitle: string | null;
  digestSummary: string | null;
  digestBullets: string[];
  recommendedItems: Array<{
    id: string;
    title: string;
    href: string | null;
    reason: string;
    score: number;
  }>;
  topics: AskTopicContext[];
  evidence: AskEvidenceItem[];
};

export type AskSessionView = {
  sessionId: string;
  anchorType: AskAnchorType;
  anchorId: string | null;
  question: string;
  answerMarkdown: string;
  llmVersion: string;
  createdAt: string;
  retrievalContext: AskRetrievalContext;
};
