export const STATUSES = [
  "Saved",
  "Applied",
  "OA",
  "Interview",
  "Offer",
  "Rejected",
  "Not qualified",
  "Ghosted",
] as const;

export type Status = (typeof STATUSES)[number];

export const WORK_MODES = ["Remote", "Hybrid", "Onsite"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

/** Statuses that mean the company came back to us in some form. */
export const RESPONDED: readonly Status[] = ["OA", "Interview", "Offer", "Rejected", "Not qualified"];

/** Statuses that mean the application is finished, one way or the other. */
export const CLOSED: readonly Status[] = ["Offer", "Rejected", "Not qualified", "Ghosted"];

export type AppEvent = {
  at: string;
  from: Status | null;
  to: Status;
  note: string | null;
};

export type Application = {
  _id: string;
  company: string;
  role: string;
  status: Status;
  starred: boolean;
  appliedOn: string | null;
  nextActionOn: string | null;
  nextActionNote: string | null;
  location: string | null;
  workMode: WorkMode | null;
  source: string | null;
  salary: string | null;
  postingUrl: string | null;
  resumeVersion: string | null;
  coverLetter: boolean;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  events: AppEvent[];
  createdAt: string;
  updatedAt: string;
};

/** The shape the modal sends up. Everything optional except on create. */
export type ApplicationInput = Partial<Omit<Application, "_id" | "events" | "createdAt" | "updatedAt">>;

export const STATUS_TONE: Record<Status, string> = {
  Saved: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  Applied: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  OA: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  Interview: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  Offer: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  Rejected: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  "Not qualified": "bg-orange-500/15 text-orange-300 ring-orange-500/30",
  Ghosted: "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30",
};

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function isWorkMode(value: unknown): value is WorkMode {
  return typeof value === "string" && (WORK_MODES as readonly string[]).includes(value);
}
