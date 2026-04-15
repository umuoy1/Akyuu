"use client";

import { useState, useTransition } from "react";

export function WatchForm() {
  const [watchType, setWatchType] = useState<"repo" | "trend" | "topic">("repo");
  const [name, setName] = useState("");
  const [repo, setRepo] = useState("nodejs/node");
  const [scope, setScope] = useState("global");
  const [topicAliases, setTopicAliases] = useState("agent, ai agent");
  const [topicKeywords, setTopicKeywords] = useState("agent, llm");
  const [topicRepos, setTopicRepos] = useState("openai/codex, microsoft/typescript");
  const [isPending, startTransition] = useTransition();

  const splitCsv = (value: string) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
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

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/watches`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error("Failed to create watch");
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
    </form>
  );
}
