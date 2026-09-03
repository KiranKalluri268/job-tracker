"use client";

import { useSyncExternalStore } from "react";

const HOUR_MS = 60 * 60 * 1000;

// Cached because `getSnapshot` must return a stable value between real changes — a
// bare `Date.now()` there would report a new value on every call and spin React.
let cachedNow = Date.now();

function subscribe(onStoreChange: () => void): () => void {
  const id = setInterval(() => {
    cachedNow = Date.now();
    onStoreChange();
  }, HOUR_MS);
  return () => clearInterval(id);
}

/**
 * The current time, hydration-safe.
 *
 * The server and the browser are never at the same instant, and a plain
 * `useState(() => new Date())` lets the two sides land on different days and throw a
 * hydration error. `useSyncExternalStore` is the API built for exactly this: it
 * renders `serverNow` during hydration so the markup matches, then re-renders with
 * the browser's own clock immediately afterwards.
 *
 * Badges here only change by the day, so refreshing hourly is plenty.
 */
export function useNow(serverNow: number): Date {
  const ms = useSyncExternalStore(subscribe, () => cachedNow, () => serverNow);
  return new Date(ms);
}
