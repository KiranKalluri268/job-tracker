"use client";

import { useMemo, useState } from "react";

import { computeStats, formatRate } from "@/lib/stats";
import type { Application, Status } from "@/lib/types";
import { STATUSES, STATUS_TONE } from "@/lib/types";

/**
 * A single-series column chart of applications sent per week. One hue, no legend —
 * the heading names the series — with a recessive baseline and a per-bar hover
 * tooltip. Bars are plain divs rather than SVG so the labels inherit text tokens.
 */
function WeeklyBars({ weeks }: { weeks: { weekStart: string; label: string; count: number }[] }) {
  const peak = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">Sent per week</p>
      <div className="mt-3 flex h-24 items-end gap-1.5 border-b border-[var(--color-edge)] pb-0">
        {weeks.map((w) => (
          <div key={w.weekStart} className="group relative flex flex-1 flex-col justify-end">
            {/* Non-zero weeks keep a visible stub so the baseline reads as a baseline. */}
            <div
              className="w-full rounded-t bg-indigo-500/70 transition group-hover:bg-indigo-500"
              style={{ height: `${w.count === 0 ? 2 : Math.max(6, (w.count / peak) * 84)}px` }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border border-[var(--color-edge)] bg-[var(--color-panel-2)] px-2 py-1 text-xs whitespace-nowrap text-stone-800 opacity-0 transition group-hover:opacity-100">
              {w.count} · week of {w.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-stone-400">
        <span>{weeks[0]?.label}</span>
        <span>{weeks[weeks.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function Tile({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-edge)] bg-[var(--color-panel-2)] px-3 py-2.5">
      <p className="text-xl font-semibold text-stone-800 tabular-nums">{value}</p>
      <p className="text-xs text-stone-500">{label}</p>
      {hint ? <p className="text-[11px] text-stone-400">{hint}</p> : null}
    </div>
  );
}

export type StatsBarProps = {
  applications: Application[];
  onPickStatus: (status: Status) => void;
  now: Date;
};

export default function StatsBar({ applications, onPickStatus, now }: StatsBarProps) {
  const [open, setOpen] = useState(true);
  const stats = useMemo(() => computeStats(applications, 8, now), [applications, now]);

  return (
    <section className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-stone-800">
          Overview
          <span className="ml-2 font-normal text-stone-500">
            {stats.total} tracked · {stats.sent} sent
          </span>
        </span>
        <span className="text-xs text-stone-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="grid gap-5 border-t border-[var(--color-edge)] px-4 py-4 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
                Pipeline
                <span className="ml-2 font-normal normal-case">click to filter</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPickStatus(s)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition hover:brightness-95 ${STATUS_TONE[s]}`}
                  >
                    {s}
                    <span className="tabular-nums opacity-70">{stats.byStatus[s]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile
                value={formatRate(stats.responseRate)}
                label="Response rate"
                hint={`${stats.responded}/${stats.sent}`}
              />
              <Tile
                value={formatRate(stats.interviewRate)}
                label="Interview rate"
                hint={`${stats.interviewed}/${stats.sent}`}
              />
              <Tile value={String(stats.offers)} label="Offers" />
              <Tile
                value={stats.medianDaysToResponse === null ? "—" : `${stats.medianDaysToResponse}d`}
                label="Median reply"
                hint="applied → first reply"
              />
            </div>
          </div>

          <WeeklyBars weeks={stats.perWeek} />
        </div>
      ) : null}
    </section>
  );
}
