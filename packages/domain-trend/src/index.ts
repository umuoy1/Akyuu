import { getMessages } from "@akyuu/shared-i18n";
import type { SupportedLocale, TrendDiffSummary, TrendingItem } from "@akyuu/shared-types";

export function buildTrendDiffSummary(
  previousItems: TrendingItem[],
  currentItems: TrendingItem[],
  locale: SupportedLocale
): TrendDiffSummary {
  const messages = getMessages(locale);
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
    highlights.push(messages.trend.newEntries(newEntries));
  }
  if (movedUp.length > 0) {
    highlights.push(messages.trend.fastRisers(movedUp));
  }
  if (leftEntries.length > 0) {
    highlights.push(messages.trend.leftTrending(leftEntries));
  }

  return {
    newEntries,
    leftEntries,
    movedUp,
    movedDown,
    highlights
  };
}
