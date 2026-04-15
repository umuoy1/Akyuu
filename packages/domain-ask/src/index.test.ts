import { describe, expect, it } from "vitest";

import { buildAskSession } from "./index.js";

describe("buildAskSession", () => {
  it("prefers recommended items for recommendation questions", () => {
    const result = buildAskSession({
      anchorType: "digest",
      anchorId: "3b54fb9a-1d70-4f9b-993f-ec474b6932e1",
      question: "今天最值得看的 3 个 PR 是什么？",
      digest: {
        id: "3b54fb9a-1d70-4f9b-993f-ec474b6932e1",
        digestType: "daily",
        title: "Daily Digest",
        summary: "Summary",
        renderedMarkdown: "",
        windowStart: new Date().toISOString(),
        windowEnd: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        sections: [
          {
            key: "trend",
            title: "Trend Summary",
            bullets: ["Node moved up"],
            markdown: ""
          }
        ],
        recommendedItems: [
          {
            id: "c9a9d171-3b0b-4b6f-a14a-8bf4ba8cc6a7",
            itemType: "pr",
            title: "nodejs/node#1",
            href: "https://github.com/nodejs/node/pull/1",
            reason: "Importance score 9.2 from pr_merged",
            score: 9.2
          }
        ]
      },
      topics: []
    });

    expect(result.answerMarkdown).toContain("建议先看");
    expect(result.answerMarkdown).toContain("nodejs/node#1");
  });

  it("uses topic updates for topic-oriented questions", () => {
    const result = buildAskSession({
      anchorType: "topic",
      anchorId: "3e62cc47-b74f-4b5d-b2b2-6e8d0dbf04f4",
      question: "Temporal 最近有没有推进？",
      digest: null,
      topics: [
        {
          id: "3e62cc47-b74f-4b5d-b2b2-6e8d0dbf04f4",
          name: "Temporal",
          slug: "temporal",
          description: null,
          aliases: ["Temporal"],
          repoBindings: ["tc39/proposal-temporal"],
          keywords: ["temporal"],
          watchTargetId: null,
          evidenceCount: 3,
          updateCount: 1,
          latestSummary: "Temporal had fresh activity.",
          latestWindowEnd: "2026-04-16T00:00:00.000Z",
          recentUpdates: [
            {
              id: "7c402a40-bf8e-41f8-b578-c524f4892540",
              topicId: "3e62cc47-b74f-4b5d-b2b2-6e8d0dbf04f4",
              topicName: "Temporal",
              summary: "Temporal had fresh activity.",
              highlights: ["proposal repo merged a PR"],
              evidenceCount: 3,
              windowStart: "2026-04-15T00:00:00.000Z",
              windowEnd: "2026-04-16T00:00:00.000Z",
              createdAt: "2026-04-16T00:00:00.000Z"
            }
          ]
        }
      ]
    });

    expect(result.answerMarkdown).toContain("主题视角总结");
    expect(result.answerMarkdown).toContain("Temporal");
  });
});
