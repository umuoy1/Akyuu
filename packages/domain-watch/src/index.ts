import { createWatchInputSchema, type CreateWatchInput, type WatchRecord } from "@akyuu/shared-types";

export function normalizeCreateWatchInput(input: unknown): CreateWatchInput {
  return createWatchInputSchema.parse(input);
}

export function isRepoWatch(watch: WatchRecord): boolean {
  return watch.type === "repo";
}

export function isTrendWatch(watch: WatchRecord): boolean {
  return watch.type === "trend";
}
