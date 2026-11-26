import { db } from './db/client';
import { settings } from './db/schema';

// The owner's display preferences. Stored as rows in the `settings` table and
// read once per request by requireAuth(), so every formatter on the page (and
// in the action handling a form) sees the same values.

export type Grouping = 'south-asian' | 'international';

export interface Prefs {
  currencySymbol: string;
  grouping: Grouping;
  timezone: string;
}

export const DEFAULT_PREFS: Prefs = {
  currencySymbol: '৳',
  grouping: 'south-asian',
  timezone: 'Asia/Dhaka',
};

const KEYS: Record<keyof Prefs, string> = {
  currencySymbol: 'currency_symbol',
  grouping: 'number_grouping',
  timezone: 'timezone',
};

// One owner per install, so a single module-level value is shared by every
// request on this server instance. It is refreshed from the database on each
// signed-in request, so a change made on another instance shows up on the
// next page load here.
let current: Prefs = DEFAULT_PREFS;

export function prefs(): Prefs {
  return current;
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// The symbol is printed into CSS `content:` and into emails, so it is kept to
// a few plain characters: no quotes, backslashes, angle brackets or braces.
export function isValidCurrencySymbol(sym: string): boolean {
  return sym.length >= 1 && sym.length <= 4 && !/["'\\<>{}\s;]/.test(sym);
}

function fromRows(rows: { key: string; value: string }[]): Prefs {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const sym = map.get(KEYS.currencySymbol);
  const grouping = map.get(KEYS.grouping);
  const tz = map.get(KEYS.timezone);
  return {
    currencySymbol: sym && isValidCurrencySymbol(sym) ? sym : DEFAULT_PREFS.currencySymbol,
    grouping: grouping === 'international' ? 'international' : DEFAULT_PREFS.grouping,
    timezone: tz && isValidTimezone(tz) ? tz : DEFAULT_PREFS.timezone,
  };
}

export async function loadPrefs(): Promise<Prefs> {
  const rows = await db.select().from(settings);
  current = fromRows(rows);
  return current;
}

export async function savePrefs(next: Prefs): Promise<void> {
  const rows = (Object.keys(KEYS) as (keyof Prefs)[]).map((k) => ({ key: KEYS[k], value: String(next[k]) }));
  for (const row of rows) {
    await db.insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value } });
  }
  current = next;
}
