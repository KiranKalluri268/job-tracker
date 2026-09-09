"use client";

import type { Status } from "@/lib/types";
import { STATUS_TONE } from "@/lib/types";

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[status]}`}
    >
      {status}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium tracking-wide text-stone-500 uppercase">{label}</span>
      {children}
      {hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel-2)] px-3 py-2 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20";

export const buttonClass =
  "inline-flex items-center gap-2 rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel-2)] px-3 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonClass =
  "inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";
