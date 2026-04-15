export type TrendingItem = {
  rank: number;
  repoFullName: string;
  description: string | null;
  language: string | null;
  starsToday: number | null;
};

export type TrendDiffSummary = {
  newEntries: string[];
  leftEntries: string[];
  movedUp: Array<{ repoFullName: string; from: number; to: number }>;
  movedDown: Array<{ repoFullName: string; from: number; to: number }>;
  highlights: string[];
};
