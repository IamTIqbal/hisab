import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // The owner signs in with their email (or this username, for installs that
  // predate email sign-in). Setup stores the email here too.
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  email: text('email'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'cash', 'credit'] }).notNull(),
  accountNumber: text('account_number'),
  branchName: text('branch_name'),
  // Bank details for sharing an account with someone paying in. All optional.
  holderName: text('holder_name'),
  bankName: text('bank_name'),
  routingNumber: text('routing_number'),
  openingBalance: real('opening_balance').notNull().default(0),
  // Set when the account is closed: it disappears from every list, dropdown
  // and total, but its history stays. Only a zero-balance account can close.
  closedAt: text('closed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const incomes = sqliteTable('incomes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source', { enum: ['salary', 'business', 'cash', 'other'] }).notNull(),
  amount: real('amount').notNull(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  txnDate: text('txn_date').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  loanId: integer('loan_id'),
});

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  category: text('category').notNull(),
  amount: real('amount').notNull(),
  accountId: integer('account_id').notNull().references(() => accounts.id),
  txnDate: text('txn_date').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  loanId: integer('loan_id'),
});

export const transfers = sqliteTable('transfers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  fromAccountId: integer('from_account_id').notNull().references(() => accounts.id),
  toAccountId: integer('to_account_id').notNull().references(() => accounts.id),
  amount: real('amount').notNull(),
  charge: real('charge').notNull().default(0),
  txnDate: text('txn_date').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const loans = sqliteTable('loans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['taken', 'given'] }).notNull(),
  provider: text('provider').notNull(),
  amount: real('amount').notNull(),
  balance: real('balance').notNull().default(0),
  txnDate: text('txn_date').notNull(),
  dueDate: text('due_date'),
  status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  accountId: integer('account_id'),
  affectsAccountBalance: integer('affects_account_balance').notNull().default(1),
});

export const creditCards = sqliteTable('credit_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  accountId: integer('account_id').notNull().unique().references(() => accounts.id),
  providerName: text('provider_name').notNull().default(''),
  cardLast4: text('card_last4').notNull().default(''),
  creditLimit: real('credit_limit').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const loanProviders = sqliteTable('loan_providers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const otpTokens = sqliteTable('otp_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull(),
  // 'login' codes sign the owner in; 'email' codes confirm a new address,
  // which is carried in `target` until the code is entered.
  purpose: text('purpose', { enum: ['login', 'email'] }).notNull().default('login'),
  target: text('target'),
  expiresAt: text('expires_at').notNull(),
  used: integer('used').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

export const systemLogs = sqliteTable('system_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  eventType: text('event_type').notNull(),
  contextJson: text('context_json'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// Owner preferences as key/value rows (currency symbol, number grouping,
// time zone). Missing keys fall back to the defaults in src/lib/prefs.ts.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const schemaMigrations = sqliteTable('schema_migrations', {
  migrationKey: text('migration_key').primaryKey(),
  executedAt: text('executed_at').notNull().default(sql`(datetime('now'))`),
});

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Income = typeof incomes.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Loan = typeof loans.$inferSelect;
export type CreditCard = typeof creditCards.$inferSelect;
export type LoanProvider = typeof loanProviders.$inferSelect;
