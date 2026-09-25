"use client";

import { useEffect, useRef, useState } from "react";

import { activeFilterCount, toSearchParams, type FilterState } from "@/lib/filters";

import FilterPanel from "./FilterPanel";
import { Spinner, buttonClass, inputClass, primaryButtonClass } from "./ui";

export type ToolbarProps = {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Omitted for view-only users, who get no "Add" button. */
  onAdd?: () => void;
  refreshing: boolean;
  /** Whether the triage bookmark (Saved jobs only) is turned on. */
  bookmarkMode: boolean;
  onToggleBookmark: () => void;
};

export default function Toolbar({
  filters,
  onChange,
  onAdd,
  refreshing,
  bookmarkMode,
  onToggleBookmark,
}: ToolbarProps) {
  // The input is uncontrolled-ish: it echoes keystrokes instantly and only pushes to
  // the URL after a pause, so typing never waits on a round trip.
  const [text, setText] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const activeCount = activeFilterCount(filters);

  // When the URL's `q` changes from somewhere other than this box (back button, a
  // cleared filter), pull the box back in line. Adjusting state during render rather
  // than in an effect avoids the extra render pass — the pattern React documents for
  // "a prop changed and some state derived from it must reset".
  const [lastQ, setLastQ] = useState(filters.q);
  if (filters.q !== lastQ) {
    setLastQ(filters.q);
    setText(filters.q);
  }

  useEffect(() => {
    if (text === filters.q) return;
    const id = setTimeout(() => onChange({ ...filters, q: text }), 250);
    return () => clearTimeout(id);
  }, [text, filters, onChange]);

  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setPanelOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  const exportHref = `/api/applications/export?${toSearchParams(filters).toString()}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search company, role, notes, location…"
          aria-label="Search applications"
          className={`${inputClass} pr-16`}
        />
        {refreshing ? (
          <Spinner className="absolute top-1/2 right-3 -translate-y-1/2" />
        ) : null}
      </div>

      <div className="relative" ref={wrapRef}>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-busy={refreshing}
          className={buttonClass}
        >
          Filter
          {activeCount ? (
            <span className="rounded-full bg-indigo-500/20 px-1.5 text-xs font-semibold text-indigo-700 tabular-nums">
              {activeCount}
            </span>
          ) : null}
          {refreshing ? <Spinner /> : null}
        </button>
        {panelOpen ? (
          <FilterPanel
            filters={filters}
            onChange={onChange}
            onClose={() => setPanelOpen(false)}
            refreshing={refreshing}
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggleBookmark}
        aria-pressed={bookmarkMode}
        title="Track a movable bookmark through Saved jobs, sorted by posting date within each star/priority tier"
        className={
          bookmarkMode
            ? "inline-flex items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-500/15 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-500/20"
            : buttonClass
        }
      >
        🔖 Bookmark
      </button>

      {/* A plain link so the browser handles the download and the CSV inherits the
          current filters straight from the URL. */}
      <a href={exportHref} className={buttonClass} download>
        Export
      </a>

      {onAdd ? (
        <button type="button" onClick={onAdd} className={primaryButtonClass}>
          + Add
        </button>
      ) : null}
    </div>
  );
}
