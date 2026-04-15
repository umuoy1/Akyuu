import type { CanonicalEventType, EntityType } from "@akyuu/shared-types";

type EntitySeed = {
  entityType: EntityType;
  externalSource: string;
  externalKey: string;
  displayName: string;
  normalizedName: string;
  metadata: Record<string, unknown>;
};

type EventSeed = {
  eventType: CanonicalEventType;
  occurredAt: string;
  subjectExternalKey: string;
  repoExternalKey?: string;
  actorExternalKey?: string;
  metadata: Record<string, unknown>;
  dedupeKey: string;
};

type NormalizedSignal = {
  entities: EntitySeed[];
  event: EventSeed;
  relations: Array<{
    entityExternalKey: string;
    relationType: string;
    metadata: Record<string, unknown>;
  }>;
};

function asRecord(payload: unknown): Record<string, any> {
  return payload as Record<string, any>;
}

function normalizeRepo(sourceKey: string, payload: Record<string, any>): EntitySeed {
  return {
    entityType: "repo",
    externalSource: "github",
    externalKey: sourceKey,
    displayName: payload.full_name ?? sourceKey,
    normalizedName: String(payload.full_name ?? sourceKey).toLowerCase(),
    metadata: {
      stargazersCount: payload.stargazers_count,
      forksCount: payload.forks_count,
      htmlUrl: payload.html_url
    }
  };
}

export function normalizeRawSignal(input: {
  sourceType: string;
  sourceKey: string;
  occurredAt: string;
  payload: unknown;
}): NormalizedSignal | null {
  const payload = asRecord(input.payload);
  const repoEntity = normalizeRepo(input.sourceKey, payload.base?.repo ?? payload);

  switch (input.sourceType) {
    case "github_repo_metadata":
      return {
        entities: [repoEntity],
        event: {
          eventType: "repo_metadata_refreshed",
          occurredAt: input.occurredAt,
          subjectExternalKey: repoEntity.externalKey,
          repoExternalKey: repoEntity.externalKey,
          metadata: {
            description: payload.description ?? null,
            htmlUrl: payload.html_url ?? null
          },
          dedupeKey: `github:repo_metadata_refreshed:${repoEntity.externalKey}:${input.occurredAt}`
        },
        relations: []
      };
    case "github_pull_request": {
      const actor = payload.user
        ? {
            entityType: "person" as const,
            externalSource: "github",
            externalKey: payload.user.login,
            displayName: payload.user.login,
            normalizedName: String(payload.user.login).toLowerCase(),
            metadata: {
              htmlUrl: payload.user.html_url ?? null
            }
          }
        : null;

      const prEntity = {
        entityType: "pr" as const,
        externalSource: "github",
        externalKey: `${input.sourceKey}#${payload.number}`,
        displayName: `${input.sourceKey}#${payload.number}`,
        normalizedName: `${input.sourceKey}#${payload.number}`.toLowerCase(),
        metadata: {
          title: payload.title,
          state: payload.state,
          htmlUrl: payload.html_url,
          comments: payload.comments ?? 0,
          reviewComments: payload.review_comments ?? 0,
          mergedAt: payload.merged_at
        }
      };

      return {
        entities: [repoEntity, prEntity, ...(actor ? [actor] : [])],
        event: {
          eventType: payload.merged_at ? "pr_merged" : "pr_opened",
          occurredAt: input.occurredAt,
          subjectExternalKey: prEntity.externalKey,
          repoExternalKey: repoEntity.externalKey,
          actorExternalKey: actor?.externalKey,
          metadata: {
            title: payload.title,
            body: payload.body ?? "",
            htmlUrl: payload.html_url,
            comments: payload.comments ?? 0,
            reviewComments: payload.review_comments ?? 0,
            state: payload.state
          },
          dedupeKey: payload.merged_at
            ? `github:pr_merged:${prEntity.externalKey}:${payload.merged_at}`
            : `github:pr_opened:${prEntity.externalKey}`
        },
        relations: actor
          ? [
              {
                entityExternalKey: actor.externalKey,
                relationType: "actor",
                metadata: {}
              }
            ]
          : []
      };
    }
    case "github_issue": {
      const actor = payload.user
        ? {
            entityType: "person" as const,
            externalSource: "github",
            externalKey: payload.user.login,
            displayName: payload.user.login,
            normalizedName: String(payload.user.login).toLowerCase(),
            metadata: {
              htmlUrl: payload.user.html_url ?? null
            }
          }
        : null;

      const issueEntity = {
        entityType: "issue" as const,
        externalSource: "github",
        externalKey: `${input.sourceKey}#${payload.number}`,
        displayName: `${input.sourceKey}#${payload.number}`,
        normalizedName: `${input.sourceKey}#${payload.number}`.toLowerCase(),
        metadata: {
          title: payload.title,
          state: payload.state,
          htmlUrl: payload.html_url,
          comments: payload.comments ?? 0
        }
      };

      const eventType: CanonicalEventType = (payload.comments ?? 0) >= 5 ? "issue_hot" : "issue_opened";

      return {
        entities: [repoEntity, issueEntity, ...(actor ? [actor] : [])],
        event: {
          eventType,
          occurredAt: input.occurredAt,
          subjectExternalKey: issueEntity.externalKey,
          repoExternalKey: repoEntity.externalKey,
          actorExternalKey: actor?.externalKey,
          metadata: {
            title: payload.title,
            body: payload.body ?? "",
            htmlUrl: payload.html_url,
            comments: payload.comments ?? 0,
            labels: Array.isArray(payload.labels) ? payload.labels.map((label: any) => label.name) : []
          },
          dedupeKey: `github:${eventType}:${issueEntity.externalKey}:${input.occurredAt}`
        },
        relations: actor
          ? [
              {
                entityExternalKey: actor.externalKey,
                relationType: "actor",
                metadata: {}
              }
            ]
          : []
      };
    }
    case "github_release": {
      const releaseEntity = {
        entityType: "release" as const,
        externalSource: "github",
        externalKey: `${input.sourceKey}@release:${payload.tag_name}`,
        displayName: `${input.sourceKey}@${payload.tag_name}`,
        normalizedName: `${input.sourceKey}@${payload.tag_name}`.toLowerCase(),
        metadata: {
          name: payload.name ?? payload.tag_name,
          htmlUrl: payload.html_url
        }
      };

      return {
        entities: [repoEntity, releaseEntity],
        event: {
          eventType: "release_published",
          occurredAt: input.occurredAt,
          subjectExternalKey: releaseEntity.externalKey,
          repoExternalKey: repoEntity.externalKey,
          metadata: {
            title: payload.name ?? payload.tag_name,
            body: payload.body ?? "",
            htmlUrl: payload.html_url,
            tagName: payload.tag_name
          },
          dedupeKey: `github:release_published:${releaseEntity.externalKey}`
        },
        relations: []
      };
    }
    default:
      return null;
  }
}

export function normalizeRawSnapshot(input: {
  source: string;
  scope: string;
  snapshotDate: string;
  items: Array<{
    rank: number;
    repoFullName: string;
    description: string | null;
    language: string | null;
    starsToday: number | null;
  }>;
}) {
  return {
    source: input.source,
    scope: input.scope,
    snapshotDate: input.snapshotDate,
    items: input.items.map((item) => ({
      rank: item.rank,
      repoFullName: item.repoFullName,
      description: item.description,
      language: item.language,
      metricPrimary: item.starsToday
    }))
  };
}
