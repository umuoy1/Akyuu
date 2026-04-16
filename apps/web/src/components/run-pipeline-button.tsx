"use client";

import { useState, useTransition } from "react";

import { getClientApiBaseUrl, readResponseError } from "../lib/client-request";

export function RunPipelineButton(props: {
  digestType?: "daily" | "weekly" | "monthly";
  label?: string;
  disabled?: boolean;
  disabledReason?: string | null;
}) {
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
              setError(await readResponseError(response, "Failed to run pipeline"));
              return;
            }

            window.location.reload();
          })
        }
      >
        {isPending ? "Running..." : props.label ?? "Run Pipeline"}
      </button>
      {props.disabledReason ? <p className="status status--info">{props.disabledReason}</p> : null}
      {error ? <p className="status status--error">{error}</p> : null}
    </div>
  );
}
