"use client";

import { useState, useTransition } from "react";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";

type FeedbackActionsProps = {
  targetType: "digest" | "recommended_item" | "topic_update";
  targetId: string;
  metadata?: Record<string, unknown>;
};

async function sendFeedback(input: {
  targetType: FeedbackActionsProps["targetType"];
  targetId: string;
  feedbackType: "worthwhile" | "not_worthwhile";
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const response = await fetch(`${getClientApiBaseUrl()}/api/v1/feedback`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    return readResponseError(response, "Failed to save feedback");
  }

  return null;
}

export function FeedbackActions({ targetType, targetId, metadata }: FeedbackActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function buildPayload(feedbackType: "worthwhile" | "not_worthwhile") {
    const payload: {
      targetType: FeedbackActionsProps["targetType"];
      targetId: string;
      feedbackType: "worthwhile" | "not_worthwhile";
      metadata?: Record<string, unknown>;
    } = {
      targetType,
      targetId,
      feedbackType
    };

    if (metadata) {
      payload.metadata = metadata;
    }

    return payload;
  }

  return (
    <div className="feedback-actions">
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const message = await sendFeedback(buildPayload("worthwhile"));
            if (message) {
              setError(message);
              return;
            }
            window.location.reload();
          })
        }
      >
        {isPending ? "Saving..." : "Worthwhile"}
      </button>
      <button
        type="button"
        disabled={isPending}
        className="button button--secondary"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const message = await sendFeedback(buildPayload("not_worthwhile"));
            if (message) {
              setError(message);
              return;
            }
            window.location.reload();
          })
        }
      >
        {isPending ? "Saving..." : "Not Worthwhile"}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  );
}
