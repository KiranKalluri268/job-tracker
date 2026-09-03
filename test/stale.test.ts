import { describe, expect, it } from "vitest";

import { toDateKey } from "@/lib/dates";
import { attentionOf, daysSince, isActionDue, isStale, quietDays } from "@/lib/stale";

import { makeApp } from "./factory";

const NOW = new Date("2026-03-01T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("daysSince", () => {
  it("returns null for a missing or unparseable date", () => {
    expect(daysSince(null, NOW)).toBeNull();
    expect(daysSince("not a date", NOW)).toBeNull();
  });

  it("floors partial days", () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
  });
});

describe("isStale", () => {
  it("leaves Saved rows alone — a saved job is a to-do, not a stalled one", () => {
    expect(isStale(makeApp({ status: "Saved", updatedAt: daysAgo(400) }), NOW)).toBe(false);
  });

  it.each([
    ["Rejected"],
    ["Offer"],
    ["Ghosted"],
  ] as const)("never marks the terminal status %s stale", (status) => {
    expect(isStale(makeApp({ status, updatedAt: daysAgo(400) }), NOW)).toBe(false);
  });

  it("uses a 14-day threshold for Applied", () => {
    expect(isStale(makeApp({ status: "Applied", updatedAt: daysAgo(13) }), NOW)).toBe(false);
    expect(isStale(makeApp({ status: "Applied", updatedAt: daysAgo(14) }), NOW)).toBe(true);
  });

  it("uses a tighter 7-day threshold for OA", () => {
    expect(isStale(makeApp({ status: "OA", updatedAt: daysAgo(8) }), NOW)).toBe(true);
    expect(isStale(makeApp({ status: "Applied", updatedAt: daysAgo(8) }), NOW)).toBe(false);
  });

  it("reports how long it has been quiet", () => {
    expect(quietDays(makeApp({ updatedAt: daysAgo(21) }), NOW)).toBe(21);
  });
});

describe("isActionDue", () => {
  const today = toDateKey(NOW);

  it("is false when no follow-up is scheduled", () => {
    expect(isActionDue(makeApp(), NOW)).toBe(false);
  });

  it("counts something due today as due, all day", () => {
    expect(isActionDue(makeApp({ nextActionOn: today }), NOW)).toBe(true);
  });

  it("counts an overdue date and ignores a future one", () => {
    expect(isActionDue(makeApp({ nextActionOn: "2026-02-01" }), NOW)).toBe(true);
    expect(isActionDue(makeApp({ nextActionOn: "2026-12-01" }), NOW)).toBe(false);
  });
});

describe("attentionOf", () => {
  it("sorts due items oldest-first and stale items quietest-first", () => {
    const soon = makeApp({ company: "Soon", nextActionOn: "2026-02-28" });
    const older = makeApp({ company: "Older", nextActionOn: "2026-01-05" });
    const future = makeApp({ company: "Future", nextActionOn: "2026-09-09" });
    const quiet20 = makeApp({ company: "Quiet20", status: "Applied", updatedAt: daysAgo(20) });
    const quiet60 = makeApp({ company: "Quiet60", status: "Applied", updatedAt: daysAgo(60) });

    const { due, stale } = attentionOf([soon, older, future, quiet20, quiet60], NOW);

    expect(due.map((a) => a.company)).toEqual(["Older", "Soon"]);
    expect(stale.map((a) => a.company)).toEqual(["Quiet60", "Quiet20"]);
  });
});
