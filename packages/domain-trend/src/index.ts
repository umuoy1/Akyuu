import type { TrendDiffSummary, TrendingItem } from "@akyuu/shared-types";

export function buildTrendDiffSummary(
  previousItems: TrendingItem[],
  currentItems: TrendingItem[]
): TrendDiffSummary {
  const previousByRepo = new Map(previousItems.map((item) => [item.repoFullName, item]));
  const currentByRepo = new Map(currentItems.map((item) => [item.repoFullName, item]));

  const newEntries = currentItems
    .filter((item) => !previousByRepo.has(item.repoFullName))
    .map((item) => item.repoFullName);
  const leftEntries = previousItems
    .filter((item) => !currentByRepo.has(item.repoFullName))
    .map((item) => item.repoFullName);

  const movedUp = currentItems
    .map((item) => {
      const previous = previousByRepo.get(item.repoFullName);
      if (!previous || previous.rank <= item.rank) {
        return null;
      }

      return {
        repoFullName: item.repoFullName,
        from: previous.rank,
        to: item.rank
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const movedDown = currentItems
    .map((item) => {
      const previous = previousByRepo.get(item.repoFullName);
      if (!previous || previous.rank >= item.rank) {
        return null;
      }

      return {
        repoFullName: item.repoFullName,
        from: previous.rank,
        to: item.rank
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const highlights: string[] = [];

  if (newEntries.length > 0) {
    highlights.push(`New entries: ${newEntries.slice(0, 3).join(", ")}`);
  }
  if (movedUp.length > 0) {
    highlights.push(
      `Fast risers: ${movedUp
        .slice(0, 3)
        .map((item) => `${item.repoFullName} ${item.from}->${item.to}`)
        .join(", ")}`
    );
  }
  if (leftEntries.length > 0) {
    highlights.push(`Left trending: ${leftEntries.slice(0, 3).join(", ")}`);
  }

  return {
    newEntries,
    leftEntries,
    movedUp,
    movedDown,
    highlights
  };
}
