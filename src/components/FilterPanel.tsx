"use client";

import { EMPTY_FILTERS, type FilterState } from "@/lib/filters";
import { STATUSES, WORK_MODES, type Status, type WorkMode } from "@/lib/types";

import { Field, buttonClass, inputClass } from "./ui";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${
        active
          ? "bg-indigo-500/20 text-indigo-800 ring-indigo-500/40"
          : "bg-transparent text-stone-500 ring-[var(--color-edge)] hover:text-stone-800"
      }`}
    >
      {children}
    </button>
  );
}

export type FilterPanelProps = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClose: () => void;
};

export default function FilterPanel({ filters, onChange, onClose }: FilterPanelProps) {
  const patch = (p: Partial<FilterState>) => onChange({ ...filters, ...p });

  return (
    <div className="absolute top-full right-0 z-40 mt-2 w-[min(92vw,32rem)] rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)] p-4 shadow-2xl">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">Status</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Chip
                key={s}
                active={filters.status.includes(s)}
                onClick={() => patch({ status: toggle<Status>(filters.status, s) })}
              >
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-stone-500 uppercase">Work mode</p>
          <div className="flex flex-wrap gap-1.5">
            {WORK_MODES.map((m) => (
              <Chip
                key={m}
                active={filters.workMode.includes(m)}
                onClick={() => patch({ workMode: toggle<WorkMode>(filters.workMode, m) })}
              >
                {m}
              </Chip>
            ))}
          </div>
        </div>

        <Field label="Source">
          <input
            className={inputClass}
            placeholder="LinkedIn, referral…"
            value={filters.source}
            onChange={(e) => patch({ source: e.target.value })}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Applied from">
            <input
              type="date"
              className={inputClass}
              value={filters.appliedFrom}
              onChange={(e) => patch({ appliedFrom: e.target.value })}
            />
          </Field>
          <Field label="Applied to">
            <input
              type="date"
              className={inputClass}
              value={filters.appliedTo}
              onChange={(e) => patch({ appliedTo: e.target.value })}
            />
          </Field>
          <Field label="Next action from">
            <input
              type="date"
              className={inputClass}
              value={filters.nextFrom}
              onChange={(e) => patch({ nextFrom: e.target.value })}
            />
          </Field>
          <Field label="Next action to">
            <input
              type="date"
              className={inputClass}
              value={filters.nextTo}
              onChange={(e) => patch({ nextTo: e.target.value })}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-stone-600">
          <input
            type="checkbox"
            className="size-4 accent-indigo-500"
            checked={filters.staleOnly}
            onChange={(e) => patch({ staleOnly: e.target.checked })}
          />
          Only ones that have gone quiet
        </label>

        <label className="flex items-center gap-2.5 text-sm text-stone-600">
          <input
            type="checkbox"
            className="size-4 accent-indigo-500"
            checked={filters.starredOnly}
            onChange={(e) => patch({ starredOnly: e.target.checked })}
          />
          Starred only
        </label>
      </div>

      <div className="mt-4 flex justify-between gap-2 border-t border-[var(--color-edge)] pt-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort, dir: filters.dir })}
        >
          Clear all
        </button>
        <button type="button" className={buttonClass} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
