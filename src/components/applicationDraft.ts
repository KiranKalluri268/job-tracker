import type { Application, ApplicationInput, Status, WorkMode } from "@/lib/types";

/** The flat, all-strings shape the create form and the inline row editor both edit. */
export type Draft = {
  company: string;
  role: string;
  status: Status;
  appliedOn: string;
  nextActionOn: string;
  nextActionNote: string;
  location: string;
  workMode: WorkMode | "";
  source: string;
  salary: string;
  postingUrl: string;
  resumeVersion: string;
  coverLetter: boolean;
  contactName: string;
  contactEmail: string;
  notes: string;
};

export const BLANK: Draft = {
  company: "",
  role: "",
  status: "Saved",
  appliedOn: "",
  nextActionOn: "",
  nextActionNote: "",
  location: "",
  workMode: "",
  source: "",
  salary: "",
  postingUrl: "",
  resumeVersion: "",
  coverLetter: false,
  contactName: "",
  contactEmail: "",
  notes: "",
};

export function draftOf(app: Application | null): Draft {
  if (!app) return BLANK;
  return {
    company: app.company,
    role: app.role,
    status: app.status,
    appliedOn: app.appliedOn ?? "",
    nextActionOn: app.nextActionOn ?? "",
    nextActionNote: app.nextActionNote ?? "",
    location: app.location ?? "",
    workMode: app.workMode ?? "",
    source: app.source ?? "",
    salary: app.salary ?? "",
    postingUrl: app.postingUrl ?? "",
    resumeVersion: app.resumeVersion ?? "",
    coverLetter: app.coverLetter,
    contactName: app.contactName ?? "",
    contactEmail: app.contactEmail ?? "",
    notes: app.notes ?? "",
  };
}

export function payloadOf(d: Draft): ApplicationInput {
  return { ...d, workMode: d.workMode === "" ? null : d.workMode } as ApplicationInput;
}
