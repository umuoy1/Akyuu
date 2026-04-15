import { z } from "zod";

export const watchTypeSchema = z.enum(["repo", "topic", "trend", "rank_feed"]);
export type WatchType = z.infer<typeof watchTypeSchema>;

export const watchStatusSchema = z.enum(["active", "paused", "archived"]);
export type WatchStatus = z.infer<typeof watchStatusSchema>;

export const repoWatchConfigSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullsLimit: z.coerce.number().int().min(1).max(10).default(5),
  issuesLimit: z.coerce.number().int().min(1).max(10).default(5)
});

export const topicWatchConfigSchema = z.object({
  aliases: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  repoBindings: z.array(z.string()).default([]),
  topicId: z.string().uuid().optional(),
  topicSlug: z.string().optional()
});

export const trendWatchConfigSchema = z.object({
  source: z.enum(["github_trending"]).default("github_trending"),
  scope: z.string().default("global")
});

export const rankFeedWatchConfigSchema = z.object({
  source: z.enum(["github_weekly_rank"]).default("github_weekly_rank"),
  cadence: z.enum(["weekly"]).default("weekly")
});

export const watchConfigSchema = z.union([
  repoWatchConfigSchema,
  topicWatchConfigSchema,
  trendWatchConfigSchema,
  rankFeedWatchConfigSchema
]);

export type RepoWatchConfig = z.infer<typeof repoWatchConfigSchema>;
export type TopicWatchConfig = z.infer<typeof topicWatchConfigSchema>;
export type TrendWatchConfig = z.infer<typeof trendWatchConfigSchema>;
export type RankFeedWatchConfig = z.infer<typeof rankFeedWatchConfigSchema>;
export type WatchConfig = z.infer<typeof watchConfigSchema>;

export const createWatchInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("repo"),
    name: z.string().min(1),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    config: repoWatchConfigSchema
  }),
  z.object({
    type: z.literal("trend"),
    name: z.string().min(1),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    config: trendWatchConfigSchema
  }),
  z.object({
    type: z.literal("topic"),
    name: z.string().min(1),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    config: topicWatchConfigSchema
  }),
  z.object({
    type: z.literal("rank_feed"),
    name: z.string().min(1),
    priority: z.coerce.number().int().min(1).max(5).default(3),
    config: rankFeedWatchConfigSchema
  })
]);

export type CreateWatchInput = z.infer<typeof createWatchInputSchema>;

export type WatchRecord = {
  id: string;
  workspaceId: string;
  type: WatchType;
  name: string;
  status: WatchStatus;
  priority: number;
  config: WatchConfig;
  createdAt: string;
  updatedAt: string;
};

export function getRepoFullName(config: RepoWatchConfig): string {
  return `${config.owner}/${config.repo}`;
}
