import { Job, Queue, QueueEvents, Worker } from "bullmq";
import { Redis } from "ioredis";

import { getEnv } from "@akyuu/shared-config";
import type { JobEnvelope, QueueName } from "@akyuu/shared-types";

export const QUEUE_NAMES: QueueName[] = [
  "scheduler",
  "ingest.poll",
  "ingest.snapshot",
  "normalize.event",
  "enrich.detail",
  "topic.match",
  "trend.diff",
  "score.rank",
  "digest.build",
  "ask.retrieve",
  "notify.send",
  "maintenance.rebuild"
];

const env = getEnv();
const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

const queues = new Map<QueueName, Queue>();
const queueEventsMap = new Map<QueueName, QueueEvents>();

export function getRedisConnection(): Redis {
  return connection;
}

export function getQueue(name: QueueName): Queue {
  const existing = queues.get(name);

  if (existing) {
    return existing;
  }

  const queue = new Queue(name, {
    connection
  });

  queues.set(name, queue);
  return queue;
}

export function getQueueEvents(name: QueueName): QueueEvents {
  const existing = queueEventsMap.get(name);

  if (existing) {
    return existing;
  }

  const queueEvents = new QueueEvents(name, {
    connection
  });

  queueEventsMap.set(name, queueEvents);
  return queueEvents;
}

export async function enqueueJob<TPayload>(
  queueName: QueueName,
  jobName: string,
  envelope: JobEnvelope<TPayload>
): Promise<Job<JobEnvelope<TPayload>>> {
  const safeJobId = `${jobName}__${envelope.idempotencyKey}`.replace(/[:\s/]/g, "_");

  return getQueue(queueName).add(jobName, envelope, {
    jobId: safeJobId,
    removeOnComplete: 500,
    removeOnFail: 500
  });
}

export async function waitForJobResult<TPayload, TResult>(
  queueName: QueueName,
  job: Job<JobEnvelope<TPayload>>,
  timeout = 120_000
): Promise<TResult> {
  const queueEvents = getQueueEvents(queueName);
  const result = await job.waitUntilFinished(queueEvents, timeout);

  return result as TResult;
}

export function createQueueWorker<TPayload, TResult>(
  queueName: QueueName,
  handler: (job: Job<JobEnvelope<TPayload>>) => Promise<TResult>,
  concurrency = 5
): Worker<JobEnvelope<TPayload>, TResult> {
  return new Worker<JobEnvelope<TPayload>, TResult>(queueName, handler, {
    connection,
    concurrency
  });
}

export async function closeQueueResources(): Promise<void> {
  await Promise.all([
    ...Array.from(queues.values()).map((queue) => queue.close()),
    ...Array.from(queueEventsMap.values()).map((events) => events.close())
  ]);
  await connection.quit();
}
