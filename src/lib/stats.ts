import { weekStartOf } from "./dates";
import { RESPONDED, STATUSES, type Application, type Status } from "./types";

export { weekStartOf };

export type WeekBucket = { weekStart: string; label: string; count: number };

export type Stats = {
  total: number;
  byStatus: Record<Status, number>;
  /** Applications actually sent — anything past "Saved". */
  sent: number;
  /** Sent applications where the company came back (OA / Interview / Offer / Rejected). */
  responded: number;
  /** Sent applications that reached at least an interview. */
  interviewed: number;
  offers: number;
  responseRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  perWeek: WeekBucket[];
  /** Median days from applying to the first company response, or null if none yet. */
  medianDaysToResponse: number | null;
};


/**
 * An application counts as "sent" once it has ever left Saved. Reading the event log
 * rather than the current status means a rejected application still counts as sent.
 */
function wasSent(app: Application): boolean {
  if (app.status !== "Saved") return true;
  return app.events.some((e) => e.to !== "Saved");
}

function firstResponseAt(app: Application): string | null {
  const hit = app.events.find((e) => RESPONDED.includes(e.to));
  return hit ? hit.at : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeStats(apps: Application[], weeks = 8, now: Date = new Date()): Stats {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  for (const a of apps) byStatus[a.status] += 1;

  const sentApps = apps.filter(wasSent);
  const responded = sentApps.filter((a) => firstResponseAt(a) !== null).length;
  const interviewed = sentApps.filter((a) =>
    a.events.some((e) => e.to === "Interview" || e.to === "Offer"),
  ).length;
  const offers = sentApps.filter((a) => a.events.some((e) => e.to === "Offer")).length;

  const rate = (num: number, den: number) => (den === 0 ? null : num / den);

  // Buckets are seeded for every week in the window so a gap renders as a zero bar
  // rather than silently collapsing the timeline.
  const buckets = new Map<string, number>();
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 7 * DAY_MS);
    buckets.set(weekStartOf(d), 0);
  }
  for (const a of sentApps) {
    const when = a.appliedOn ?? a.createdAt;
    if (!when) continue;
    const key = weekStartOf(new Date(when));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  const perWeek: WeekBucket[] = [...buckets.entries()].map(([weekStart, count]) => ({
    weekStart,
    label: weekStart.slice(5).replace("-", "/"),
    count,
  }));

  const turnarounds: number[] = [];
  for (const a of sentApps) {
    const responseAt = firstResponseAt(a);
    if (!responseAt || !a.appliedOn) continue;
    const days = Math.round((new Date(responseAt).getTime() - new Date(a.appliedOn).getTime()) / DAY_MS);
    if (days >= 0) turnarounds.push(days);
  }

  return {
    total: apps.length,
    byStatus,
    sent: sentApps.length,
    responded,
    interviewed,
    offers,
    responseRate: rate(responded, sentApps.length),
    interviewRate: rate(interviewed, sentApps.length),
    offerRate: rate(offers, sentApps.length),
    perWeek,
    medianDaysToResponse: median(turnarounds),
  };
}

export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}
