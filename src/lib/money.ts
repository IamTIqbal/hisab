import { prefs } from './prefs';
import { bankLogoFor } from './bankLogos';

// Amounts are shown with the owner's currency symbol and grouping (Settings):
// South Asian groups lakhs and crores (1,00,000), international groups
// thousands (100,000). Defaults are ৳ and South Asian.
const FORMATTERS = {
  'south-asian': new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  international: new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
};

// 171381.5 → "1,71,381.50" (no symbol).
export function money(value: number): string {
  return FORMATTERS[prefs().grouping].format(value);
}

export function currencySymbol(): string {
  return prefs().currencySymbol;
}

// 171381.5 → "৳1,71,381.50"
export function moneyWithSymbol(value: number): string {
  return `${currencySymbol()}${money(value)}`;
}

export function accountIconMeta(name: string, type: string): {
  kind: 'image' | 'symbol';
  src?: string;
  alt?: string;
  symbol?: string;
  bg?: string;
} {
  const logo = bankLogoFor(name);
  if (logo) return { kind: 'image', ...logo };
  if (type === 'cash') return { kind: 'symbol', symbol: currencySymbol(), bg: 'mark-cash' };
  if (type === 'credit') return { kind: 'symbol', symbol: '▭', bg: 'mark-card' };
  // Any other bank or wallet: a neutral badge with its first letter.
  const initial = name.trim().charAt(0).toUpperCase() || '#';
  return { kind: 'symbol', symbol: initial };
}

// Today's date in the owner's time zone, as YYYY-MM-DD.
export function todayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: prefs().timezone });
}

export function currentMonth(): string {
  return todayDate().slice(0, 7);
}

export function currentYear(): string {
  return todayDate().slice(0, 4);
}

// What the expense form offers. Kept short on purpose: twenty-odd overlapping
// categories (bills / utilities / electricity / wifi / internet …) made the
// list slow to pick from and the totals hard to read.
export const EXPENSE_CATEGORIES = [
  'food', 'transport', 'bills', 'rent', 'shopping', 'health',
  'education', 'family', 'travel', 'entertainment', 'emi', 'others',
] as const;

export function isPickableCategory(c: string): boolean {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(c);
}

export const INCOME_SOURCES = ['salary', 'business', 'cash', 'other'] as const;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Display helpers ─────────────────────────────────────────────────────────

// "2026-11-07" → "Saturday, 7 November". Parsed at noon UTC so the weekday
// cannot slip a day across time zones.
export function formatDay(isoDate: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: opts.weekday === false ? undefined : 'long',
    day: 'numeric',
    month: 'long',
    year: opts.year ? 'numeric' : undefined,
  });
}

export function relativeDay(isoDate: string): string {
  const today = todayDate();
  if (isoDate === today) return 'Today';
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (isoDate === y.toISOString().slice(0, 10)) return 'Yesterday';
  return formatDay(isoDate, { year: isoDate.slice(0, 4) !== today.slice(0, 4) });
}

// "2026-11" → "November 2026"
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function groupByDate<T>(rows: T[], dateOf: (row: T) => string): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = dateOf(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries());
}

const UPPER_WORDS = new Set(['emi', 'wifi']);
export function titleCase(value: string): string {
  if (UPPER_WORDS.has(value.toLowerCase())) return value === 'wifi' ? 'Wi-Fi' : value.toUpperCase();
  return value.charAt(0).toUpperCase() + value.slice(1);
}

