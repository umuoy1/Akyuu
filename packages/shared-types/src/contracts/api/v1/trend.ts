import { z } from "zod";

export const trendItemViewSchema = z.object({
  rank: z.number().int(),
  repoFullName: z.string(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  starsToday: z.number().nullable()
});

export const movedRankSchema = z.object({
  repoFullName: z.string(),
  from: z.number().int(),
  to: z.number().int()
});

export const trendDiffResponseSchema = z.object({
  id: z.string().uuid(),
  source: z.string(),
  scope: z.string(),
  snapshotDate: z.string(),
  comparedToDate: z.string(),
  highlights: z.array(z.string()),
  newEntries: z.array(z.string()),
  leftEntries: z.array(z.string()),
  movedUp: z.array(movedRankSchema),
  movedDown: z.array(movedRankSchema),
  items: z.array(trendItemViewSchema),
  createdAt: z.string()
});

export const listTrendDiffsResponseSchema = z.object({
  trends: z.array(trendDiffResponseSchema)
});

export type TrendDiffResponse = z.infer<typeof trendDiffResponseSchema>;
export type ListTrendDiffsResponse = z.infer<typeof listTrendDiffsResponseSchema>;
