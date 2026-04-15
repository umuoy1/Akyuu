import type { CanonicalEventType, EventScoreResult } from "@akyuu/shared-types";

const BASE_WEIGHTS: Record<CanonicalEventType, number> = {
  repo_metadata_refreshed: 0.5,
  pr_opened: 4,
  pr_merged: 8,
  issue_opened: 2,
  issue_hot: 5,
  release_published: 9,
  repo_entered_trending: 7,
  repo_left_trending: 3,
  rank_moved_up: 4,
  proposal_discussed: 6
};

export function scoreCanonicalEvent(input: {
  eventType: CanonicalEventType;
  metadata: Record<string, unknown>;
  watchPriority: number;
}): EventScoreResult {
  const baseWeight = BASE_WEIGHTS[input.eventType] ?? 1;
  const comments = Number(input.metadata.comments ?? 0);
  const reviewComments = Number(input.metadata.reviewComments ?? 0);
  const heatWeight = Math.min(5, comments * 0.4 + reviewComments * 0.3);
  const priorityWeight = input.watchPriority * 0.8;
  const noisePenalty =
    typeof input.metadata.title === "string" && /typo|chore|deps/i.test(input.metadata.title) ? 1.5 : 0;

  const score = Math.max(0, baseWeight + heatWeight + priorityWeight - noisePenalty);

  return {
    score,
    featureBreakdown: {
      baseWeight,
      heatWeight,
      priorityWeight,
      noisePenalty
    }
  };
}
