import { z } from "zod";

export const entityTypeSchema = z.enum([
  "repo",
  "org",
  "pr",
  "issue",
  "release",
  "person",
  "commit",
  "topic_candidate"
]);

export const canonicalEventTypeSchema = z.enum([
  "repo_metadata_refreshed",
  "pr_opened",
  "pr_merged",
  "issue_opened",
  "issue_hot",
  "release_published",
  "repo_entered_trending",
  "repo_left_trending",
  "rank_moved_up",
  "proposal_discussed"
]);

export type EntityType = z.infer<typeof entityTypeSchema>;
export type CanonicalEventType = z.infer<typeof canonicalEventTypeSchema>;

export type CanonicalEntityRecord = {
  id: string;
  entityType: EntityType;
  externalSource: string;
  externalKey: string;
  displayName: string;
  normalizedName: string;
  metadata: Record<string, unknown>;
};

export type CanonicalEventRecord = {
  id: string;
  eventType: CanonicalEventType;
  occurredAt: string;
  sourceSignalId?: string | null;
  sourceSnapshotId?: string | null;
  subjectEntityId: string;
  actorEntityId?: string | null;
  repoEntityId?: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
  dedupeKey: string;
};
