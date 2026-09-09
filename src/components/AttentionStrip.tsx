"use client";

import { useMemo } from "react";

import { toDateKey } from "@/lib/dates";
import { attentionOf } from "@/lib/stale";
import type { Application } from "@/lib/types";

export type AttentionStripProps = {
  applications: Application[];
  onOpen: (app: Application) => void;
  onShowStale: () => void;
  now: Date;
};

/**
 * What wants attention today: follow-ups that are due, and applications that have
 * gone quiet past their status threshold. Collapses to one quiet line when both are
 * empty rather than sitting there as an empty box.
 */
export default function AttentionStrip({ applications, onOpen, onShowStale, now }: AttentionStripProps) {
  const { due, stale } = useMemo(() => attentionOf(applications, now), [applications, now]);
  const today = toDateKey(now);

  if (!due.length && !stale.length) {
    return (
      <p className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)] px-4 py-3 text-sm text-stone-500">
        Nothing needs chasing today.
      </p>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--color-edge)] bg-[var(--color-panel)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-stone-800">Needs attention</h2>
        {stale.length ? (
          <button
            type="button"
            onClick={onShowStale}
            className="text-xs text-amber-700 underline-offset-2 hover:underline"
          >
            {stale.length} gone quiet →
          </button>
        ) : null}
      </div>

      {due.length ? (
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {due.map((a) => (
            <li key={a._id}>
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex max-w-72 items-center gap-2 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-1.5 text-left text-sm text-indigo-900 transition hover:border-indigo-500/50 hover:bg-indigo-500/15"
              >
                <span className="truncate font-medium">{a.company}</span>
                <span className="truncate text-xs text-indigo-600/80">
                  {a.nextActionNote ?? "Follow up"}
                </span>
                {a.nextActionOn && a.nextActionOn < today ? (
                  <span className="shrink-0 text-xs text-amber-700">overdue</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-stone-500">No follow-ups scheduled for today.</p>
      )}
    </section>
  );
}
