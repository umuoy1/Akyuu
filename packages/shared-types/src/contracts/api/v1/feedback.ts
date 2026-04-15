import { z } from "zod";

import { feedbackTargetTypeSchema, feedbackTypeSchema } from "../../../domain/feedback.js";

export const createFeedbackRequestSchema = z.object({
  targetType: feedbackTargetTypeSchema,
  targetId: z.string().uuid(),
  feedbackType: feedbackTypeSchema,
  value: z.number().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const feedbackResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  targetType: feedbackTargetTypeSchema,
  targetId: z.string().uuid(),
  feedbackType: feedbackTypeSchema,
  value: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string()
});

export const listFeedbackResponseSchema = z.object({
  feedback: z.array(feedbackResponseSchema)
});

export type CreateFeedbackRequest = z.infer<typeof createFeedbackRequestSchema>;
export type FeedbackResponse = z.infer<typeof feedbackResponseSchema>;
export type ListFeedbackResponse = z.infer<typeof listFeedbackResponseSchema>;
