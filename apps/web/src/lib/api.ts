import { cache } from "react";

import type {
  ListAskSessionsResponse,
  DigestResponse,
  ListFeedbackResponse,
  ListDigestsResponse,
  ListNotificationsResponse,
  PreferenceProfileResponse,
  WorkspaceSettingsResponse,
  ListTopicsResponse,
  ListTrendDiffsResponse,
  ListWatchesResponse
} from "@akyuu/shared-types";

import { getApiBaseUrl } from "@akyuu/shared-config";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchWatches(): Promise<ListWatchesResponse> {
  return apiFetch<ListWatchesResponse>("/api/v1/watches");
}

export async function fetchDigests(params?: {
  q?: string;
  digestType?: "daily" | "weekly" | "monthly";
}): Promise<ListDigestsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.q) {
    searchParams.set("q", params.q);
  }

  if (params?.digestType) {
    searchParams.set("digestType", params.digestType);
  }

  const query = searchParams.size > 0 ? `?${searchParams.toString()}` : "";
  return apiFetch<ListDigestsResponse>(`/api/v1/digests${query}`);
}

export async function fetchLatestDigest(digestType: "daily" | "weekly" | "monthly" = "daily"): Promise<DigestResponse | null> {
  try {
    return await apiFetch<DigestResponse>(`/api/v1/digests/latest?digestType=${digestType}`);
  } catch {
    return null;
  }
}

export async function fetchDigestById(digestId: string): Promise<DigestResponse | null> {
  try {
    return await apiFetch<DigestResponse>(`/api/v1/digests/${digestId}`);
  } catch {
    return null;
  }
}

export async function fetchTopics(): Promise<ListTopicsResponse> {
  return apiFetch<ListTopicsResponse>("/api/v1/topics");
}

export async function fetchAskSessions(): Promise<ListAskSessionsResponse> {
  return apiFetch<ListAskSessionsResponse>("/api/v1/ask/sessions");
}

export async function fetchTrends(): Promise<ListTrendDiffsResponse> {
  return apiFetch<ListTrendDiffsResponse>("/api/v1/trends");
}

export async function fetchFeedback(): Promise<ListFeedbackResponse> {
  return apiFetch<ListFeedbackResponse>("/api/v1/feedback");
}

export async function fetchNotifications(): Promise<ListNotificationsResponse> {
  return apiFetch<ListNotificationsResponse>("/api/v1/notifications");
}

export async function fetchPreferenceProfile(): Promise<PreferenceProfileResponse> {
  return apiFetch<PreferenceProfileResponse>("/api/v1/preferences");
}

export const fetchWorkspaceSettings = cache(async (): Promise<WorkspaceSettingsResponse> => {
  return apiFetch<WorkspaceSettingsResponse>("/api/v1/settings");
});
