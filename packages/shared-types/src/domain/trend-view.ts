export type TrendItemView = {
  rank: number;
  repoFullName: string;
  description: string | null;
  language: string | null;
  starsToday: number | null;
};

export type TrendDiffView = {
  id: string;
  source: string;
  scope: string;
  snapshotDate: string;
  comparedToDate: string;
  highlights: string[];
  newEntries: string[];
  leftEntries: string[];
  movedUp: Array<{ repoFullName: string; from: number; to: number }>;
  movedDown: Array<{ repoFullName: string; from: number; to: number }>;
  items: TrendItemView[];
  createdAt: string;
};
