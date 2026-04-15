import { Octokit } from "octokit";

import { getEnv } from "@akyuu/shared-config";
import type { RepoWatchConfig } from "@akyuu/shared-types";

export type GitHubRawSignal = {
  sourceType:
    | "github_repo_metadata"
    | "github_pull_request"
    | "github_issue"
    | "github_release";
  sourceKey: string;
  externalId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

function createClient(): Octokit {
  const env = getEnv();

  return new Octokit(
    env.GITHUB_TOKEN
      ? {
          auth: env.GITHUB_TOKEN
        }
      : {}
  );
}

export async function fetchRepoSignals(config: RepoWatchConfig): Promise<GitHubRawSignal[]> {
  const octokit = createClient();
  const { owner, repo, pullsLimit, issuesLimit } = config;
  const repoFullName = `${owner}/${repo}`;

  const [repoResponse, pullsResponse, issuesResponse, releasesResponse] = await Promise.all([
    octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo
    }),
    octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: pullsLimit
    }),
    octokit.request("GET /repos/{owner}/{repo}/issues", {
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: issuesLimit
    }),
    octokit.request("GET /repos/{owner}/{repo}/releases", {
      owner,
      repo,
      per_page: 1
    })
  ]);

  const signals: GitHubRawSignal[] = [
    {
      sourceType: "github_repo_metadata",
      sourceKey: repoFullName,
      externalId: repoResponse.data.full_name,
      occurredAt: repoResponse.data.updated_at ?? new Date().toISOString(),
      payload: repoResponse.data as unknown as Record<string, unknown>
    }
  ];

  for (const pr of pullsResponse.data) {
    signals.push({
      sourceType: "github_pull_request",
      sourceKey: repoFullName,
      externalId: String(pr.id),
      occurredAt: pr.updated_at ?? pr.created_at ?? new Date().toISOString(),
      payload: pr as unknown as Record<string, unknown>
    });
  }

  for (const issue of issuesResponse.data.filter((item) => !item.pull_request)) {
    signals.push({
      sourceType: "github_issue",
      sourceKey: repoFullName,
      externalId: String(issue.id),
      occurredAt: issue.updated_at ?? issue.created_at ?? new Date().toISOString(),
      payload: issue as unknown as Record<string, unknown>
    });
  }

  for (const release of releasesResponse.data.slice(0, 1)) {
    signals.push({
      sourceType: "github_release",
      sourceKey: repoFullName,
      externalId: String(release.id),
      occurredAt: release.published_at ?? release.created_at ?? new Date().toISOString(),
      payload: release as unknown as Record<string, unknown>
    });
  }

  return signals;
}
