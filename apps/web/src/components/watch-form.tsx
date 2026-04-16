"use client";

import { useState, useTransition } from "react";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";

export function WatchForm() {
  const [watchType, setWatchType] = useState<"repo" | "trend" | "topic">("repo");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("nodejs/node");
  const [scope, setScope] = useState("global");
  const [topicAliases, setTopicAliases] = useState("agent, ai agent");
  const [topicKeywords, setTopicKeywords] = useState("agent, llm");
  const [topicRepos, setTopicRepos] = useState("openai/codex, microsoft/typescript");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const splitCsv = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      setError(null);

      const body =
        watchType === "repo"
          ? {
              type: "repo",
              name: name || repo,
              priority: 4,
              config: {
                owner: repo.split("/")[0],
                repo: repo.split("/")[1],
                pullsLimit: 5,
                issuesLimit: 5
              }
            }
          : watchType === "trend"
            ? {
                type: "trend",
                name: name || `Trending ${scope}`,
                priority: 3,
                config: {
                  source: "github_trending",
                  scope
                }
              }
            : {
                type: "topic",
                name: name || "AI Agent",
                priority: 5,
                config: {
                  aliases: splitCsv(topicAliases),
                  keywords: splitCsv(topicKeywords),
                  repoBindings: splitCsv(topicRepos)
                }
              };

      const response = await fetch(`${getClientApiBaseUrl()}/api/v1/watches`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        setError(await readResponseError(response, "Failed to create watch"));
        return;
      }

      window.location.reload();
    });
  };

  return (
    <form className="panel form" onSubmit={onSubmit}>
      <h2>Add Watch</h2>
      <label>
        Type
        <select value={watchType} onChange={(event) => setWatchType(event.target.value as "repo" | "trend" | "topic")}>
          <option value="repo">RepoWatch</option>
          <option value="topic">TopicWatch</option>
          <option value="trend">TrendWatch</option>
        </select>
      </label>

      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional display name" />
      </label>

      {watchType === "repo" ? (
        <label>
          Repo
          <input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder="owner/repo" />
        </label>
      ) : watchType === "trend" ? (
        <label>
          Scope
          <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="global" />
        </label>
      ) : (
        <>
          <label>
            Repo Bindings
            <input
              value={topicRepos}
              onChange={(event) => setTopicRepos(event.target.value)}
              placeholder="owner/repo, owner/repo"
            />
          </label>

          <label>
            Aliases
            <input
              value={topicAliases}
              onChange={(event) => setTopicAliases(event.target.value)}
              placeholder="temporal, async context"
            />
          </label>

          <label>
            Keywords
            <input
              value={topicKeywords}
              onChange={(event) => setTopicKeywords(event.target.value)}
              placeholder="temporal, proposal"
            />
          </label>
        </>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Create Watch"}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </form>
  );
}
