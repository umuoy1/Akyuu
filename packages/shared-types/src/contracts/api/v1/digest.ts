import { z } from "zod";

export const digestSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  bullets: z.array(z.string()),
  markdown: z.string()
});

export const recommendedItemSchema = z.object({
  id: z.string().uuid(),
  itemType: z.enum(["pr", "issue", "repo", "topic", "release"]),
  title: z.string(),
  href: z.string().nullable(),
  reason: z.string(),
  score: z.number()
});

export const digestResponseSchema = z.object({
  id: z.string().uuid(),
  digestType: z.enum(["daily", "weekly", "monthly"]),
  title: z.string(),
  summary: z.string(),
  renderedMarkdown: z.string(),
  windowStart: z.string(),
  windowEnd: z.string(),
  createdAt: z.string(),
  sections: z.array(digestSectionSchema),
  recommendedItems: z.array(recommendedItemSchema)
});

export const listDigestsResponseSchema = z.object({
  digests: z.array(digestResponseSchema)
});

export const runPipelineRequestSchema = z.object({
  date: z.string().optional(),
  digestType: z.enum(["daily", "weekly", "monthly"]).default("daily")
});

export const runPipelineResponseSchema = z.object({
  digestId: z.string().uuid()
});

export type DigestResponse = z.infer<typeof digestResponseSchema>;
export type ListDigestsResponse = z.infer<typeof listDigestsResponseSchema>;
export type RunPipelineRequest = z.infer<typeof runPipelineRequestSchema>;
export type RunPipelineResponse = z.infer<typeof runPipelineResponseSchema>;
