import { toDateKey } from "./dates";
import type { Application, Status } from "./types";

/**
 * How long an application may sit untouched in a given status before it counts as
 * stale. Statuses that are absent are terminal (or not yet sent) and never go quiet:
 * a "Saved" row is a to-do, and Offer/Rejected/Ghosted are already finished.
 */
export const STALE_AFTER_DAYS: Partial<Record<Status, number>> = {
  Applied: 14,
  OA: 7,
  Interview: 10,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants, floored. Negative if `then` is in the future. */
export function daysSince(then: string | null | undefined, now: Date = new Date()): number | null {
  if (!then) return null;
  const t = new Date(then).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / DAY_MS);
}

/** Days an application has gone without any edit. */
export function quietDays(app: Application, now: Date = new Date()): number {
  return daysSince(app.updatedAt, now) ?? 0;
}

export function isStale(app: Application, now: Date = new Date()): boolean {
  const threshold = STALE_AFTER_DAYS[app.status];
  if (threshold === undefined) return false;
  return quietDays(app, now) >= threshold;
}

/**
 * True when a follow-up is due. `nextActionOn` is a plain calendar date, so this
 * compares dates rather than instants — something due today is due all day.
 */
export function isActionDue(app: Application, now: Date = new Date()): boolean {
  if (!app.nextActionOn) return false;
  return app.nextActionOn <= toDateKey(now);
}


export type Attention = {
  due: Application[];
  stale: Application[];
};

/** Rows that want the user's attention right now, most overdue first. */
export function attentionOf(apps: Application[], now: Date = new Date()): Attention {
  const due = apps
    .filter((a) => isActionDue(a, now))
    .sort((a, b) => (a.nextActionOn ?? "").localeCompare(b.nextActionOn ?? ""));
  const stale = apps
    .filter((a) => isStale(a, now))
    .sort((a, b) => quietDays(b, now) - quietDays(a, now));
  return { due, stale };
}
