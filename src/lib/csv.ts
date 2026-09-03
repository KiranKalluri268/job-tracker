import type { Application } from "./types";

type Column = { header: string; get: (a: Application) => string };

const COLUMNS: Column[] = [
  { header: "Company", get: (a) => a.company },
  { header: "Role", get: (a) => a.role },
  { header: "Status", get: (a) => a.status },
  { header: "Applied On", get: (a) => a.appliedOn ?? "" },
  { header: "Next Action", get: (a) => a.nextActionOn ?? "" },
  { header: "Next Action Note", get: (a) => a.nextActionNote ?? "" },
  { header: "Location", get: (a) => a.location ?? "" },
  { header: "Work Mode", get: (a) => a.workMode ?? "" },
  { header: "Source", get: (a) => a.source ?? "" },
  { header: "Salary", get: (a) => a.salary ?? "" },
  { header: "Posting URL", get: (a) => a.postingUrl ?? "" },
  { header: "Resume Version", get: (a) => a.resumeVersion ?? "" },
  { header: "Cover Letter", get: (a) => (a.coverLetter ? "yes" : "no") },
  { header: "Contact Name", get: (a) => a.contactName ?? "" },
  { header: "Contact Email", get: (a) => a.contactEmail ?? "" },
  { header: "Notes", get: (a) => a.notes ?? "" },
  { header: "Created", get: (a) => a.createdAt },
  { header: "Updated", get: (a) => a.updatedAt },
];

/**
 * RFC-4180 field escaping. A leading =, +, - or @ is also prefixed with a quote so
 * Excel and Sheets treat a pasted-in job title as text instead of a formula.
 */
export function escapeField(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(apps: Application[]): string {
  const rows = [
    COLUMNS.map((c) => escapeField(c.header)).join(","),
    ...apps.map((a) => COLUMNS.map((c) => escapeField(c.get(a))).join(",")),
  ];
  return `${rows.join("\r\n")}\r\n`;
}

export function csvFilename(now: Date = new Date()): string {
  return `job-applications-${now.toISOString().slice(0, 10)}.csv`;
}
