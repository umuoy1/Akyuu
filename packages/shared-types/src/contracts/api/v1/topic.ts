import { z } from "zod";

export const topicUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  topicId: z.string().uuid(),
  topicName: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  evidenceCount: z.number().int(),
  windowStart: z.string(),
  windowEnd: z.string(),
  createdAt: z.string()
});

export const topicResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  aliases: z.array(z.string()),
  repoBindings: z.array(z.string()),
  keywords: z.array(z.string()),
  watchTargetId: z.string().uuid().nullable(),
  evidenceCount: z.number().int(),
  updateCount: z.number().int(),
  latestSummary: z.string().nullable(),
  latestWindowEnd: z.string().nullable(),
  recentUpdates: z.array(topicUpdateResponseSchema)
});

export const listTopicsResponseSchema = z.object({
  topics: z.array(topicResponseSchema)
});

export const topicParamsSchema = z.object({
  topicId: z.string().uuid()
});

export type TopicResponse = z.infer<typeof topicResponseSchema>;
export type TopicUpdateResponse = z.infer<typeof topicUpdateResponseSchema>;
export type ListTopicsResponse = z.infer<typeof listTopicsResponseSchema>;
