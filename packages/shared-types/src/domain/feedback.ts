import { z } from "zod";

export const feedbackTypeSchema = z.enum([
  "worthwhile",
  "not_worthwhile",
  "more_like_this",
  "less_like_this",
  "opened",
  "clicked"
]);

export const feedbackTargetTypeSchema = z.enum(["digest", "recommended_item", "topic_update"]);

export type FeedbackType = z.infer<typeof feedbackTypeSchema>;
export type FeedbackTargetType = z.infer<typeof feedbackTargetTypeSchema>;

export type FeedbackRecord = {
  id: string;
  workspaceId: string;
  userId: string;
  targetType: FeedbackTargetType;
  targetId: string;
  feedbackType: FeedbackType;
  value: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};
