import "server-only";

import { ObjectId, type Collection, type Document } from "mongodb";

import {
  buildCursorFilter,
  buildMongoFilter,
  buildSortSpec,
  combineMongoFilters,
  PAGE_SIZE,
  type Cursor,
  type FilterState,
} from "./filters";
import { serialize } from "./serialize";
import type { Application } from "./types";

/** The raw `cursor` query param: a JSON-encoded `{ values, id }`, or absent on page one. */
export type RawCursor = string | null;

function parseCursor(raw: RawCursor): Cursor<ObjectId> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { values?: unknown; id?: unknown };
    if (!Array.isArray(parsed.values) || typeof parsed.id !== "string" || !ObjectId.isValid(parsed.id)) {
      return null;
    }
    return { values: parsed.values, id: new ObjectId(parsed.id) };
  } catch {
    return null;
  }
}

/**
 * One keyset-paginated page of applications matching `filters`, shared between
 * the API route and the server component's own direct-to-Mongo initial load so
 * neither has to duplicate the cursor-building logic.
 */
export async function fetchApplicationPage(
  col: Collection<Document>,
  filters: FilterState,
  rawCursor: RawCursor,
): Promise<{ applications: Application[]; nextCursor: Cursor<string> | null }> {
  const cursor = parseCursor(rawCursor);
  const filter = combineMongoFilters(buildMongoFilter(filters), buildCursorFilter(filters, cursor));
  const spec = buildSortSpec(filters);
  const sort = Object.fromEntries(spec.map(({ field, dir }) => [field, dir]));
  sort._id = spec[spec.length - 1].dir;

  const docs = await col.find(filter).sort(sort).limit(PAGE_SIZE).toArray();

  const applications = docs.map(serialize);
  const last = docs[docs.length - 1] as Record<string, unknown> | undefined;
  const nextCursor: Cursor<string> | null =
    docs.length === PAGE_SIZE && last
      ? { values: spec.map(({ field }) => last[field] ?? null), id: String(last._id) }
      : null;

  return { applications, nextCursor };
}
