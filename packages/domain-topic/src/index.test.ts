import { describe, expect, it } from "vitest";

import { matchTopicRules } from "./index.js";

describe("matchTopicRules", () => {
  it("matches keyword and repo binding evidence", () => {
    const evidences = matchTopicRules({
      topicId: "topic-1",
      canonicalEventId: "event-1",
      repoFullName: "nodejs/node",
      title: "Agent protocol improvements",
      body: "This change adds a new agent runtime hook.",
      labels: ["feature"],
      paths: [],
      references: [],
      people: [],
      aliases: [
        {
          topicId: "topic-1",
          alias: "agent",
          aliasType: "keyword",
          weight: 2
        }
      ],
      rules: [
        {
          id: "rule-1",
          topicId: "topic-1",
          ruleType: "repo_binding",
          operator: "exact",
          value: "nodejs/node",
          weight: 4
        }
      ]
    });

    expect(evidences).toHaveLength(2);
    expect(evidences.map((item) => item.evidenceType)).toEqual(["alias_hit", "repo_binding"]);
  });

  it("returns no evidence when exclude rule matches", () => {
    const evidences = matchTopicRules({
      topicId: "topic-1",
      canonicalEventId: "event-1",
      repoFullName: "nodejs/node",
      title: "Agent changelog",
      body: "ignore this event",
      labels: [],
      paths: [],
      references: [],
      people: [],
      aliases: [],
      rules: [
        {
          id: "rule-1",
          topicId: "topic-1",
          ruleType: "keyword",
          operator: "exclude",
          value: "ignore this event",
          weight: 0
        }
      ]
    });

    expect(evidences).toEqual([]);
  });
});
