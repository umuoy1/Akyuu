"use client";

import { useState, useTransition } from "react";

import { getMessages } from "@akyuu/shared-i18n";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";
import { useLocale } from "./locale-provider";

export function AskForm() {
  const locale = useLocale();
  const messages = getMessages(locale);
  const [question, setQuestion] = useState(messages.ask.questionPlaceholder);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="panel form"
      onSubmit={(event) => {
        event.preventDefault();

        startTransition(async () => {
          setError(null);
          try {
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
              setError(await readResponseError(response, messages.ask.failed));
              return;
            }

            window.location.reload();
          } catch {
            setError(messages.ask.failed);
          }
        });
      }}
    >
      <h2>{messages.ask.followUpTitle}</h2>
      <label>
        {messages.ask.question}
        <textarea
          rows={4}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={messages.ask.questionPlaceholder}
        />
      </label>
      <button type="submit" disabled={isPending}>
        {isPending ? messages.actions.asking : messages.actions.ask}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </form>
  );
}
