import { z } from "zod";

export const preferenceSubjectTypeSchema = z.enum(["workspace", "user"]);

export const preferenceProfileBodySchema = z.object({
  feedbackCount: z.number().int(),
  itemTypeWeights: z.record(z.string(), z.number()),
  repoWeights: z.record(z.string(), z.number())
});

export const preferenceProfileSchema = z.object({
  workspaceId: z.string().uuid(),
  subjectType: preferenceSubjectTypeSchema,
  subjectId: z.string().uuid(),
  version: z.string(),
  updatedAt: z.string(),
  profile: preferenceProfileBodySchema
});

export type PreferenceSubjectType = z.infer<typeof preferenceSubjectTypeSchema>;
export type PreferenceProfileBody = z.infer<typeof preferenceProfileBodySchema>;
export type PreferenceProfileView = z.infer<typeof preferenceProfileSchema>;
