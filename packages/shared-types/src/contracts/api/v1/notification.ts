import { z } from "zod";

import {
  notificationChannelSchema,
  notificationContentRefTypeSchema,
  notificationStatusSchema
} from "../../../domain/notification.js";

export const notificationResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  channel: notificationChannelSchema,
  targetAddress: z.string(),
  contentRefType: notificationContentRefTypeSchema,
  contentRefId: z.string().uuid(),
  status: notificationStatusSchema,
  attemptCount: z.number().int(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  sentAt: z.string().nullable(),
  contentTitle: z.string().nullable()
});

export const listNotificationsResponseSchema = z.object({
  notifications: z.array(notificationResponseSchema)
});

export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;
