"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseFilters, toSearchParams, type FilterState, type SortKey } from "@/lib/filters";
import type { Application, Status } from "@/lib/types";

import { draftOf, payloadOf } from "./applicationDraft";
import ApplicationModal from "./ApplicationModal";
import ApplicationTable from "./ApplicationTable";
import AttentionStrip from "./AttentionStrip";
import StatsBar from "./StatsBar";
import { ToastViewport, useToasts } from "./Toast";
import Toolbar from "./Toolbar";
import { useHistory } from "./useHistory";
import { useNow } from "./useNow";

export type AppShellProps = {
  initialApplications: Application[];
  initialError: string | null;
  userEmail: string | null;
  /** Admins get the editing controls; viewers get a read-only table. */
  canEdit: boolean;
  /** Sign-out lives in a server-action form, so the page passes it down. */
  signOutSlot: React.ReactNode;
  /** The server's instant, so the first client render matches the HTML exactly. */
  serverNow: number;
};

/** Every application, ignoring the current filters. */
async function fetchAll(): Promise<Application[]> {
  const res = await fetch("/api/applications");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Could not load applications");
  return json.applications as Application[];
}

export default function AppShell({
  initialApplications,
  initialError,
  userEmail,
  canEdit,
  signOutSlot,
  serverNow,
}: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  const [apps, setApps] = useState<Application[]>(initialApplications);
  // The strip and the overview answer "how is the search going overall", which the
  // current filter must not distort — so they read an unfiltered copy.
  const [allApps, setAllApps] = useState<Application[]>(initialApplications);
  const [error, setError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  // The create form is still a modal; editing an existing row happens inline in the
  // table, so all the table needs from here is which row is expanded.
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const history = useHistory();
  const { push: pushHistory, undo: undoHistory, redo: redoHistory } = history;
  const { toasts, addToast, dismiss: dismissToast } = useToasts();

  // The mutation handlers need the row as it was *before* their optimistic edit
  // (to roll back, and to build undo entries). Mirror the lists into refs so a
  // handler can read the current row without depending on it.
  const appsRef = useRef(apps);
  const allAppsRef = useRef(allApps);
  useEffect(() => {
    appsRef.current = apps;
  }, [apps]);
  useEffect(() => {
    allAppsRef.current = allApps;
  }, [allApps]);

  const now = useNow(serverNow);

  // Refetch whenever the URL's filters change. The counter guards against an older
  // request landing after a newer one and clobbering the fresher list.
  const requestId = useRef(0);
  const query = searchParams.toString();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return;
    }
    const id = ++requestId.current;
    setRefreshing(true);
    fetch(`/api/applications?${query}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not load applications");
        return json.applications as Application[];
      })
      .then((list) => {
        if (id !== requestId.current) return;
        setApps(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err.message : "Could not load applications");
      })
      .finally(() => {
        if (id === requestId.current) setRefreshing(false);
      });
  }, [query]);

  const reloadAll = useCallback(() => {
    fetchAll()
      .then(setAllApps)
      .catch(() => {
        /* The filtered list already surfaces load failures; don't double-report. */
      });
  }, []);

  const applyFilters = useCallback(
    (next: FilterState) => {
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const onSort = useCallback(
    (key: SortKey) => {
      const sameKey = filters.sort === key;
      applyFilters({ ...filters, sort: key, dir: sameKey && filters.dir === "desc" ? "asc" : "desc" });
    },
    [filters, applyFilters],
  );

  const onPickStatus = useCallback(
    (status: Status) => {
      const active = filters.status.length === 1 && filters.status[0] === status;
      applyFilters({ ...filters, status: active ? [] : [status] });
    },
    [filters, applyFilters],
  );

  const mergeRow = useCallback((saved: Application) => {
    const merge = (list: Application[]) => {
      const i = list.findIndex((a) => a._id === saved._id);
      return i === -1 ? [saved, ...list] : list.map((a) => (a._id === saved._id ? saved : a));
    };
    setApps(merge);
    setAllApps(merge);
    // The merged row is optimistic — it may no longer match the active filter.
    // Reconcile against the server rather than leaving a stale row on screen.
    reloadAll();
  }, [reloadAll]);

  const onCreated = useCallback(
    (saved: Application) => {
      mergeRow(saved);
      setCreating(false);
    },
    [mergeRow],
  );

  const onDeleted = useCallback((id: string) => {
    const drop = (list: Application[]) => list.filter((a) => a._id !== id);
    setApps(drop);
    setAllApps(drop);
    setExpandedId((current) => (current === id ? null : current));
    setCreating(false);
  }, []);

  const onToggleExpand = useCallback((app: Application) => {
    setExpandedId((current) => (current === app._id ? null : app._id));
  }, []);

  // A single PATCH against one application: optimistic patch now, reconcile with
  // the server's row on success, roll back to the pre-call row on failure. Every
  // in-place mutation below — and every undo/redo — goes through here.
  const patchApp = useCallback(
    async (
      id: string,
      body: Record<string, unknown>,
      optimistic: (a: Application) => Application,
    ) => {
      const prev =
        appsRef.current.find((a) => a._id === id) ?? allAppsRef.current.find((a) => a._id === id);
      const apply = (fn: (a: Application) => Application) => (list: Application[]) =>
        list.map((a) => (a._id === id ? fn(a) : a));

      setApps(apply(optimistic));
      setAllApps(apply(optimistic));

      try {
        const res = await fetch(`/api/applications/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not update application");
        const updated = json.application as Application;
        setApps(apply(() => updated));
        setAllApps(apply(() => updated));
      } catch (err) {
        if (prev) {
          setApps(apply(() => prev));
          setAllApps(apply(() => prev));
        }
        throw err instanceof Error ? err : new Error("Could not update application");
      }
    },
    [],
  );

  // Replay a history entry and announce the result. The keyboard shortcut and the
  // toast's own button both land here.
  const doRedo = useCallback(async () => {
    try {
      const entry = await redoHistory();
      addToast(entry ? `Redone: ${entry.label}` : "Nothing to redo", { source: "history" });
      if (entry) reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redo");
    }
  }, [redoHistory, addToast, reloadAll]);

  const doUndo = useCallback(async () => {
    try {
      const entry = await undoHistory();
      addToast(
        entry ? `Undone: ${entry.label}` : "Nothing to undo",
        entry
          ? { source: "history", action: { label: "Redo", onClick: () => void doRedo() } }
          : { source: "history" },
      );
      if (entry) reloadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not undo");
    }
  }, [undoHistory, addToast, doRedo, reloadAll]);

  const undoToastAction = useMemo(
    () => ({ label: "Undo", onClick: () => void doUndo() }),
    [doUndo],
  );

  // Inline status switch from the table / expanded detail. Optimistic, reconciled
  // against the server response (which also carries the freshly written timeline
  // entry), rolled back on failure, and pushed onto the undo history.
  const onStatusChange = useCallback(
    (app: Application, status: Status) => {
      const opt = (s: Status) => (a: Application) => ({ ...a, status: s });
      patchApp(app._id, { status }, opt(status))
        .then(() => {
          pushHistory({
            label: "status change",
            undo: () => patchApp(app._id, { status: app.status }, opt(app.status)),
            redo: () => patchApp(app._id, { status }, opt(status)),
          });
          addToast(`Moved to ${status}`, { source: `status:${app._id}`, action: undoToastAction });
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not update application");
        });
    },
    [patchApp, pushHistory, addToast, undoToastAction],
  );

  // Quick-archive buttons in the expanded detail ("Expired?", "Not qualified"):
  // switch the status, collapse this row, and open the next one in the list so the
  // user can keep triaging without reaching for the mouse. (Undo restores the
  // status only, not which row was open.)
  const onStatusAdvance = useCallback(
    (app: Application, status: Status) => {
      onStatusChange(app, status);
      setExpandedId(() => {
        const list = appsRef.current;
        const i = list.findIndex((a) => a._id === app._id);
        const next = i === -1 ? undefined : list[i + 1];
        return next ? next._id : null;
      });
    },
    [onStatusChange],
  );

  // One-click "Apply" from the table row: opens the posting (the caller does that
  // synchronously, before this resolves, so popup blockers don't eat it) and moves
  // the application out of Saved.
  const onQuickApply = useCallback(
    (app: Application) => {
      const opt = (s: Status) => (a: Application) => ({ ...a, status: s });
      patchApp(app._id, { status: "Applied" }, opt("Applied"))
        .then(() => {
          pushHistory({
            label: "apply",
            undo: () => patchApp(app._id, { status: app.status }, opt(app.status)),
            redo: () => patchApp(app._id, { status: "Applied" }, opt("Applied")),
          });
          addToast(`Applied to ${app.company}`, {
            source: `status:${app._id}`,
            action: undoToastAction,
          });
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not update application");
        });
    },
    [patchApp, pushHistory, addToast, undoToastAction],
  );

  // Star/unstar straight from the table. Optimistic, reconciled with the server
  // response, rolled back on failure, and undoable.
  const onToggleStar = useCallback(
    (app: Application) => {
      const next = !app.starred;
      const opt = (v: boolean) => (a: Application) => ({ ...a, starred: v });
      patchApp(app._id, { starred: next }, opt(next))
        .then(() => {
          pushHistory({
            label: "star",
            undo: () => patchApp(app._id, { starred: app.starred }, opt(app.starred)),
            redo: () => patchApp(app._id, { starred: next }, opt(next)),
          });
          addToast(`${next ? "Starred" : "Unstarred"} ${app.company}`, {
            source: `star:${app._id}`,
            action: undoToastAction,
          });
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not update application");
        });
    },
    [patchApp, pushHistory, addToast, undoToastAction],
  );

  // Inline edit-save from the expanded row. RowDetail has already written the row;
  // here we merge it and record an undo that PATCHes every field back to how it
  // was, with redo re-applying the saved values.
  const onRowSaved = useCallback(
    (saved: Application) => {
      const before =
        appsRef.current.find((a) => a._id === saved._id) ??
        allAppsRef.current.find((a) => a._id === saved._id);
      mergeRow(saved);
      if (!before) return;
      const beforeBody = payloadOf(draftOf(before)) as unknown as Record<string, unknown>;
      const afterBody = payloadOf(draftOf(saved)) as unknown as Record<string, unknown>;
      if (JSON.stringify(beforeBody) === JSON.stringify(afterBody)) return;
      pushHistory({
        label: "edit",
        undo: () => patchApp(saved._id, beforeBody, () => before),
        redo: () => patchApp(saved._id, afterBody, () => saved),
      });
      addToast(`Saved changes to ${saved.company}`, {
        source: `edit:${saved._id}`,
        action: undoToastAction,
      });
    },
    [mergeRow, pushHistory, patchApp, addToast, undoToastAction],
  );

  // Ctrl+Z / Ctrl+Y (or Ctrl+Shift+Z) drive undo/redo, but not while a text field
  // is focused, where those keys mean native text editing.
  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        void doUndo();
      } else if (k === "y" || (k === "z" && e.shiftKey)) {
        e.preventDefault();
        void doRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, doUndo, doRedo]);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-stone-800">Job Tracker</h1>
        {userEmail ? (
          <span className="flex max-w-full flex-wrap items-center gap-3 text-xs text-stone-500">
            <span className="max-w-[60vw] truncate sm:max-w-none">{userEmail}</span>
            {!canEdit ? (
              <span className="rounded-full bg-stone-500/12 px-2 py-0.5 font-medium text-stone-600 ring-1 ring-stone-500/25 ring-inset">
                view only
              </span>
            ) : null}
            {signOutSlot}
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-500/30 ring-inset">
          {error}
        </p>
      ) : null}

      <AttentionStrip
        applications={allApps}
        now={now}
        onOpen={(a) => setExpandedId(a._id)}
        onShowStale={() => applyFilters({ ...filters, staleOnly: true })}
      />

      <StatsBar applications={allApps} now={now} onPickStatus={onPickStatus} />

      <Toolbar
        filters={filters}
        onChange={applyFilters}
        onAdd={canEdit ? () => setCreating(true) : undefined}
        refreshing={refreshing}
      />

      <div
        aria-busy={refreshing}
        className={`transition-opacity ${refreshing ? "pointer-events-none opacity-60" : ""}`}
      >
        <ApplicationTable
          applications={apps}
          sort={filters.sort}
          dir={filters.dir}
          expandedId={expandedId}
          canEdit={canEdit}
          now={now}
          onSort={onSort}
          onToggleExpand={onToggleExpand}
          onApply={onQuickApply}
          onToggleStar={onToggleStar}
          onStatusChange={onStatusChange}
          onStatusAdvance={onStatusAdvance}
          onRowSaved={onRowSaved}
          onRowDeleted={onDeleted}
        />
      </div>

      {creating ? (
        <ApplicationModal
          application={null}
          onClose={() => setCreating(false)}
          onSaved={onCreated}
          onDeleted={onDeleted}
        />
      ) : null}

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </main>
  );
}
