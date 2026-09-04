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

/** `null` = the create modal; a string = editing that id; `undefined` = closed. */
type Editing = string | null | undefined;

export type AppShellProps = {
  initialApplications: Application[];
  initialError: string | null;
  userEmail: string | null;
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
  const [editing, setEditing] = useState<Editing>(undefined);

  const now = useNow(serverNow);

  const editingApp = editing ? (allApps.find((a) => a._id === editing) ?? null) : null;
  const modalOpen = editing !== undefined;

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

  const onSaved = useCallback(
    (saved: Application) => {
      const merge = (list: Application[]) => {
        const i = list.findIndex((a) => a._id === saved._id);
        return i === -1 ? [saved, ...list] : list.map((a) => (a._id === saved._id ? saved : a));
      };
      setApps(merge);
      setAllApps(merge);
      setEditing(undefined);
      // The merged row is optimistic — it may no longer match the active filter.
      // Reconcile against the server rather than leaving a stale row on screen.
      reloadAll();
    },
    [reloadAll],
  );

  const onDeleted = useCallback((id: string) => {
    const drop = (list: Application[]) => list.filter((a) => a._id !== id);
    setApps(drop);
    setAllApps(drop);
    setEditing(undefined);
  }, []);

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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-100">Job Tracker</h1>
        {userEmail ? (
          <span className="flex items-center gap-3 text-xs text-zinc-500">
            {userEmail}
            {signOutSlot}
          </span>
        ) : null}
      </header>

      {error ? (
        <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30 ring-inset">
          {error}
        </p>
      ) : null}

      <AttentionStrip
        applications={allApps}
        now={now}
        onOpen={(a) => setEditing(a._id)}
        onShowStale={() => applyFilters({ ...filters, staleOnly: true })}
      />

      <StatsBar applications={allApps} now={now} onPickStatus={onPickStatus} />

      <Toolbar filters={filters} onChange={applyFilters} onAdd={() => setEditing(null)} refreshing={refreshing} />

      <ApplicationTable
        applications={apps}
        sort={filters.sort}
        dir={filters.dir}
        now={now}
        onSort={onSort}
        onOpen={(a) => setEditing(a._id)}
        onApply={onQuickApply}
      />

      {modalOpen ? (
        <ApplicationModal
          application={editingApp}
          onClose={() => setEditing(undefined)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      ) : null}
    </main>
  );
}
