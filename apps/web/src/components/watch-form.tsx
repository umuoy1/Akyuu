"use client";

import { useState, useTransition } from "react";

import { getMessages } from "@akyuu/shared-i18n";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";
import { useLocale } from "./locale-provider";

export function WatchForm() {
  const locale = useLocale();
  const messages = getMessages(locale);
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
      try {
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
                  name: name || `${messages.nav.trends} ${scope}`,
                  priority: 3,
                  config: {
                    source: "github_trending",
                    scope
                  }
                }
              : {
                  type: "topic",
                  name: name || messages.watches.defaultTopicName,
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
          setError(await readResponseError(response, messages.api.watchCreateFailed));
          return;
        }

        window.location.reload();
      } catch {
        setError(messages.api.watchCreateFailed);
      }
    });
  };

  return (
    <form className="panel form" onSubmit={onSubmit}>
      <h2>{messages.watches.addWatch}</h2>
      <label>
        {messages.watches.type}
        <select value={watchType} onChange={(event) => setWatchType(event.target.value as "repo" | "trend" | "topic")}>
          <option value="repo">{messages.enums.watchType.repo}</option>
          <option value="topic">{messages.enums.watchType.topic}</option>
          <option value="trend">{messages.enums.watchType.trend}</option>
        </select>
      </label>

      <label>
        {messages.watches.name}
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder={messages.watches.optionalDisplayName} />
      </label>

      {watchType === "repo" ? (
        <label>
          {messages.watches.repo}
          <input value={repo} onChange={(event) => setRepo(event.target.value)} placeholder={messages.watches.repoPlaceholder} />
        </label>
      ) : watchType === "trend" ? (
        <label>
          {messages.watches.scope}
          <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder={messages.watches.scopePlaceholder} />
        </label>
      ) : (
        <>
          <label>
            {messages.watches.repoBindings}
            <input
              value={topicRepos}
              onChange={(event) => setTopicRepos(event.target.value)}
              placeholder={messages.watches.repoBindingsPlaceholder}
            />
          </label>

          <label>
            {messages.watches.aliases}
            <input
              value={topicAliases}
              onChange={(event) => setTopicAliases(event.target.value)}
              placeholder={messages.watches.aliasesPlaceholder}
            />
          </label>

          <label>
            {messages.watches.keywords}
            <input
              value={topicKeywords}
              onChange={(event) => setTopicKeywords(event.target.value)}
              placeholder={messages.watches.keywordsPlaceholder}
            />
          </label>
        </>
      )}

      <button type="submit" disabled={isPending}>
        {isPending ? messages.actions.save : messages.actions.createWatch}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </form>
  );
}
