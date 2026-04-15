"use client";

import { useTransition } from "react";

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
}) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/feedback`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error("Failed to save feedback");
  }
}

export function FeedbackActions({ targetType, targetId, metadata }: FeedbackActionsProps) {
  const [isPending, startTransition] = useTransition();

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
            await sendFeedback(buildPayload("worthwhile"));
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
            await sendFeedback(buildPayload("not_worthwhile"));
            window.location.reload();
          })
        }
      >
        {isPending ? "Saving..." : "Not Worthwhile"}
      </button>
    </div>
  );
}
