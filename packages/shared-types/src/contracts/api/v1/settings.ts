import { z } from "zod";

import { supportedLocaleSchema } from "../../../domain/locale.js";

export const workspaceSettingsResponseSchema = z.object({
  locale: supportedLocaleSchema,
  timezone: z.string()
});

export const updateWorkspaceSettingsRequestSchema = z.object({
  locale: supportedLocaleSchema
});

export type WorkspaceSettingsResponse = z.infer<typeof workspaceSettingsResponseSchema>;
export type UpdateWorkspaceSettingsRequest = z.infer<typeof updateWorkspaceSettingsRequestSchema>;
