import { sql } from 'drizzle-orm';
import { db } from './client';

// Brings any database — a brand-new empty one or an older install — up to what
// this code expects, so deploying never depends on running a command first.
//
// 1. Every table is created with CREATE TABLE IF NOT EXISTS. On a fresh Turso
//    database this builds the whole schema; on an existing one it does nothing.
// 2. Columns added after a table first shipped are added if missing.
//
// Every step is additive and safe to repeat, and each server instance runs it
// at most once (the promise is cached). Keep this file in step with schema.ts:
// a new table goes in TABLES, a new column on an existing table in COLUMNS.

const TABLES = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    email TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    account_number TEXT,
    branch_name TEXT,
    holder_name TEXT,
    bank_name TEXT,
    routing_number TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    closed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS incomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    txn_date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    loan_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    txn_date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    loan_id INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_account_id INTEGER NOT NULL REFERENCES accounts(id),
    to_account_id INTEGER NOT NULL REFERENCES accounts(id),
    amount REAL NOT NULL,
    charge REAL NOT NULL DEFAULT 0,
    txn_date TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    amount REAL NOT NULL,
    balance REAL NOT NULL DEFAULT 0,
    txn_date TEXT NOT NULL,
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    account_id INTEGER,
    affects_account_balance INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS credit_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id),
    provider_name TEXT NOT NULL DEFAULT '',
    card_last4 TEXT NOT NULL DEFAULT '',
    credit_limit REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS loan_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS otp_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'login',
    target TEXT,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    context_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    migration_key TEXT PRIMARY KEY,
    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE INDEX IF NOT EXISTS expenses_txn_date ON expenses (txn_date)`,
  `CREATE INDEX IF NOT EXISTS incomes_txn_date ON incomes (txn_date)`,
  `CREATE INDEX IF NOT EXISTS transfers_txn_date ON transfers (txn_date)`,
  `CREATE INDEX IF NOT EXISTS system_logs_event ON system_logs (event_type, created_at)`,
];

// Columns added to a table after it first shipped: [table, column, definition].
const COLUMNS: [string, string, string][] = [
  ['accounts', 'holder_name', 'TEXT'],
  ['accounts', 'bank_name', 'TEXT'],
  ['accounts', 'routing_number', 'TEXT'],
  ['accounts', 'closed_at', 'TEXT'],
  ['users', 'name', 'TEXT'],
  ['users', 'email', 'TEXT'],
  ['otp_tokens', 'purpose', "TEXT NOT NULL DEFAULT 'login'"],
  ['otp_tokens', 'target', 'TEXT'],
];

// A local SQLite file (development) in WAL mode lets pages keep reading while
// a form saves. The setting is stored in the file, so this runs once per
// start. Turso manages this itself.
async function tuneLocalFile() {
  if (!process.env.TURSO_DATABASE_URL?.startsWith('file:')) return;
  await db.run(sql.raw('PRAGMA journal_mode = WAL'));
}

async function createTables() {
  // One batch: a single round trip to Turso instead of one per statement.
  await db.batch(TABLES.map((stmt) => db.run(sql.raw(stmt))) as [ReturnType<typeof db.run>]);
}

async function addMissingColumns() {
  const tables = [...new Set(COLUMNS.map(([t]) => t))];
  const infos = await Promise.all(
    tables.map((t) => db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${t})`))),
  );
  const have = new Map(tables.map((t, i) => [t, new Set(infos[i].map((c) => c.name))]));

  for (const [table, column, definition] of COLUMNS) {
    if (have.get(table)?.has(column)) continue;
    try {
      await db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`));
    } catch (err) {
      // Two cold starts racing: the other one added it first.
      if (!/duplicate column/i.test(String(err))) throw err;
    }
  }
}

let ready: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  ready ??= (async () => {
    await tuneLocalFile();
    await createTables();
    await addMissingColumns();
  })().catch((err) => {
    // Let the next request try again rather than caching the failure.
    ready = null;
    console.error('[hisab] database setup failed:', err);
    throw err;
  });
  return ready;
}
