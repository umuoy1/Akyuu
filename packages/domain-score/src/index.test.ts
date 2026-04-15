import { describe, expect, it } from "vitest";

import { scoreCanonicalEvent } from "./index.js";

describe("scoreCanonicalEvent", () => {
  it("gives merged PRs a higher score than docs-only typo work", () => {
    const merged = scoreCanonicalEvent({
      eventType: "pr_merged",
      metadata: {
        title: "Add new runtime feature",
        comments: 8,
        reviewComments: 5
      },
      watchPriority: 5
    });

    const typo = scoreCanonicalEvent({
      eventType: "pr_opened",
      metadata: {
        title: "docs: typo fix",
        comments: 0,
        reviewComments: 0
      },
      watchPriority: 1
    });

    expect(merged.score).toBeGreaterThan(typo.score);
  });
});
