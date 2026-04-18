"use client";

import { useState, useTransition } from "react";

import { getMessages } from "@akyuu/shared-i18n";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";
import { useLocale } from "./locale-provider";

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
}, fallback: string): Promise<string | null> {
  try {
    const response = await fetch(`${getClientApiBaseUrl()}/api/v1/feedback`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      return readResponseError(response, fallback);
    }
  } catch {
    return fallback;
  }

  return null;
}

export function FeedbackActions({ targetType, targetId, metadata }: FeedbackActionsProps) {
  const locale = useLocale();
  const messages = getMessages(locale);
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
            const message = await sendFeedback(buildPayload("worthwhile"), messages.api.feedbackPersistFailed);
            if (message) {
              setError(message);
              return;
            }
            window.location.reload();
          })
        }
      >
        {isPending ? messages.actions.save : messages.actions.worthwhile}
      </button>
      <button
        type="button"
        disabled={isPending}
        className="button button--secondary"
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const message = await sendFeedback(buildPayload("not_worthwhile"), messages.api.feedbackPersistFailed);
            if (message) {
              setError(message);
              return;
            }
            window.location.reload();
          })
        }
      >
        {isPending ? messages.actions.save : messages.actions.notWorthwhile}
      </button>
      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  );
}
