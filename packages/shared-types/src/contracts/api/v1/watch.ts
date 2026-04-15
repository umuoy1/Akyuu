import { z } from "zod";

import {
  createWatchInputSchema,
  watchStatusSchema,
  watchTypeSchema
} from "../../../domain/watch.js";

export const watchResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  type: watchTypeSchema,
  name: z.string(),
  status: watchStatusSchema,
  priority: z.number().int(),
  config: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const listWatchesResponseSchema = z.object({
  watches: z.array(watchResponseSchema)
});

export const createWatchRequestSchema = createWatchInputSchema;

export const deleteWatchParamsSchema = z.object({
  watchId: z.string().uuid()
});

export type WatchResponse = z.infer<typeof watchResponseSchema>;
export type ListWatchesResponse = z.infer<typeof listWatchesResponseSchema>;
export type CreateWatchRequest = z.infer<typeof createWatchRequestSchema>;
