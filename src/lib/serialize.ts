import { ObjectId } from "mongodb";

import type { Application, ApplicationInput, Status } from "./types";
import { isPriority, isStatus, isWorkMode } from "./types";

/** Fields the client is allowed to write. Anything else in the body is ignored. */
const TEXT_FIELDS = [
  "company",
  "role",
  "location",
  "source",
  "salary",
  "postingUrl",
  "resumeVersion",
  "contactName",
  "contactEmail",
  "notes",
  "nextActionNote",
] as const;

const DATE_FIELDS = ["appliedOn", "nextActionOn"] as const;

export class ValidationError extends Error {}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function cleanDate(value: unknown): string | null {
  const text = cleanText(value);
  if (text === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ValidationError(`Expected a YYYY-MM-DD date, got "${text}"`);
  }
  return text;
}

/**
 * Pick and normalise the writable fields out of an arbitrary request body. Returns
 * only the keys actually present, so a PATCH touching one field leaves the rest alone.
 */
export function sanitizeInput(body: unknown, { requireCore }: { requireCore: boolean }): ApplicationInput {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object");
  }
  const raw = body as Record<string, unknown>;
  const out: Record<string, unknown> = {};

  for (const field of TEXT_FIELDS) {
    if (field in raw) out[field] = cleanText(raw[field]);
  }
  for (const field of DATE_FIELDS) {
    if (field in raw) out[field] = cleanDate(raw[field]);
  }
  if ("coverLetter" in raw) out.coverLetter = Boolean(raw.coverLetter);
  if ("starred" in raw) out.starred = Boolean(raw.starred);
  if ("status" in raw) {
    if (!isStatus(raw.status)) throw new ValidationError(`Unknown status "${String(raw.status)}"`);
    out.status = raw.status;
  }
  if ("priority" in raw) {
    if (!isPriority(raw.priority)) throw new ValidationError(`Unknown priority "${String(raw.priority)}"`);
    out.priority = raw.priority;
  }
  if ("workMode" in raw) {
    const mode = cleanText(raw.workMode);
    if (mode !== null && !isWorkMode(mode)) {
      throw new ValidationError(`Unknown work mode "${mode}"`);
    }
    out.workMode = mode;
  }

  if (requireCore) {
    if (!out.company) throw new ValidationError("Company is required");
    if (!out.role) throw new ValidationError("Role is required");
  } else if (("company" in out && !out.company) || ("role" in out && !out.role)) {
    throw new ValidationError("Company and role cannot be blank");
  }

  return out as ApplicationInput;
}

/** Fill in every field a fresh document needs, so reads never see `undefined`. */
export function newDocument(input: ApplicationInput, now = new Date()): Record<string, unknown> {
  const iso = now.toISOString();
  const status: Status = input.status ?? "Saved";
  const appliedOn = input.appliedOn ?? (status !== "Saved" ? iso.slice(0, 10) : null);

  return {
    company: input.company,
    role: input.role,
    status,
    priority: input.priority ?? "low",
    starred: input.starred ?? false,
    appliedOn,
    nextActionOn: input.nextActionOn ?? null,
    nextActionNote: input.nextActionNote ?? null,
    location: input.location ?? null,
    workMode: input.workMode ?? null,
    source: input.source ?? null,
    salary: input.salary ?? null,
    postingUrl: input.postingUrl ?? null,
    resumeVersion: input.resumeVersion ?? null,
    coverLetter: input.coverLetter ?? false,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    notes: input.notes ?? null,
    events: [{ at: iso, from: null, to: status, note: "Created" }],
    createdAt: iso,
    updatedAt: iso,
  };
}

export function toObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new ValidationError(`"${id}" is not a valid id`);
  return new ObjectId(id);
}

/** Convert a stored document into the JSON shape the client expects. */
export function serialize(doc: Record<string, unknown>): Application {
  const { _id, ...rest } = doc;
  return {
    ...(rest as Omit<Application, "_id">),
    _id: String(_id),
    // Older documents predate this field; treat a missing value as unstarred.
    starred: Boolean(rest.starred),
    // Older documents predate priority too; default them to "low".
    priority: isPriority(rest.priority) ? rest.priority : "low",
  };
}
