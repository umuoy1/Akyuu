import { describe, expect, it } from "vitest";

import { buildAskAnswerPrompt, buildChatCompletionsUrl, extractRenderedMarkdown, normalizeOpenAiBaseUrl } from "./index.js";

describe("normalizeOpenAiBaseUrl", () => {
  it("appends a trailing slash when missing", () => {
    expect(normalizeOpenAiBaseUrl("https://open.bigmodel.cn/api/paas/v4")).toBe(
      "https://open.bigmodel.cn/api/paas/v4/"
    );
  });

  it("keeps an existing trailing slash", () => {
    expect(normalizeOpenAiBaseUrl("https://open.bigmodel.cn/api/paas/v4/")).toBe(
      "https://open.bigmodel.cn/api/paas/v4/"
    );
  });
});

describe("buildChatCompletionsUrl", () => {
  it("builds the OpenAI-compatible chat completions endpoint", () => {
    expect(buildChatCompletionsUrl("https://open.bigmodel.cn/api/paas/v4")).toBe(
      "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    );
  });
});

describe("extractRenderedMarkdown", () => {
  it("reads plain string content", () => {
    expect(
      extractRenderedMarkdown({
        choices: [
          {
            message: {
              content: "## Digest"
            }
          }
        ]
      })
    ).toBe("## Digest");
  });

  it("joins text parts from array content", () => {
    expect(
      extractRenderedMarkdown({
        choices: [
          {
            message: {
              content: [
                {
                  type: "text",
                  text: "## Digest"
                },
                {
                  type: "text",
                  text: "- item"
                }
              ]
            }
          }
        ]
      })
    ).toBe("## Digest\n- item");
  });

  it("returns null when no markdown content exists", () => {
    expect(
      extractRenderedMarkdown({
        choices: [
          {
            message: {}
          }
        ]
      })
    ).toBeNull();
  });
});

describe("buildAskAnswerPrompt", () => {
  it("includes the question and retrieval context", () => {
    const prompt = buildAskAnswerPrompt({
      question: "今天最值得看的 PR 是什么？",
      anchorType: "digest",
      anchorId: "3b54fb9a-1d70-4f9b-993f-ec474b6932e1",
      locale: "zh-CN",
      retrievalContext: {
        digestId: "3b54fb9a-1d70-4f9b-993f-ec474b6932e1",
        digestTitle: "Daily Digest",
        digestSummary: "Summary",
        digestBullets: ["Node moved up"],
        recommendedItems: [
          {
            id: "c9a9d171-3b0b-4b6f-a14a-8bf4ba8cc6a7",
            title: "nodejs/node#1",
            href: "https://github.com/nodejs/node/pull/1",
            reason: "Importance score 9.2 from pr_merged",
            score: 9.2
          }
        ],
        topics: [],
        evidence: []
      }
    });

    expect(prompt).toContain("今天最值得看的 PR 是什么？");
    expect(prompt).toContain("问题");
    expect(prompt).toContain("\"digestTitle\": \"Daily Digest\"");
    expect(prompt).toContain("\"title\": \"nodejs/node#1\"");
  });
});
