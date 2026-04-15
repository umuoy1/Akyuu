export type JobTrigger = "scheduler" | "api" | "replay" | "manual";

export type JobEnvelope<TPayload> = {
  payloadVersion: number;
  idempotencyKey: string;
  requestedAt: string;
  trigger: JobTrigger;
  traceId?: string;
  payload: TPayload;
};

export type QueueName =
  | "scheduler"
  | "ingest.poll"
  | "ingest.snapshot"
  | "normalize.event"
  | "enrich.detail"
  | "topic.match"
  | "trend.diff"
  | "score.rank"
  | "digest.build"
  | "ask.retrieve"
  | "notify.send"
  | "maintenance.rebuild";
