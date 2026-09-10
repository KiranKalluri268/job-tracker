"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { parseFilters, toSearchParams, type FilterState, type SortKey } from "@/lib/filters";
import type { Application, Status } from "@/lib/types";

import ApplicationModal from "./ApplicationModal";
import ApplicationTable from "./ApplicationTable";
import AttentionStrip from "./AttentionStrip";
import StatsBar from "./StatsBar";
import Toolbar from "./Toolbar";
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

  // Inline status switch from the table. Optimistic, reconciled against the server
  // response (which also carries the freshly written timeline entry), rolled back
  // on failure.
  const onStatusChange = useCallback((app: Application, status: Status) => {
    const setStatus = (value: Status) => (list: Application[]) =>
      list.map((a) => (a._id === app._id ? { ...a, status: value } : a));
    setApps(setStatus(status));
    setAllApps(setStatus(status));

    fetch(`/api/applications/${app._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not update application");
        return json.application as Application;
      })
      .then((updated) => {
        const merge = (list: Application[]) => list.map((a) => (a._id === updated._id ? updated : a));
        setApps(merge);
        setAllApps(merge);
      })
      .catch((err: unknown) => {
        setApps(setStatus(app.status));
        setAllApps(setStatus(app.status));
        setError(err instanceof Error ? err.message : "Could not update application");
      });
  }, []);

  // Quick-archive buttons in the expanded detail ("Expired?", "Not qualified"):
  // switch the status, collapse this row, and open the next one in the list so the
  // user can keep triaging without reaching for the mouse.
  const onStatusAdvance = useCallback(
    (app: Application, status: Status) => {
      onStatusChange(app, status);
      setExpandedId(() => {
        const i = apps.findIndex((a) => a._id === app._id);
        const next = i === -1 ? undefined : apps[i + 1];
        return next ? next._id : null;
      });
    },
    [apps, onStatusChange],
  );

  // One-click "Apply" from the table row: opens the posting (the caller does that
  // synchronously, before this resolves, so popup blockers don't eat it) and moves
  // the application out of Saved. Reuses onSaved so the row merges the same way an
  // edit from the modal would.
  const onQuickApply = useCallback(
    (app: Application) => {
      fetch(`/api/applications/${app._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Applied" }),
      })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Could not update application");
          return json.application as Application;
        })
        .then((updated) => {
          const merge = (list: Application[]) => list.map((a) => (a._id === updated._id ? updated : a));
          setApps(merge);
          setAllApps(merge);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Could not update application");
        });
    },
    [],
  );

  // Star/unstar straight from the table. Optimistic: flip the row now, reconcile
  // with the server response, and roll back on failure.
  const onToggleStar = useCallback((app: Application) => {
    const next = !app.starred;
    const setStar = (value: boolean) => (list: Application[]) =>
      list.map((a) => (a._id === app._id ? { ...a, starred: value } : a));
    setApps(setStar(next));
    setAllApps(setStar(next));

    fetch(`/api/applications/${app._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred: next }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Could not update application");
        return json.application as Application;
      })
      .then((updated) => {
        const merge = (list: Application[]) => list.map((a) => (a._id === updated._id ? updated : a));
        setApps(merge);
        setAllApps(merge);
      })
      .catch((err: unknown) => {
        setApps(setStar(app.starred));
        setAllApps(setStar(app.starred));
        setError(err instanceof Error ? err.message : "Could not update application");
      });
  }, []);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-stone-800">Job Tracker</h1>
        {userEmail ? (
          <span className="flex items-center gap-3 text-xs text-stone-500">
            {userEmail}
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
        onRowSaved={mergeRow}
        onRowDeleted={onDeleted}
      />

      {creating ? (
        <ApplicationModal
          application={null}
          onClose={() => setCreating(false)}
          onSaved={onCreated}
          onDeleted={onDeleted}
        />
      ) : null}
    </main>
  );
}
