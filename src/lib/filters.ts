import { STALE_AFTER_DAYS } from "./stale";
import { isStatus, isWorkMode, type Status, type WorkMode } from "./types";

/**
 * "default" isn't a real column — it's the triage order (the old "Bookmark"
 * toggle's sort): starred+high first, then high, then starred+low, then low,
 * oldest posting first within each tier. See buildSortSpec.
 */
export type SortKey = "updatedAt" | "createdAt" | "appliedOn" | "nextActionOn" | "company" | "status" | "default";

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

const SORT_KEYS: SortKey[] = [
  "updatedAt",
  "createdAt",
  "appliedOn",
  "nextActionOn",
  "company",
  "status",
  "default",
];

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

export type SortField = { field: string; dir: 1 | -1 };

/**
 * The ordered list of (field, direction) pairs a sort resolves to. Usually
 * just the chosen column, but "default" is itself a compound key — priority
 * ascending ("high" sorts before "low" alphabetically, conveniently), starred
 * descending (starred first within a tier), then posting date ascending.
 */
export function buildSortSpec(f: FilterState): SortField[] {
  if (f.sort === "default") {
    return [
      { field: "priority", dir: 1 },
      { field: "starred", dir: -1 },
      { field: "createdAt", dir: 1 },
    ];
  }
  return [{ field: f.sort, dir: f.dir === "asc" ? 1 : -1 }];
}

export function buildMongoSort(f: FilterState): Record<string, 1 | -1> {
  return Object.fromEntries(buildSortSpec(f).map(({ field, dir }) => [field, dir]));
}

/**
 * A cursor for keyset pagination: the previous page's last row, as the value
 * of every field in the current sort spec (in order) plus its `_id` — the
 * tuple two rows can never fully share, even when every sort field ties.
 * `id` is generic rather than `string` so a caller with driver access can
 * hand in an actual ObjectId; this module stays free of the `mongodb` import
 * either way, and `values` stay as whatever JSON-safe type the field is
 * (string, boolean, …) rather than being coerced to strings, since comparing
 * a coerced string against a differently-typed field (e.g. a boolean) would
 * silently match nothing — Mongo compares by BSON type before value.
 */
export type Cursor<Id = string> = { values: unknown[]; id: Id };

/**
 * The query clause for "everything after this cursor" in the current sort
 * order. For a single-field sort this is the familiar two-clause `$or`
 * (strictly past the value, or tied on it and past the `_id`); a compound
 * sort (see buildSortSpec) generalizes that to one clause per field — each
 * pinning every higher-priority field equal and requiring strict progress on
 * that one — plus a final clause for every field tied, broken by `_id`.
 * Combine with `combineMongoFilters`.
 *
 * Keyset pagination (as opposed to `skip`/`limit`) keeps each page's query
 * cost independent of how far into the list it is — `skip` makes Mongo walk
 * and discard every earlier row first, which gets slower the deeper you
 * page. That matters once the collection is large enough that "just fetch
 * everything" (the previous approach here) is no longer an option.
 */
export function buildCursorFilter<Id>(f: FilterState, cursor: Cursor<Id> | null): Record<string, unknown> | null {
  if (!cursor) return null;
  const spec = buildSortSpec(f);

  const clauses: Record<string, unknown>[] = spec.map((_, i) => {
    const clause: Record<string, unknown> = {};
    for (let j = 0; j < i; j++) clause[spec[j].field] = cursor.values[j];
    const { field, dir } = spec[i];
    clause[field] = { [dir === 1 ? "$gt" : "$lt"]: cursor.values[i] };
    return clause;
  });

  // Every sort field tied: the final tiebreak is `_id`, in the same
  // direction as the last (least-significant) sort field.
  const allTied: Record<string, unknown> = {};
  spec.forEach(({ field }, i) => {
    allTied[field] = cursor.values[i];
  });
  const lastDir = spec[spec.length - 1].dir;
  allTied._id = { [lastDir === 1 ? "$gt" : "$lt"]: cursor.id };
  clauses.push(allTied);

  return { $or: clauses };
}

/** ANDs together whichever of these filter fragments are non-empty. */
export function combineMongoFilters(...clauses: (Record<string, unknown> | null)[]): Record<string, unknown> {
  const present = clauses.filter((c): c is Record<string, unknown> => c !== null && Object.keys(c).length > 0);
  if (present.length === 0) return {};
  if (present.length === 1) return present[0];
  return { $and: present };
}

/** Page size for every paginated fetch of applications — one source of truth. */
export const PAGE_SIZE = 200;
