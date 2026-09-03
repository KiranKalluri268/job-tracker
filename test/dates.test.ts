import { describe, expect, it } from "vitest";

import { longDate, shortDate, toDateKey, weekStartOf } from "@/lib/dates";

/**
 * These exist because a locale- or timezone-dependent formatter broke hydration:
 * the server rendered "Sep 1" and the browser "1 Sept". Every assertion below is a
 * fixed string on purpose — if any of it starts depending on the host's locale or
 * timezone, the bug is back.
 */
describe("shortDate", () => {
  it("formats a plain calendar date with a fixed month name", () => {
    expect(shortDate("2026-09-01")).toBe("Sep 1");
    expect(shortDate("2026-12-25")).toBe("Dec 25");
  });

  it("formats an ISO timestamp in UTC", () => {
    expect(shortDate("2026-09-01T10:00:00.000Z")).toBe("Sep 1");
  });

  it("does not let a late-evening UTC timestamp slide into the next day", () => {
    expect(shortDate("2026-09-01T23:59:59.000Z")).toBe("Sep 1");
  });

  it("reads a plain date as digits, so no timezone can shift it", () => {
    // Were this parsed via `new Date` and read with local getters, a negative
    // UTC offset would render this as Aug 31.
    expect(shortDate("2026-09-01")).toBe("Sep 1");
  });

  it("shows an em dash rather than 'Invalid Date'", () => {
    expect(shortDate(null)).toBe("—");
    expect(shortDate("")).toBe("—");
    expect(shortDate("nonsense")).toBe("—");
  });
});

describe("longDate", () => {
  it("includes the year", () => {
    expect(longDate("2026-09-01")).toBe("Sep 1, 2026");
    expect(longDate("2026-01-31T08:30:00.000Z")).toBe("Jan 31, 2026");
  });

  it("shows an em dash for a missing value", () => {
    expect(longDate(null)).toBe("—");
  });
});

describe("toDateKey", () => {
  it("pads to a zero-padded UTC YYYY-MM-DD", () => {
    expect(toDateKey(new Date("2026-09-01T00:00:00.000Z"))).toBe("2026-09-01");
    expect(toDateKey(new Date("2026-01-05T23:00:00.000Z"))).toBe("2026-01-05");
  });
});

describe("weekStartOf", () => {
  it("snaps to the Monday of that UTC week", () => {
    expect(weekStartOf(new Date("2026-03-04T12:00:00.000Z"))).toBe("2026-03-02");
    expect(weekStartOf(new Date("2026-03-02T00:30:00.000Z"))).toBe("2026-03-02");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(weekStartOf(new Date("2026-03-08T12:00:00.000Z"))).toBe("2026-03-02");
  });
});
