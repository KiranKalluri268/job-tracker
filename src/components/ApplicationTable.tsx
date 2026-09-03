"use client";

import { shortDate } from "@/lib/dates";
import type { SortKey } from "@/lib/filters";
import { isActionDue, isStale, quietDays } from "@/lib/stale";
import type { Application } from "@/lib/types";

import { StatusPill } from "./ui";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "company", label: "Company" },
  { key: null, label: "Role" },
  { key: "status", label: "Status" },
  { key: "appliedOn", label: "Applied" },
  { key: "nextActionOn", label: "Next action" },
  { key: null, label: "Source" },
  { key: "updatedAt", label: "Updated" },
];


function StaleBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/25 ring-inset">
      quiet {days}d
    </span>
  );
}

function DueBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-400 ring-1 ring-sky-500/25 ring-inset">
      due
    </span>
  );
}

export type TableProps = {
  applications: Application[];
  sort: SortKey;
  dir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  onOpen: (app: Application) => void;
  now: Date;
};

export default function ApplicationTable({ applications, sort, dir, onSort, onOpen, now }: TableProps) {
  if (!applications.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-edge)] px-6 py-16 text-center">
        <p className="text-sm text-zinc-400">Nothing here.</p>
        <p className="mt-1 text-sm text-zinc-600">
          Add an application, or loosen the search and filters.
        </p>
      </div>
    );
  }

  const arrow = (key: SortKey | null) => (key && key === sort ? (dir === "asc" ? " ↑" : " ↓") : "");

  return (
    <>
      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto rounded-xl border border-[var(--color-edge)] md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--color-panel)] text-left">
              {COLUMNS.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  className="border-b border-[var(--color-edge)] px-4 py-3 text-xs font-semibold tracking-wide text-zinc-400 uppercase"
                >
                  {col.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key as SortKey)}
                      className="transition hover:text-zinc-200"
                    >
                      {col.label}
                      {arrow(col.key)}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((a) => {
              const stale = isStale(a, now);
              return (
                <tr
                  key={a._id}
                  tabIndex={0}
                  onClick={() => onOpen(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(a);
                    }
                  }}
                  className="cursor-pointer border-b border-[var(--color-edge)] transition last:border-0 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none"
                >
                  <td className="px-4 py-3 font-medium text-zinc-100">
                    <div className="flex items-center gap-2">
                      {a.company}
                      {stale ? <StaleBadge days={quietDays(a, now)} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {a.role}
                    {a.location ? <span className="block text-xs text-zinc-500">{a.location}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={a.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{shortDate(a.appliedOn)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-zinc-400">
                      {shortDate(a.nextActionOn)}
                      {isActionDue(a, now) ? <DueBadge /> : null}
                    </div>
                    {a.nextActionNote ? (
                      <span className="block max-w-52 truncate text-xs text-zinc-500">
                        {a.nextActionNote}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{a.source ?? "—"}</td>
                  <td className="px-4 py-3 text-zinc-500">{shortDate(a.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: the same rows as stacked cards. */}
      <ul className="space-y-2 md:hidden">
        {applications.map((a) => (
          <li key={a._id}>
            <button
              type="button"
              onClick={() => onOpen(a)}
              className="w-full rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)] px-4 py-3 text-left transition active:bg-white/5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-100">{a.company}</p>
                  <p className="truncate text-sm text-zinc-400">{a.role}</p>
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>Applied {shortDate(a.appliedOn)}</span>
                {a.nextActionOn ? <span>· Next {shortDate(a.nextActionOn)}</span> : null}
                {isActionDue(a, now) ? <DueBadge /> : null}
                {isStale(a, now) ? <StaleBadge days={quietDays(a, now)} /> : null}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
