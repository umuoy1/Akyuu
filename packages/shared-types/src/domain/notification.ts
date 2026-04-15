import { z } from "zod";

export const notificationChannelSchema = z.enum(["email", "slack", "telegram", "webhook"]);
export const notificationContentRefTypeSchema = z.enum(["digest", "alert"]);
export const notificationStatusSchema = z.enum(["pending", "sent", "failed"]);

export type NotificationChannel = z.infer<typeof notificationChannelSchema>;
export type NotificationContentRefType = z.infer<typeof notificationContentRefTypeSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export type NotificationRecord = {
  id: string;
  workspaceId: string;
  channel: NotificationChannel;
  targetAddress: string;
  contentRefType: NotificationContentRefType;
  contentRefId: string;
  status: NotificationStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
  contentTitle: string | null;
};
