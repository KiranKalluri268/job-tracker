import { STALE_AFTER_DAYS } from "./stale";
import { isStatus, isWorkMode, type Status, type WorkMode } from "./types";

export type SortKey = "updatedAt" | "createdAt" | "appliedOn" | "nextActionOn" | "company" | "status";

export type FilterState = {
  q: string;
  status: Status[];
  workMode: WorkMode[];
  source: string;
  appliedFrom: string;
  appliedTo: string;
  nextFrom: string;
  nextTo: string;
  staleOnly: boolean;
  starredOnly: boolean;
  sort: SortKey;
  dir: "asc" | "desc";
};

export const EMPTY_FILTERS: FilterState = {
  q: "",
  status: [],
  workMode: [],
  source: "",
  appliedFrom: "",
  appliedTo: "",
  nextFrom: "",
  nextTo: "",
  staleOnly: false,
  starredOnly: false,
  sort: "updatedAt",
  dir: "desc",
};

const SORT_KEYS: SortKey[] = ["updatedAt", "createdAt", "appliedOn", "nextActionOn", "company", "status"];

type ParamSource = { get(key: string): string | null };

/** Read a FilterState out of URL search params. Unknown values fall back to defaults. */
export function parseFilters(params: ParamSource): FilterState {
  const csv = (key: string) => (params.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const sortParam = params.get("sort");
  const dirParam = params.get("dir");

  return {
    q: params.get("q") ?? "",
    status: csv("status").filter(isStatus),
    workMode: csv("mode").filter(isWorkMode),
    source: params.get("source") ?? "",
    appliedFrom: params.get("appliedFrom") ?? "",
    appliedTo: params.get("appliedTo") ?? "",
    nextFrom: params.get("nextFrom") ?? "",
    nextTo: params.get("nextTo") ?? "",
    staleOnly: params.get("stale") === "1",
    starredOnly: params.get("starred") === "1",
    sort: SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : "updatedAt",
    dir: dirParam === "asc" ? "asc" : "desc",
  };
}

/**
 * Serialise a FilterState back to search params, omitting anything at its default so
 * the URL stays readable and a cleared filter leaves no trace in the address bar.
 */
export function toSearchParams(f: FilterState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.status.length) p.set("status", f.status.join(","));
  if (f.workMode.length) p.set("mode", f.workMode.join(","));
  if (f.source) p.set("source", f.source);
  if (f.appliedFrom) p.set("appliedFrom", f.appliedFrom);
  if (f.appliedTo) p.set("appliedTo", f.appliedTo);
  if (f.nextFrom) p.set("nextFrom", f.nextFrom);
  if (f.nextTo) p.set("nextTo", f.nextTo);
  if (f.staleOnly) p.set("stale", "1");
  if (f.starredOnly) p.set("starred", "1");
  if (f.sort !== "updatedAt") p.set("sort", f.sort);
  if (f.dir !== "desc") p.set("dir", f.dir);
  return p;
}

/** How many filters (search excluded) are active — drives the badge on the Filter button. */
export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.status.length) n += 1;
  if (f.workMode.length) n += 1;
  if (f.source) n += 1;
  if (f.appliedFrom || f.appliedTo) n += 1;
  if (f.nextFrom || f.nextTo) n += 1;
  if (f.staleOnly) n += 1;
  if (f.starredOnly) n += 1;
  return n;
}

/** Escape a user string so it is matched literally inside a regex. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Translate a FilterState into a MongoDB query document. Kept free of driver imports
 * so it is a plain pure function the tests can assert on directly.
 */
export function buildMongoFilter(f: FilterState, now: Date = new Date()): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (f.q.trim()) {
    const rx = { $regex: escapeRegex(f.q.trim()), $options: "i" };
    and.push({
      $or: [{ company: rx }, { role: rx }, { notes: rx }, { location: rx }, { contactName: rx }],
    });
  }
  if (f.status.length) and.push({ status: { $in: f.status } });
  if (f.workMode.length) and.push({ workMode: { $in: f.workMode } });
  if (f.source.trim()) {
    and.push({ source: { $regex: escapeRegex(f.source.trim()), $options: "i" } });
  }

  const range = (field: string, from: string, to: string) => {
    const clause: Record<string, string> = {};
    if (from) clause.$gte = from;
    if (to) clause.$lte = to;
    if (Object.keys(clause).length) and.push({ [field]: clause });
  };
  range("appliedOn", f.appliedFrom, f.appliedTo);
  range("nextActionOn", f.nextFrom, f.nextTo);

  if (f.starredOnly) and.push({ starred: true });

  if (f.staleOnly) {
    // Each status has its own quiet threshold, so "stale" is a union of one clause
    // per status rather than a single cutoff.
    const clauses = Object.entries(STALE_AFTER_DAYS).map(([status, days]) => ({
      status,
      updatedAt: { $lt: new Date(now.getTime() - (days as number) * DAY_MS).toISOString() },
    }));
    and.push({ $or: clauses });
  }

  return and.length ? { $and: and } : {};
}

export function buildMongoSort(f: FilterState): Record<string, 1 | -1> {
  return { [f.sort]: f.dir === "asc" ? 1 : -1 };
}
