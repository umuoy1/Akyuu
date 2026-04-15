import type { CreateWatchInput } from "@akyuu/shared-types";

export const sampleRepoWatch: CreateWatchInput = {
  type: "repo",
  name: "Node.js",
  priority: 5,
  config: {
    owner: "nodejs",
    repo: "node",
    pullsLimit: 5,
    issuesLimit: 5
  }
};

export const sampleTrendWatch: CreateWatchInput = {
  type: "trend",
  name: "GitHub Trending",
  priority: 4,
  config: {
    source: "github_trending",
    scope: "global"
  }
};
