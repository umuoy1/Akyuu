export type EventScoreBreakdown = {
  baseWeight: number;
  heatWeight: number;
  priorityWeight: number;
  noisePenalty: number;
};

export type EventScoreResult = {
  score: number;
  featureBreakdown: EventScoreBreakdown;
};
