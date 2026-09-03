import { describe, expect, it } from "vitest";

import { computeStats, formatRate } from "@/lib/stats";

import { event, makeApp } from "./factory";

const NOW = new Date("2026-03-04T12:00:00.000Z"); // a Wednesday


describe("computeStats", () => {
  it("counts a rejected application as sent — history, not current status", () => {
    const app = makeApp({
      status: "Rejected",
      events: [event("Saved", "2026-01-01"), event("Applied", "2026-01-02", "Saved"), event("Rejected", "2026-01-20", "Applied")],
    });
    const stats = computeStats([app], 8, NOW);
    expect(stats.sent).toBe(1);
    expect(stats.responded).toBe(1);
  });

  it("does not count a still-Saved application as sent", () => {
    const stats = computeStats([makeApp({ status: "Saved" })], 8, NOW);
    expect(stats.sent).toBe(0);
    expect(stats.responseRate).toBeNull();
  });

  it("computes response and interview rates against sent, not total", () => {
    const saved = makeApp({ status: "Saved" });
    const applied = makeApp({
      status: "Applied",
      events: [event("Saved", "2026-01-01"), event("Applied", "2026-01-02", "Saved")],
    });
    const interviewed = makeApp({
      status: "Interview",
      events: [
        event("Saved", "2026-01-01"),
        event("Applied", "2026-01-02", "Saved"),
        event("Interview", "2026-01-10", "Applied"),
      ],
    });

    const stats = computeStats([saved, applied, interviewed], 8, NOW);
    expect(stats.total).toBe(3);
    expect(stats.sent).toBe(2);
    expect(stats.responded).toBe(1);
    expect(stats.interviewed).toBe(1);
    expect(stats.responseRate).toBe(0.5);
    expect(stats.interviewRate).toBe(0.5);
  });

  it("keeps every status key present even at zero", () => {
    const stats = computeStats([], 8, NOW);
    expect(stats.byStatus.Offer).toBe(0);
    expect(stats.byStatus.Ghosted).toBe(0);
  });

  it("emits one bucket per week including empty ones", () => {
    const stats = computeStats([], 8, NOW);
    expect(stats.perWeek).toHaveLength(8);
    expect(stats.perWeek.at(-1)?.weekStart).toBe("2026-03-02");
    expect(stats.perWeek.every((w) => w.count === 0)).toBe(true);
  });

  it("buckets a sent application into the week it was applied", () => {
    const app = makeApp({
      status: "Applied",
      appliedOn: "2026-03-03",
      events: [event("Saved", "2026-03-01"), event("Applied", "2026-03-03", "Saved")],
    });
    const stats = computeStats([app], 8, NOW);
    expect(stats.perWeek.at(-1)?.count).toBe(1);
  });

  it("medians the applied-to-first-reply turnaround", () => {
    const mk = (appliedOn: string, replyAt: string) =>
      makeApp({
        status: "Interview",
        appliedOn,
        events: [event("Applied", `${appliedOn}T00:00:00.000Z`, "Saved"), event("Interview", replyAt, "Applied")],
      });
    const stats = computeStats(
      [
        mk("2026-02-01", "2026-02-03T00:00:00.000Z"), // 2 days
        mk("2026-02-01", "2026-02-11T00:00:00.000Z"), // 10 days
        mk("2026-02-01", "2026-02-07T00:00:00.000Z"), // 6 days
      ],
      8,
      NOW,
    );
    expect(stats.medianDaysToResponse).toBe(6);
  });

  it("has no median before anyone has replied", () => {
    expect(computeStats([makeApp({ status: "Applied" })], 8, NOW).medianDaysToResponse).toBeNull();
  });
});

describe("formatRate", () => {
  it("renders a dash rather than NaN when there is nothing to divide by", () => {
    expect(formatRate(null)).toBe("—");
    expect(formatRate(0.333)).toBe("33%");
  });
});
