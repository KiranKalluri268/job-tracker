import { describe, expect, it } from "vitest";

import { isPriority, priorityRank } from "@/lib/types";

describe("priorityRank", () => {
  it("ranks starred-high first, then high, then starred-low, then low", () => {
    const starredHigh = { starred: true, priority: "high" as const };
    const high = { starred: false, priority: "high" as const };
    const starredLow = { starred: true, priority: "low" as const };
    const low = { starred: false, priority: "low" as const };

    expect(priorityRank(starredHigh)).toBeLessThan(priorityRank(high));
    expect(priorityRank(high)).toBeLessThan(priorityRank(starredLow));
    expect(priorityRank(starredLow)).toBeLessThan(priorityRank(low));
  });
});

describe("isPriority", () => {
  it("accepts the known priorities and rejects anything else", () => {
    expect(isPriority("high")).toBe(true);
    expect(isPriority("low")).toBe(true);
    expect(isPriority("medium")).toBe(false);
    expect(isPriority(undefined)).toBe(false);
  });
});
