import { z } from "zod";

export const askAnchorTypeSchema = z.enum(["digest", "topic", "history", "search"]);

export const askRequestSchema = z.object({
  question: z.string().trim().min(3),
  anchorType: askAnchorTypeSchema.default("digest"),
  anchorId: z.string().uuid().optional()
});

export const askEvidenceItemSchema = z.object({
  sourceType: z.enum(["digest_section", "recommended_item", "topic_update"]),
  sourceId: z.string().uuid().nullable(),
  label: z.string(),
  href: z.string().nullable()
});

export const askTopicContextSchema = z.object({
  topicId: z.string().uuid(),
  topicName: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
  windowEnd: z.string()
});

export const askRetrievalContextSchema = z.object({
  digestId: z.string().uuid().nullable(),
  digestTitle: z.string().nullable(),
  digestSummary: z.string().nullable(),
  digestBullets: z.array(z.string()),
  recommendedItems: z.array(
    z.object({
      id: z.string().uuid(),
      title: z.string(),
      href: z.string().nullable(),
      reason: z.string(),
      score: z.number()
    })
  ),
  topics: z.array(askTopicContextSchema),
  evidence: z.array(askEvidenceItemSchema)
});

export const askSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  anchorType: askAnchorTypeSchema,
  anchorId: z.string().uuid().nullable(),
  question: z.string(),
  answerMarkdown: z.string(),
  llmVersion: z.string(),
  createdAt: z.string(),
  retrievalContext: askRetrievalContextSchema
});

export const listAskSessionsResponseSchema = z.object({
  sessions: z.array(askSessionResponseSchema)
});

export type AskRequest = z.infer<typeof askRequestSchema>;
export type AskSessionResponse = z.infer<typeof askSessionResponseSchema>;
export type ListAskSessionsResponse = z.infer<typeof listAskSessionsResponseSchema>;
