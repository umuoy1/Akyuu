import { describe, expect, it } from "vitest";

import { buildPreferenceProfile, extractRepoFullName, getPreferenceBonus } from "./index.js";

describe("domain-feedback", () => {
  it("extracts repo full name from metadata or GitHub href", () => {
    expect(extractRepoFullName({ repoFullName: "Nodejs/Node" })).toBe("nodejs/node");
    expect(extractRepoFullName({ href: "https://github.com/nodejs/node/pull/1" })).toBe("nodejs/node");
    expect(extractRepoFullName({ href: "https://example.com/x/y" })).toBeNull();
  });

  it("builds workspace preference weights and returns a ranking bonus", () => {
    const profile = buildPreferenceProfile({
      workspaceId: "811ddd33-7124-4c7e-811f-08d6b042f2e4",
      subjectId: "811ddd33-7124-4c7e-811f-08d6b042f2e4",
      updatedAt: "2026-04-16T00:00:00.000Z",
      feedbackSignals: [
        {
          feedbackType: "worthwhile",
          metadata: {
            itemType: "release",
            href: "https://github.com/nodejs/node/releases/tag/v1.0.0"
          }
        },
        {
          feedbackType: "not_worthwhile",
          metadata: {
            itemType: "issue",
            repoFullName: "example/noise"
          }
        }
      ]
    });

    expect(profile.profile.feedbackCount).toBe(2);
    expect(profile.profile.itemTypeWeights.release).toBe(1);
    expect(profile.profile.repoWeights["nodejs/node"]).toBe(1);
    expect(getPreferenceBonus(profile, { itemType: "release", repoFullName: "nodejs/node" })).toBeGreaterThan(1);
    expect(getPreferenceBonus(profile, { itemType: "issue", repoFullName: "example/noise" })).toBeLessThan(0);
  });
});
