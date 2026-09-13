import { describe, expect, it } from "vitest";

import {
  EMPTY_FILTERS,
  activeFilterCount,
  buildMongoFilter,
  buildMongoSort,
  parseFilters,
  toSearchParams,
} from "@/lib/filters";

const params = (qs: string) => new URLSearchParams(qs);

describe("parseFilters", () => {
  it("falls back to defaults on an empty query string", () => {
    expect(parseFilters(params(""))).toEqual(EMPTY_FILTERS);
  });

  it("reads multi-valued status and mode as comma lists", () => {
    const f = parseFilters(params("status=Applied,Interview&mode=Remote"));
    expect(f.status).toEqual(["Applied", "Interview"]);
    expect(f.workMode).toEqual(["Remote"]);
  });

  it("drops values that are not real statuses or modes", () => {
    const f = parseFilters(params("status=Applied,Bogus&mode=Moon"));
    expect(f.status).toEqual(["Applied"]);
    expect(f.workMode).toEqual([]);
  });

  it("ignores an unknown sort key and a bad direction", () => {
    const f = parseFilters(params("sort=salary&dir=sideways"));
    expect(f.sort).toBe("updatedAt");
    expect(f.dir).toBe("desc");
  });
});

describe("toSearchParams", () => {
  it("omits every field left at its default", () => {
    expect(toSearchParams(EMPTY_FILTERS).toString()).toBe("");
  });

  it("round-trips a populated state", () => {
    const f = {
      ...EMPTY_FILTERS,
      q: "acme",
      status: ["Applied" as const],
      staleOnly: true,
      sort: "company" as const,
      dir: "asc" as const,
    };
    expect(parseFilters(toSearchParams(f))).toEqual(f);
  });
});

describe("activeFilterCount", () => {
  it("does not count the search box", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, q: "acme" })).toBe(0);
  });

  it("counts a date range once, not once per endpoint", () => {
    expect(activeFilterCount({ ...EMPTY_FILTERS, appliedFrom: "2026-01-01", appliedTo: "2026-02-01" })).toBe(1);
  });
});

describe("buildMongoFilter", () => {
  it("is an empty query when nothing is set", () => {
    expect(buildMongoFilter(EMPTY_FILTERS)).toEqual({});
  });

  it("searches several fields case-insensitively", () => {
    const q = buildMongoFilter({ ...EMPTY_FILTERS, q: "acme" }) as { $and: Record<string, unknown>[] };
    const or = q.$and[0].$or as Record<string, { $regex: string; $options: string }>[];
    expect(or.map((c) => Object.keys(c)[0])).toEqual([
      "company",
      "role",
      "notes",
      "location",
      "contactName",
    ]);
    expect(or[0].company.$options).toBe("i");
  });

  it("escapes regex metacharacters in the search term", () => {
    const q = buildMongoFilter({ ...EMPTY_FILTERS, q: "C++ (dev)" }) as { $and: Record<string, unknown>[] };
    const or = q.$and[0].$or as Record<string, { $regex: string }>[];
    expect(or[0].company.$regex).toBe("C\\+\\+ \\(dev\\)");
  });

  it("builds a half-open range when only one endpoint is given", () => {
    const q = buildMongoFilter({ ...EMPTY_FILTERS, appliedFrom: "2026-01-01" }) as {
      $and: Record<string, unknown>[];
    };
    expect(q.$and[0]).toEqual({ appliedOn: { $gte: "2026-01-01" } });
  });

  it("filters to starred applications only", () => {
    const q = buildMongoFilter({ ...EMPTY_FILTERS, starredOnly: true }) as { $and: Record<string, unknown>[] };
    expect(q.$and[0]).toEqual({ starred: true });
  });

  it("expands staleOnly into one cutoff per status that can go quiet", () => {
    const now = new Date("2026-03-01T00:00:00.000Z");
    const q = buildMongoFilter({ ...EMPTY_FILTERS, staleOnly: true }, now) as {
      $and: { $or: { status: string; updatedAt: { $lt: string } }[] }[];
    };
    const clauses = q.$and[0].$or;
    expect(clauses.map((c) => c.status)).toEqual(["Applied", "OA", "Interview"]);
    // Applied's threshold is 14 days.
    expect(clauses[0].updatedAt.$lt).toBe("2026-02-15T00:00:00.000Z");
  });
});

describe("buildMongoSort", () => {
  it("maps direction onto Mongo's 1 / -1", () => {
    expect(buildMongoSort({ ...EMPTY_FILTERS, sort: "company", dir: "asc" })).toEqual({ company: 1 });
    expect(buildMongoSort(EMPTY_FILTERS)).toEqual({ updatedAt: -1 });
  });
});
