import { describe, expect, it } from "vitest";

import { getMonthWindow } from "./index.js";

describe("getMonthWindow", () => {
  it("returns a closed-open natural month window in the workspace timezone", () => {
    const { start, end } = getMonthWindow("2026-04-16", "Asia/Shanghai");

    expect(start.toISOString()).toBe("2026-03-31T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-04-30T16:00:00.000Z");
  });

  it("rolls over the year boundary", () => {
    const { start, end } = getMonthWindow("2026-12-31", "UTC");

    expect(start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
