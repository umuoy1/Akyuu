import { describe, expect, it } from "vitest";

import { buildTrendDiffSummary } from "./index.js";

describe("buildTrendDiffSummary", () => {
  it("detects new entries and moved items", () => {
    const summary = buildTrendDiffSummary(
      [
        { rank: 1, repoFullName: "a/a", description: null, language: null, starsToday: 10 },
        { rank: 2, repoFullName: "b/b", description: null, language: null, starsToday: 9 },
        { rank: 3, repoFullName: "c/c", description: null, language: null, starsToday: 8 }
      ],
      [
        { rank: 1, repoFullName: "b/b", description: null, language: null, starsToday: 12 },
        { rank: 2, repoFullName: "a/a", description: null, language: null, starsToday: 11 },
        { rank: 3, repoFullName: "d/d", description: null, language: null, starsToday: 7 }
      ],
      "en-US"
    );

    expect(summary.newEntries).toEqual(["d/d"]);
    expect(summary.leftEntries).toEqual(["c/c"]);
    expect(summary.movedUp).toEqual([{ repoFullName: "b/b", from: 2, to: 1 }]);
    expect(summary.movedDown).toEqual([{ repoFullName: "a/a", from: 1, to: 2 }]);
  });
});
