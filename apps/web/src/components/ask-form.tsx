"use client";

import { useState, useTransition } from "react";

export function AskForm() {
  const [question, setQuestion] = useState("今天最值得看的 3 个 PR 是什么？");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="panel form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/ask`, {
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
            throw new Error("Failed to ask question");
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
    </form>
  );
}
