import type { FeedbackType, PreferenceProfileView } from "@akyuu/shared-types";

type FeedbackSignalInput = {
  feedbackType: FeedbackType;
  metadata: Record<string, unknown>;
};

type PreferenceCandidate = {
  itemType: string;
  repoFullName?: string | null;
};

function getFeedbackWeight(feedbackType: FeedbackType): number {
  if (feedbackType === "worthwhile" || feedbackType === "more_like_this") {
    return 1;
  }

  if (feedbackType === "not_worthwhile" || feedbackType === "less_like_this") {
    return -1;
  }

  return 0;
}

export function extractRepoFullName(input: {
  repoFullName?: unknown;
  href?: unknown;
}): string | null {
  if (typeof input.repoFullName === "string" && input.repoFullName.trim()) {
    return input.repoFullName.trim().toLowerCase();
  }

  if (typeof input.href !== "string" || !input.href.trim()) {
    return null;
  }

  try {
    const url = new URL(input.href);
    if (!url.hostname.includes("github.com")) {
      return null;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    return `${segments[0]}/${segments[1]}`.replace(/\.git$/i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function buildPreferenceProfile(input: {
  workspaceId: string;
  subjectId: string;
  updatedAt: string;
  feedbackSignals: FeedbackSignalInput[];
}): PreferenceProfileView {
  const itemTypeWeights: Record<string, number> = {};
  const repoWeights: Record<string, number> = {};
  let feedbackCount = 0;

  for (const signal of input.feedbackSignals) {
    const weight = getFeedbackWeight(signal.feedbackType);
    if (weight === 0) {
      continue;
    }

    feedbackCount += 1;

    if (typeof signal.metadata.itemType === "string" && signal.metadata.itemType.trim()) {
      const itemType = signal.metadata.itemType.trim().toLowerCase();
      itemTypeWeights[itemType] = (itemTypeWeights[itemType] ?? 0) + weight;
    }

    const repoFullName = extractRepoFullName({
      repoFullName: signal.metadata.repoFullName,
      href: signal.metadata.href
    });

    if (repoFullName) {
      repoWeights[repoFullName] = (repoWeights[repoFullName] ?? 0) + weight;
    }
  }

  return {
    workspaceId: input.workspaceId,
    subjectType: "workspace",
    subjectId: input.subjectId,
    version: "v1",
    updatedAt: input.updatedAt,
    profile: {
      feedbackCount,
      itemTypeWeights,
      repoWeights
    }
  };
}

export function getPreferenceBonus(
  profile: PreferenceProfileView | null,
  candidate: PreferenceCandidate
): number {
  if (!profile) {
    return 0;
  }

  const itemTypeWeight = profile.profile.itemTypeWeights[candidate.itemType.toLowerCase()] ?? 0;
  const repoWeight = candidate.repoFullName ? profile.profile.repoWeights[candidate.repoFullName.toLowerCase()] ?? 0 : 0;

  return Math.max(-6, Math.min(6, itemTypeWeight * 3 + repoWeight * 1.25));
}
