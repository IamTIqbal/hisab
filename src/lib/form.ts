import { redirect } from 'next/navigation';

// FormData.get() returns null for a field the browser never sent. Calling
// .trim() on that null is what turns a small validation slip into a 500, so
// every action reads its fields through these.

export function str(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

// Money is kept to two decimals: 0.001 would pass a "> 0" check yet show as
// 0.00, and unrounded inputs let float drift build up in balances.
export function num(fd: FormData, key: string): number {
  const parsed = parseFloat(str(fd, key));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

// A real calendar date as YYYY-MM-DD, or '' when missing or invalid. A stored
// "2026-13-40" would drop out of every monthly list and report (strftime
// returns NULL) while still counting in balances.
export function date(fd: FormData, key: string): string {
  const v = str(fd, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  const d = new Date(`${v}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : '';
}

export function int(fd: FormData, key: string): number {
  const parsed = parseInt(str(fd, key), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

// A thrown Error inside a server action reaches the browser as an opaque 500.
// Business-rule failures are expected, not crashes — send the user back to the
// form with something they can read and act on.
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
