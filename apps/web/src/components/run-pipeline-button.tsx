"use client";

import { useState, useTransition } from "react";

import { getMessages } from "@akyuu/shared-i18n";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";
import { useLocale } from "./locale-provider";

export function RunPipelineButton(props: {
  digestType?: "daily" | "weekly" | "monthly";
  label?: string;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
  const locale = useLocale();
  const messages = getMessages(locale);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const digestType = props.digestType ?? "daily";

  return (
    <div className="form">
      <button
        className="button"
        disabled={isPending || props.disabled}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            try {
              const response = await fetch(`${getClientApiBaseUrl()}/api/v1/pipeline/run`, {
                method: "POST",
                headers: {
                  "content-type": "application/json"
                },
                body: JSON.stringify({
                  digestType
                })
              });

              if (!response.ok) {
                setError(await readResponseError(response, messages.api.pipelineRunFailed));
                return;
              }

              window.location.reload();
            } catch {
              setError(messages.api.pipelineRunFailed);
            }
          })
        }
      >
        {isPending ? messages.actions.running : props.label ?? messages.actions.runPipeline}
      </button>
      {props.disabledReason ? <p className="status status--info">{props.disabledReason}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  );
}
