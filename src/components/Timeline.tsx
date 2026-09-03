"use client";

import { longDate } from "@/lib/dates";
import type { AppEvent } from "@/lib/types";

import { StatusPill } from "./ui";


/** Read-only history, newest first. Written server-side on every status change. */
export default function Timeline({ events }: { events: AppEvent[] }) {
  if (!events.length) {
    return <p className="text-sm text-zinc-500">No history yet.</p>;
  }

  return (
    <ol className="relative space-y-4 border-l border-[var(--color-edge)] pl-5">
      {[...events].reverse().map((e, i) => (
        <li key={`${e.at}-${i}`} className="relative">
          <span className="absolute top-1.5 -left-[23px] size-2.5 rounded-full bg-zinc-600 ring-4 ring-[var(--color-panel)]" />
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={e.to} />
            {e.from ? <span className="text-xs text-zinc-500">from {e.from}</span> : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{longDate(e.at)}</p>
          {e.note ? <p className="mt-1 text-sm text-zinc-300">{e.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}
