"use client";

import { useTransition } from "react";

export function RunPipelineButton(props: {
  digestType?: "daily" | "weekly" | "monthly";
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const digestType = props.digestType ?? "daily";

  return (
    <button
      className="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/pipeline/run`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              digestType
            })
          });

          if (!response.ok) {
            throw new Error("Failed to run pipeline");
          }

          window.location.reload();
        })
      }
    >
      {isPending ? "Running..." : props.label ?? "Run Pipeline"}
    </button>
  );
}
