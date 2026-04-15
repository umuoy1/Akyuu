import { toSlug } from "@akyuu/shared-utils";

import type { TopicEvidenceRecord, TopicMatchRule, TopicWatchConfig } from "@akyuu/shared-types";

type TopicAlias = {
  topicId: string;
  alias: string;
  aliasType: string;
  weight: number;
};

type TopicMatchInput = {
  topicId: string;
  canonicalEventId: string;
  repoFullName: string | null;
  title: string;
  body: string;
  labels: string[];
  paths: string[];
  references: string[];
  people: string[];
  aliases: TopicAlias[];
  rules: TopicMatchRule[];
};

function hasTextMatch(operator: TopicMatchRule["operator"], haystack: string, needle: string): boolean {
  if (operator === "regex") {
    return new RegExp(needle, "i").test(haystack);
  }

  if (operator === "exact") {
    return haystack === needle.toLowerCase();
  }

  return haystack.includes(needle.toLowerCase());
}

export function matchTopicRules(input: TopicMatchInput): TopicEvidenceRecord[] {
  const evidences: TopicEvidenceRecord[] = [];
  const titleAndBody = `${input.title}\n${input.body}`.toLowerCase();
  const lowerLabels = input.labels.map((item) => item.toLowerCase());
  const lowerPaths = input.paths.map((item) => item.toLowerCase());
  const lowerReferences = input.references.map((item) => item.toLowerCase());
  const lowerPeople = input.people.map((item) => item.toLowerCase());

  for (const alias of input.aliases) {
    const normalizedAlias = alias.alias.toLowerCase();

    if (titleAndBody.includes(normalizedAlias)) {
      evidences.push({
        topicId: input.topicId,
        canonicalEventId: input.canonicalEventId,
        evidenceType: "alias_hit",
        score: alias.weight,
        explanation: `Matched alias "${alias.alias}" in title/body`
      });
    }
  }

  for (const rule of input.rules) {
    const value = rule.value.toLowerCase();

    if (rule.operator === "exclude") {
      if (titleAndBody.includes(value)) {
        return [];
      }
      continue;
    }

    switch (rule.ruleType) {
      case "repo_binding":
        if (input.repoFullName && input.repoFullName.toLowerCase() === value) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "repo_binding",
            score: rule.weight,
            explanation: `Matched repo binding "${rule.value}"`
          });
        }
        break;
      case "keyword":
        if (hasTextMatch(rule.operator, titleAndBody, value)) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "keyword_hit",
            score: rule.weight,
            explanation: `Matched keyword "${rule.value}"`
          });
        }
        break;
      case "label_binding":
        if (lowerLabels.includes(value)) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "label_hit",
            score: rule.weight,
            explanation: `Matched label "${rule.value}"`
          });
        }
        break;
      case "path_binding":
        if (lowerPaths.some((item) => item.includes(value))) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "path_hit",
            score: rule.weight,
            explanation: `Matched path "${rule.value}"`
          });
        }
        break;
      case "reference_binding":
        if (lowerReferences.some((item) => item.includes(value))) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "reference_hit",
            score: rule.weight,
            explanation: `Matched reference "${rule.value}"`
          });
        }
        break;
      case "person_binding":
        if (lowerPeople.includes(value)) {
          evidences.push({
            topicId: input.topicId,
            canonicalEventId: input.canonicalEventId,
            evidenceType: "person_hit",
            score: rule.weight,
            explanation: `Matched person "${rule.value}"`
          });
        }
        break;
      default:
        break;
    }
  }

  return evidences;
}

export function buildTopicArtifacts(input: {
  topicId: string;
  config: TopicWatchConfig;
}): {
  aliases: Array<{
    topicId: string;
    alias: string;
    aliasType: string;
    weight: number;
  }>;
  rules: TopicMatchRule[];
} {
  return {
    aliases: input.config.aliases.map((alias) => ({
      topicId: input.topicId,
      alias,
      aliasType: "keyword",
      weight: 1.5
    })),
    rules: [
      ...input.config.repoBindings.map((repo, index) => ({
        id: `${input.topicId}:repo:${index}`,
        topicId: input.topicId,
        ruleType: "repo_binding" as const,
        operator: "exact" as const,
        value: repo,
        weight: 3
      })),
      ...input.config.keywords.map((keyword, index) => ({
        id: `${input.topicId}:keyword:${index}`,
        topicId: input.topicId,
        ruleType: "keyword" as const,
        operator: "include" as const,
        value: keyword,
        weight: 2
      }))
    ]
  };
}

export function buildTopicSlug(name: string): string {
  return toSlug(name);
}

export function buildTopicUpdateSummary(input: {
  topicName: string;
  evidences: Array<{
    title: string;
    repoFullName: string | null;
    eventType: string;
    explanation: string;
  }>;
}): {
  summary: string;
  highlights: string[];
  evidenceCount: number;
} {
  const highlights = input.evidences.slice(0, 3).map((item) => {
    const repoPart = item.repoFullName ? ` in ${item.repoFullName}` : "";
    return `${item.title} -> ${item.eventType}${repoPart}`;
  });

  return {
    summary:
      input.evidences.length > 0
        ? `${input.topicName} matched ${input.evidences.length} signals in the current window.`
        : `${input.topicName} had no matched signals in the current window.`,
    highlights,
    evidenceCount: input.evidences.length
  };
}
