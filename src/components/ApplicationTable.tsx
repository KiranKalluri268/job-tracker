"use client";

import { Fragment, useEffect, useRef, useState } from "react";

import { shortDate } from "@/lib/dates";
import type { SortKey } from "@/lib/filters";
import { isActionDue, isStale, quietDays } from "@/lib/stale";
import type { Application, Priority, Status } from "@/lib/types";
import { PRIORITIES, RESPONDED, STATUSES, priorityRank } from "@/lib/types";

import ApplicationRowDetail from "./ApplicationRowDetail";
import { PriorityPill, StatusPill, inputClass } from "./ui";

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: null, label: "" },
  { key: "company", label: "Company" },
  { key: null, label: "Role" },
  { key: "status", label: "Status" },
  { key: null, label: "Priority" },
  { key: "appliedOn", label: "Applied" },
  { key: "nextActionOn", label: "Next action" },
  { key: null, label: "Source" },
  { key: "createdAt", label: "Created" },
  { key: null, label: "Actions" },
];

/** Outcomes that drop to their own table at the bottom. */
const ARCHIVED_STATUSES: readonly Status[] = [
  "Rejected",
  "Not qualified",
  "Expired",
  "Ghosted",
  "Not interested",
  "Broken link",
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
  canEdit,
  onStatusChange,
}: {
  app: Application;
  canEdit: boolean;
  onStatusChange: (app: Application, status: Status) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!canEdit) return <StatusPill status={app.status} />;

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
 * The priority cell: a pill until clicked, then an inline <select> that switches
 * the priority straight away. Mirrors StatusCell's click-to-edit interaction.
 */
function PriorityCell({
  app,
  canEdit,
  onPriorityChange,
}: {
  app: Application;
  canEdit: boolean;
  onPriorityChange: (app: Application, priority: Priority) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!canEdit) return <PriorityPill priority={app.priority} />;

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
        aria-label={`Change priority, currently ${app.priority}`}
      >
        <PriorityPill priority={app.priority} />
      </button>
    );
  }

  return (
    <select
      autoFocus
      className={`${inputClass} w-auto py-1`}
      value={app.priority}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => setOpen(false)}
      onChange={(e) => {
        e.stopPropagation();
        const next = e.target.value as Priority;
        setOpen(false);
        if (next !== app.priority) onPriorityChange(app, next);
      }}
    >
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {p}
        </option>
      ))}
    </select>
  );
}

/**
 * Opens the posting (if there is one). For an admin it also marks the application
 * Applied in the same click; for a viewer it only opens the link. Stops propagation
 * so it doesn't also toggle the row's expansion (which would race the new tab).
 */
function ApplyButton({
  app,
  canEdit,
  onApply,
}: {
  app: Application;
  canEdit: boolean;
  onApply: (app: Application) => void;
}) {
  if (app.status !== "Saved") return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (app.postingUrl) window.open(app.postingUrl, "_blank", "noopener,noreferrer");
        if (canEdit) onApply(app);
      }}
      className="inline-flex items-center rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-indigo-500"
    >
      Apply
    </button>
  );
}

/**
 * The role label, linked to the posting URL when there is one. Stops propagation
 * so opening the posting doesn't also toggle the row's expansion.
 */
function RoleLabel({ app, className }: { app: Application; className?: string }) {
  if (!app.postingUrl) return <span className={className}>{app.role}</span>;
  return (
    <a
      href={app.postingUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`text-blue-600 underline-offset-2 hover:underline ${className ?? ""}`}
    >
      {app.role}
    </a>
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

const BOOKMARK_STORAGE_KEY = "jobTracker.bookmarkPosition";

/**
 * A full-width divider dropped between Saved rows, marking how far triage has
 * gotten. It can be dragged by its handle for smooth, continuous movement, or
 * nudged one row at a time with the arrows; position is clamped to the
 * current Saved count so it never floats past either end.
 */
function BookmarkDivider({
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragMove,
  onDragEnd,
  dragging,
  atTop,
  atBottom,
  colSpan,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onDragMove: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onDragEnd: (e: React.PointerEvent<HTMLButtonElement>) => void;
  dragging: boolean;
  atTop: boolean;
  atBottom: boolean;
  colSpan?: number;
}) {
  const bar = (
    <div
      className={`flex items-center gap-2 border-y-2 border-dashed border-indigo-500 bg-indigo-500/10 px-4 py-1 ${
        dragging ? "bg-indigo-500/20" : ""
      }`}
    >
      <button
        type="button"
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
        aria-label="Drag to move bookmark"
        className={`touch-none rounded-md px-1.5 text-sm text-indigo-700 transition select-none hover:bg-indigo-500/15 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        ⠿
      </button>
      <span className="text-xs font-semibold tracking-wide text-indigo-700 uppercase">Bookmark</span>
      <span className="flex-1" />
      <button
        type="button"
        onClick={onMoveUp}
        disabled={atTop}
        aria-label="Move bookmark up"
        className="rounded-md px-1.5 text-sm text-indigo-700 transition hover:bg-indigo-500/15 disabled:opacity-30"
      >
        ▲
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={atBottom}
        aria-label="Move bookmark down"
        className="rounded-md px-1.5 text-sm text-indigo-700 transition hover:bg-indigo-500/15 disabled:opacity-30"
      >
        ▼
      </button>
    </div>
  );

  if (colSpan === undefined) return <li aria-hidden={false}>{bar}</li>;
  return (
    <tr aria-hidden={false}>
      <td colSpan={colSpan} className="p-0">
        {bar}
      </td>
    </tr>
  );
}

export type TableProps = {
  applications: Application[];
  sort: SortKey;
  dir: "asc" | "desc";
  expandedId: string | null;
  canEdit: boolean;
  /** Sorts Saved jobs by posting date within each star/priority tier and shows
   *  the movable triage bookmark among them. */
  bookmarkMode: boolean;
  onSort: (key: SortKey) => void;
  onToggleExpand: (app: Application) => void;
  onApply: (app: Application) => void;
  onToggleStar: (app: Application) => void;
  onStatusChange: (app: Application, status: Status) => void;
  onPriorityChange: (app: Application, priority: Priority) => void;
  onStatusAdvance: (app: Application, status: Status) => void;
  onRowSaved: (app: Application) => void;
  onRowDeleted: (id: string) => void;
  now: Date;
};

export default function ApplicationTable({
  applications,
  sort,
  dir,
  expandedId,
  canEdit,
  bookmarkMode,
  onSort,
  onToggleExpand,
  onApply,
  onToggleStar,
  onStatusChange,
  onPriorityChange,
  onStatusAdvance,
  onRowSaved,
  onRowDeleted,
  now,
}: TableProps) {
  const [showClosed, setShowClosed] = useState(false);

  // Where the bookmark sits among Saved rows, as an index into that group (0 =
  // above the first row, length = below the last). Persisted so it survives a
  // reload; clamped against the current Saved count on every render since that
  // count can shrink out from under a stale stored value.
  const [bookmarkPos, setBookmarkPos] = useState(() => {
    try {
      const stored = Number(localStorage.getItem(BOOKMARK_STORAGE_KEY));
      return Number.isFinite(stored) && stored >= 0 ? stored : 0;
    } catch {
      // localStorage may be unavailable (SSR, private mode, disabled storage).
      return 0;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARK_STORAGE_KEY, String(bookmarkPos));
    } catch {
      /* Nothing to fall back to — the position just won't survive a reload. */
    }
  }, [bookmarkPos]);

  // The bookmark drag reads row positions straight from the DOM rather than
  // through refs: every Saved row carries a data-bookmark-id attribute, and
  // drag-start collects them (in document order, which matches notApplied's
  // order) from whichever table/list contains the handle that was grabbed.
  // The row list and the latest pointer Y live in refs so a burst of
  // pointermove events collapses into one state update per animation frame
  // instead of one per event — mutated only from inside these handlers, never
  // read during render.
  const dragEls = useRef<HTMLElement[] | null>(null);
  const dragY = useRef<number | null>(null);
  const dragFrame = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(
    () => () => {
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    },
    [],
  );

  const startDrag = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const container = e.currentTarget.closest("table, ul");
    dragEls.current = container
      ? Array.from(container.querySelectorAll<HTMLElement>("[data-bookmark-id]"))
      : [];
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragEls.current) return;
    dragY.current = e.clientY;
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      const els = dragEls.current;
      const y = dragY.current;
      if (!els || y === null) return;
      let idx = els.length;
      for (let i = 0; i < els.length; i++) {
        const rect = els[i].getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          idx = i;
          break;
        }
      }
      setBookmarkPos(idx);
    });
  };

  const endDrag = () => {
    dragEls.current = null;
    dragY.current = null;
    setDragging(false);
  };

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

  // The list arrives already sorted and filtered by the chosen column. On top of
  // that, rows always bucket by starred+priority first — starred-high, then
  // high, then starred-low, then low — with the chosen sort breaking ties within
  // each bucket (Array#sort is stable, so this only reorders across buckets).
  const byPriority = [...applications].sort((a, b) => priorityRank(a) - priorityRank(b));

  // Splitting here keeps each table sorted and filtered on its own — an archived
  // row never sorts up among the live ones, and vice versa.
  const live = byPriority.filter((a) => !ARCHIVED_STATUSES.includes(a.status));
  const archived = byPriority.filter((a) => ARCHIVED_STATUSES.includes(a.status));

  // The live rows split three ways, in the order they appear down the table:
  //   1. not applied yet ("Saved")
  //   2. applied and the company came back (RESPONDED)
  //   3. applied, still waiting — the pool that eventually goes Ghosted
  let notApplied = live.filter((a) => a.status === "Saved");
  const responded = live.filter((a) => a.status !== "Saved" && RESPONDED.includes(a.status));
  const awaiting = live.filter((a) => a.status !== "Saved" && !RESPONDED.includes(a.status));

  // Bookmark mode re-sorts just the Saved queue by posting date within each
  // star/priority tier — the order you actually want to apply in — and shows
  // where triage has gotten to.
  if (bookmarkMode) {
    notApplied = [...notApplied].sort(
      (a, b) => priorityRank(a) - priorityRank(b) || a.createdAt.localeCompare(b.createdAt),
    );
  }
  const showBookmark = bookmarkMode && notApplied.length > 0;
  const clampedBookmarkPos = Math.min(bookmarkPos, notApplied.length);
  const moveBookmark = (delta: number) =>
    setBookmarkPos(Math.max(0, Math.min(notApplied.length, clampedBookmarkPos + delta)));

  const liveGroups = [notApplied, responded, awaiting].filter((g) => g.length);

  const desktopRow = (a: Application) => {
    const stale = isStale(a, now);
    const expanded = expandedId === a._id;
    return (
      <Fragment key={a._id}>
        <tr
          data-bookmark-id={a._id}
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
            {canEdit ? (
              <StarButton app={a} onToggleStar={onToggleStar} />
            ) : a.starred ? (
              <span className="text-base leading-none text-amber-500">★</span>
            ) : null}
          </td>
          <td className="px-4 py-3 font-medium text-stone-800">
            <div className="flex items-center gap-2">
              {a.company}
              {stale ? <StaleBadge days={quietDays(a, now)} /> : null}
            </div>
          </td>
          <td className="px-4 py-3 text-stone-600">
            <RoleLabel app={a} />
            {a.location ? <span className="block text-xs text-stone-500">{a.location}</span> : null}
          </td>
          <td className="px-4 py-3">
            <StatusCell app={a} canEdit={canEdit} onStatusChange={onStatusChange} />
          </td>
          <td className="px-4 py-3">
            <PriorityCell app={a} canEdit={canEdit} onPriorityChange={onPriorityChange} />
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
          <td className="px-4 py-3 text-stone-500">{shortDate(a.createdAt)}</td>
          <td className="px-4 py-3">
            <ApplyButton app={a} canEdit={canEdit} onApply={onApply} />
          </td>
        </tr>
        {expanded ? (
          <tr>
            <td colSpan={COLUMNS.length} className="border-b border-[var(--color-edge)] p-0">
              <ApplicationRowDetail
                key={a._id}
                application={a}
                canEdit={canEdit}
                onSaved={onRowSaved}
                onDeleted={onRowDeleted}
                onClose={() => onToggleExpand(a)}
                onQuickStatus={(status) => onStatusAdvance(a, status)}
              />
            </td>
          </tr>
        ) : null}
      </Fragment>
    );
  };

  const mobileCard = (a: Application) => {
    const expanded = expandedId === a._id;
    return (
      <li
        key={a._id}
        data-bookmark-id={a._id}
        className={`overflow-hidden rounded-xl border ${
          expanded ? "border-indigo-500/40" : "border-[var(--color-edge)]"
        }`}
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => onToggleExpand(a)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpand(a);
            }
          }}
          className="w-full bg-[var(--color-panel)] px-4 py-3 text-left transition active:bg-black/5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-stone-800">{a.company}</p>
              <p className="truncate text-sm text-stone-500">
                <RoleLabel app={a} />
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusCell app={a} canEdit={canEdit} onStatusChange={onStatusChange} />
              <PriorityCell app={a} canEdit={canEdit} onPriorityChange={onPriorityChange} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-500">
            {a.appliedOn ? <span>Applied {shortDate(a.appliedOn)}</span> : null}
            {a.nextActionOn ? (
              <span>{a.appliedOn ? "· " : ""}Next {shortDate(a.nextActionOn)}</span>
            ) : null}
            {isActionDue(a, now) ? <DueBadge /> : null}
            {isStale(a, now) ? <StaleBadge days={quietDays(a, now)} /> : null}
          </div>
        </div>
        {expanded ? (
          <ApplicationRowDetail
            key={a._id}
            application={a}
            canEdit={canEdit}
            onSaved={onRowSaved}
            onDeleted={onRowDeleted}
            onClose={() => onToggleExpand(a)}
            onQuickStatus={(status) => onStatusAdvance(a, status)}
          />
        ) : (
          <div className="flex items-center justify-between px-4 pb-3">
            {canEdit ? (
              <StarButton app={a} onToggleStar={onToggleStar} />
            ) : a.starred ? (
              <span className="text-base leading-none text-amber-500">★</span>
            ) : null}
            <ApplyButton app={a} canEdit={canEdit} onApply={onApply} />
          </div>
        )}
      </li>
    );
  };

  // Interleaves the bookmark divider into the Saved group's rows at its current
  // position; every other group renders as-is.
  const desktopGroupRows = (group: Application[]) => {
    if (group !== notApplied || !showBookmark) return group.map(desktopRow);
    const dividerProps = {
      onMoveUp: () => moveBookmark(-1),
      onMoveDown: () => moveBookmark(1),
      onDragStart: startDrag,
      onDragMove,
      onDragEnd: endDrag,
      dragging,
      colSpan: COLUMNS.length,
    };
    const rows: React.ReactNode[] = [];
    group.forEach((a, idx) => {
      if (idx === clampedBookmarkPos) {
        rows.push(
          <BookmarkDivider
            key="bookmark"
            {...dividerProps}
            atTop={clampedBookmarkPos === 0}
            atBottom={clampedBookmarkPos === notApplied.length}
          />,
        );
      }
      rows.push(desktopRow(a));
    });
    if (clampedBookmarkPos === group.length) {
      rows.push(<BookmarkDivider key="bookmark" {...dividerProps} atTop={clampedBookmarkPos === 0} atBottom />);
    }
    return rows;
  };

  const mobileGroupItems = (group: Application[]) => {
    if (group !== notApplied || !showBookmark) return group.map(mobileCard);
    const dividerProps = {
      onMoveUp: () => moveBookmark(-1),
      onMoveDown: () => moveBookmark(1),
      onDragStart: startDrag,
      onDragMove,
      onDragEnd: endDrag,
      dragging,
    };
    const items: React.ReactNode[] = [];
    group.forEach((a, idx) => {
      if (idx === clampedBookmarkPos) {
        items.push(
          <BookmarkDivider
            key="bookmark"
            {...dividerProps}
            atTop={clampedBookmarkPos === 0}
            atBottom={clampedBookmarkPos === notApplied.length}
          />,
        );
      }
      items.push(mobileCard(a));
    });
    if (clampedBookmarkPos === group.length) {
      items.push(<BookmarkDivider key="bookmark" {...dividerProps} atTop={clampedBookmarkPos === 0} atBottom />);
    }
    return items;
  };

  return (
    <>
      {/* Desktop: a real table. Archived rows sit in a second <tbody> so the
          columns still line up, separated by a spacer row and with no header of
          their own. */}
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
          {liveGroups.map((group, i) => (
            <tbody key={i}>
              {i > 0 ? (
                <tr aria-hidden>
                  <td colSpan={COLUMNS.length} className="h-4 bg-[var(--color-ink)]" />
                </tr>
              ) : null}
              {desktopGroupRows(group)}
            </tbody>
          ))}
        </table>
      </div>

      {/* Mobile: the same live rows as stacked cards. */}
      {liveGroups.map((group, i) => (
        <ul key={i} className={`space-y-2 md:hidden ${i > 0 ? "mt-6" : ""}`}>
          {mobileGroupItems(group)}
        </ul>
      ))}

      {/* Closed applications live in their own table, collapsed by default.
          They are already loaded — the toggle just avoids rendering a long
          tail of finished rows nobody is looking at. */}
      {archived.length ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-[var(--color-edge)]">
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            className="flex w-full items-center justify-between bg-[var(--color-panel)] px-4 py-3 text-left text-sm font-medium text-stone-600 transition hover:text-stone-900"
            aria-expanded={showClosed}
          >
            <span>
              {showClosed ? "Hide" : "Fetch"} closed applications
              <span className="ml-2 text-stone-400">({archived.length})</span>
            </span>
            <span aria-hidden className="text-stone-400">
              {showClosed ? "▲" : "▼"}
            </span>
          </button>

          {showClosed ? (
            <>
              <div className="hidden overflow-x-auto border-t border-[var(--color-edge)] md:block">
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
                  <tbody>{archived.map(desktopRow)}</tbody>
                </table>
              </div>
              <ul className="space-y-2 border-t border-[var(--color-edge)] p-3 md:hidden">
                {archived.map(mobileCard)}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
