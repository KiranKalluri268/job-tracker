"use client";

import { Fragment, useState } from "react";

import { shortDate } from "@/lib/dates";
import type { SortKey } from "@/lib/filters";
import { isActionDue, isStale, quietDays } from "@/lib/stale";
import type { Application, Status } from "@/lib/types";
import { STATUSES } from "@/lib/types";

import ApplicationRowDetail from "./ApplicationRowDetail";
import { StatusPill, inputClass } from "./ui";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: null, label: "" },
  { key: "company", label: "Company" },
  { key: null, label: "Role" },
  { key: "status", label: "Status" },
  { key: "appliedOn", label: "Applied" },
  { key: "nextActionOn", label: "Next action" },
  { key: null, label: "Source" },
  { key: "updatedAt", label: "Updated" },
  { key: null, label: "Actions" },
];

function StaleBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-500/25 ring-inset">
      quiet {days}d
    </span>
  );
}

function DueBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 ring-1 ring-indigo-500/25 ring-inset">
      due
    </span>
  );
}

/**
 * The status cell: a pill until clicked, then an inline <select> that switches the
 * status straight away. Every interaction stops propagation so it never expands the
 * row underneath it.
 */
function StatusCell({
  app,
  onStatusChange,
}: {
  app: Application;
  onStatusChange: (app: Application, status: Status) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        aria-label={`Change status, currently ${app.status}`}
      >
        <StatusPill status={app.status} />
      </button>
    );
  }

  return (
    <select
      autoFocus
      className={`${inputClass} w-auto py-1`}
      value={app.status}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => setOpen(false)}
      onChange={(e) => {
        e.stopPropagation();
        const next = e.target.value as Status;
        setOpen(false);
        if (next !== app.status) onStatusChange(app, next);
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/**
 * Opens the posting (if there is one) and marks the application Applied in one
 * click. Stops propagation so it doesn't also toggle the row's expansion (which
 * would race the new tab).
 */
function ApplyButton({ app, onApply }: { app: Application; onApply: (app: Application) => void }) {
  if (app.status !== "Saved") return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (app.postingUrl) window.open(app.postingUrl, "_blank", "noopener,noreferrer");
        onApply(app);
      }}
      className="inline-flex items-center rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500"
    >
      Apply
    </button>
  );
}

/**
 * Toggles the application's starred flag. Stops propagation so it doesn't also
 * toggle the row's expansion.
 */
function StarButton({
  app,
  onToggleStar,
}: {
  app: Application;
  onToggleStar: (app: Application) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={app.starred}
      aria-label={app.starred ? "Unstar application" : "Star application"}
      onClick={(e) => {
        e.stopPropagation();
        onToggleStar(app);
      }}
      className={`text-base leading-none transition ${
        app.starred ? "text-amber-500 hover:text-amber-600" : "text-stone-400 hover:text-stone-500"
      }`}
    >
      {app.starred ? "★" : "☆"}
    </button>
  );
}

export type TableProps = {
  applications: Application[];
  sort: SortKey;
  dir: "asc" | "desc";
  expandedId: string | null;
  onSort: (key: SortKey) => void;
  onToggleExpand: (app: Application) => void;
  onApply: (app: Application) => void;
  onToggleStar: (app: Application) => void;
  onStatusChange: (app: Application, status: Status) => void;
  onRowSaved: (app: Application) => void;
  onRowDeleted: (id: string) => void;
  now: Date;
};

export default function ApplicationTable({
  applications,
  sort,
  dir,
  expandedId,
  onSort,
  onToggleExpand,
  onApply,
  onToggleStar,
  onStatusChange,
  onRowSaved,
  onRowDeleted,
  now,
}: TableProps) {
  if (!applications.length) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-edge)] px-6 py-16 text-center">
        <p className="text-sm text-stone-500">Nothing here.</p>
        <p className="mt-1 text-sm text-stone-400">
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
                  className="border-b border-[var(--color-edge)] px-4 py-3 text-xs font-semibold tracking-wide text-stone-500 uppercase"
                >
                  {col.key ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key as SortKey)}
                      className="transition hover:text-stone-800"
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
              const expanded = expandedId === a._id;
              return (
                <Fragment key={a._id}>
                <tr
                  tabIndex={0}
                  onClick={() => onToggleExpand(a)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleExpand(a);
                    }
                  }}
                  className={`cursor-pointer border-b border-[var(--color-edge)] align-top transition last:border-0 focus:bg-black/[0.04] focus:outline-none ${
                    expanded ? "bg-black/[0.03]" : "hover:bg-black/[0.03]"
                  }`}
                >
                  <td className="w-10 px-4 py-3 text-center">
                    <StarButton app={a} onToggleStar={onToggleStar} />
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    <div className="flex items-center gap-2">
                      {a.company}
                      {stale ? <StaleBadge days={quietDays(a, now)} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {a.role}
                    {a.location ? <span className="block text-xs text-stone-500">{a.location}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusCell app={a} onStatusChange={onStatusChange} />
                  </td>
                  <td className="px-4 py-3 text-stone-500">{shortDate(a.appliedOn)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-stone-500">
                      {shortDate(a.nextActionOn)}
                      {isActionDue(a, now) ? <DueBadge /> : null}
                    </div>
                    {a.nextActionNote ? (
                      <span className="block max-w-52 truncate text-xs text-stone-500">
                        {a.nextActionNote}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-stone-500">{a.source ?? "—"}</td>
                  <td className="px-4 py-3 text-stone-500">{shortDate(a.updatedAt)}</td>
                  <td className="px-4 py-3">
                    <ApplyButton app={a} onApply={onApply} />
                  </td>
                </tr>
                {expanded ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="border-b border-[var(--color-edge)] p-0">
                      <ApplicationRowDetail
                        key={a._id}
                        application={a}
                        onSaved={onRowSaved}
                        onDeleted={onRowDeleted}
                        onClose={() => onToggleExpand(a)}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: the same rows as stacked cards. */}
      <ul className="space-y-2 md:hidden">
        {applications.map((a) => {
          const expanded = expandedId === a._id;
          return (
            <li
              key={a._id}
              className={`overflow-hidden rounded-xl border ${
                expanded ? "border-indigo-500/40" : "border-[var(--color-edge)]"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleExpand(a)}
                className="w-full bg-[var(--color-panel)] px-4 py-3 text-left transition active:bg-black/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800">{a.company}</p>
                    <p className="truncate text-sm text-stone-500">{a.role}</p>
                  </div>
                  <StatusPill status={a.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                  <span>Applied {shortDate(a.appliedOn)}</span>
                  {a.nextActionOn ? <span>· Next {shortDate(a.nextActionOn)}</span> : null}
                  {isActionDue(a, now) ? <DueBadge /> : null}
                  {isStale(a, now) ? <StaleBadge days={quietDays(a, now)} /> : null}
                </div>
              </button>
              {expanded ? (
                <ApplicationRowDetail
                  key={a._id}
                  application={a}
                  onSaved={onRowSaved}
                  onDeleted={onRowDeleted}
                  onClose={() => onToggleExpand(a)}
                />
              ) : (
                <div className="flex items-center justify-between px-4 pb-3">
                  <StarButton app={a} onToggleStar={onToggleStar} />
                  <ApplyButton app={a} onApply={onApply} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
