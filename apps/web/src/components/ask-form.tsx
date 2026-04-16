"use client";

import { useState, useTransition } from "react";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";

export function AskForm() {
  const [question, setQuestion] = useState("今天最值得看的 3 个 PR 是什么？");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          setError(null);

          const response = await fetch(`${getClientApiBaseUrl()}/api/v1/ask`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              question,
              anchorType: "digest"
            })
          });

          if (!response.ok) {
            setError(await readResponseError(response, "Failed to ask question"));
            return;
          }

          window.location.reload();
        });
      }}
    >
      <h2>Ask Follow-up</h2>
      <label>
        Question
        <textarea
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="今天最值得看的 3 个 PR 是什么？"
        />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? "Asking..." : "Ask"}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </form>
  );
}
