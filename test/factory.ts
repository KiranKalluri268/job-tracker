import type { Application, AppEvent, Status } from "@/lib/types";

let seq = 0;

/** A complete Application with sensible defaults, so tests only state what matters. */
export function makeApp(overrides: Partial<Application> = {}): Application {
  seq += 1;
  const created = overrides.createdAt ?? "2026-01-01T00:00:00.000Z";
  const status: Status = overrides.status ?? "Saved";

  return {
    _id: `id-${seq}`,
    company: `Company ${seq}`,
    role: "Engineer",
    status,
    starred: false,
    appliedOn: null,
    nextActionOn: null,
    nextActionNote: null,
    location: null,
    workMode: null,
    source: null,
    salary: null,
    postingUrl: null,
    resumeVersion: null,
    coverLetter: false,
    contactName: null,
    contactEmail: null,
    notes: null,
    events: [{ at: created, from: null, to: status, note: "Created" }],
    createdAt: created,
    updatedAt: created,
    ...overrides,
  };
}

export function event(to: Status, at: string, from: Status | null = null): AppEvent {
  return { at, from, to, note: null };
}
