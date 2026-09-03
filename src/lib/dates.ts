/**
 * Date formatting and day arithmetic, deliberately free of `toLocaleDateString` and
 * of local-time getters.
 *
 * Both were hydration hazards. The server renders in its own locale and timezone
 * (UTC on Vercel) while the browser renders in yours (en-GB, IST), so `Sep 1` on the
 * server met `1 Sept` on the client and React threw the whole tree away. Fixed month
 * names and UTC-based day keys make every render agree, wherever it runs.
 *
 * The cost is that a "day" here is a UTC day, so a follow-up dated today starts
 * counting as due at 05:30 IST rather than at midnight. For day-granularity reminders
 * that is a fair trade for markup that is identical on both sides.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Accepts either a YYYY-MM-DD calendar date or a full ISO timestamp. */
function parts(value: string): { y: number; m: number; d: number } | null {
  // A plain calendar date is read as digits, never through Date, so no timezone can
  // shift it across midnight.
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (plain) return { y: Number(plain[1]), m: Number(plain[2]) - 1, d: Number(plain[3]) };

  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return null;
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

/** "Sep 1" — the table's compact form. Returns an em dash for a missing value. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const p = parts(value);
  return p ? `${MONTHS[p.m]} ${p.d}` : "—";
}

/** "Sep 1, 2026" — the timeline's form, where the year matters. */
export function longDate(value: string | null | undefined): string {
  if (!value) return "—";
  const p = parts(value);
  return p ? `${MONTHS[p.m]} ${p.d}, ${p.y}` : "—";
}

/** UTC calendar date as YYYY-MM-DD — the format every <input type="date"> speaks. */
export function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Monday of the UTC week containing `d`, as YYYY-MM-DD. */
export function weekStartOf(d: Date): string {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (copy.getUTCDay() + 6) % 7; // Monday = 0
  copy.setUTCDate(copy.getUTCDate() - dow);
  return toDateKey(copy);
}
