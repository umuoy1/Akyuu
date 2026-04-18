import { z } from "zod";

export const supportedLocaleSchema = z.enum(["en-US", "zh-CN"]);

export type SupportedLocale = z.infer<typeof supportedLocaleSchema>;
