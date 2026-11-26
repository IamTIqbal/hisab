import { sql, and, isNull, desc } from 'drizzle-orm';
import { db } from './client';
import { accounts, incomes, expenses, transfers, creditCards } from './schema';

export interface AccountWithBalance {
  id: number;
  name: string;
  type: string;
  accountNumber: string | null;
  branchName: string | null;
  holderName: string | null;
  bankName: string | null;
  routingNumber: string | null;
  openingBalance: number;
  currentBalance: number;
  closedAt: string | null;
}

export interface CreditCardProfile {
  id: number;
  accountId: number;
  accountName: string;
  accountNumber: string | null;
  branchName: string | null;
  providerName: string;
  cardLast4: string;
  creditLimit: number;
  currentBalance: number;
  usedLimit: number;
  availableLimit: number;
  utilizationPercent: number;
}

// Every account, closed ones included. Most pages want ledgerSnapshot(),
// which splits closed accounts out.
// Five independent aggregates — run together. Against a remote Turso database
// each round trip is tens of milliseconds, and running them one after another
// was the bulk of every page's load time.
export async function accountBalances(): Promise<AccountWithBalance[]> {
  const [allAccounts, incomeRows, expenseRows, transferOutRows, transferInRows] = await Promise.all([
    db.select().from(accounts),
    db
      .select({ accountId: incomes.accountId, total: sql<number>`COALESCE(SUM(${incomes.amount}),0)` })
      .from(incomes)
      .groupBy(incomes.accountId),
    db
      .select({ accountId: expenses.accountId, total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` })
      .from(expenses)
      .groupBy(expenses.accountId),
    db
      .select({
        accountId: transfers.fromAccountId,
        total: sql<number>`COALESCE(SUM(${transfers.amount} + COALESCE(${transfers.charge},0)),0)`,
      })
      .from(transfers)
      .groupBy(transfers.fromAccountId),
    db
      .select({ accountId: transfers.toAccountId, total: sql<number>`COALESCE(SUM(${transfers.amount}),0)` })
      .from(transfers)
      .groupBy(transfers.toAccountId),
  ]);

  const incomeByAccount = Object.fromEntries(incomeRows.map((r) => [r.accountId, Number(r.total)]));
  const expenseByAccount = Object.fromEntries(expenseRows.map((r) => [r.accountId, Number(r.total)]));
  const transferOutByAccount = Object.fromEntries(transferOutRows.map((r) => [r.accountId, Number(r.total)]));
  const transferInByAccount = Object.fromEntries(transferInRows.map((r) => [r.accountId, Number(r.total)]));

  const result: AccountWithBalance[] = allAccounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    accountNumber: acc.accountNumber,
    branchName: acc.branchName,
    holderName: acc.holderName,
    bankName: acc.bankName,
    routingNumber: acc.routingNumber,
    openingBalance: acc.openingBalance,
    closedAt: acc.closedAt,
    currentBalance:
      acc.openingBalance +
      (incomeByAccount[acc.id] ?? 0) -
      (expenseByAccount[acc.id] ?? 0) -
      (transferOutByAccount[acc.id] ?? 0) +
      (transferInByAccount[acc.id] ?? 0),
  }));

  return sortAccountsForDisplay(result);
}

// `alwaysIncludeId` keeps the account a record is already filed under in the
// list, even once its balance drops under the threshold or it is closed —
// otherwise editing that record silently loses its account. Pass every
// account (open and closed) as `accs`.
export function accountsForDropdown(
  accs: AccountWithBalance[],
  creditCardAccountIds: Set<number>,
  alwaysIncludeId?: number,
): AccountWithBalance[] {
  return accs.filter(
    (a) => a.id === alwaysIncludeId || (!a.closedAt && (creditCardAccountIds.has(a.id) || a.currentBalance >= 50)),
  );
}

// Open accounts, plus the one a record being edited is already filed under.
export function openAccountsFor(accs: AccountWithBalance[], alwaysIncludeId?: number): AccountWithBalance[] {
  return accs.filter((a) => !a.closedAt || a.id === alwaysIncludeId);
}

export async function creditCardAccountIds(): Promise<Set<number>> {
  const rows = await db.select({ accountId: creditCards.accountId }).from(creditCards);
  return new Set(rows.map((r) => r.accountId));
}

const TYPE_RANK: Record<string, number> = { bank: 0, cash: 1, credit: 2 };

export function sortAccountsForDisplay(accs: AccountWithBalance[]): AccountWithBalance[] {
  return [...accs].sort((a, b) => {
    const rankA = TYPE_RANK[a.type] ?? 3;
    const rankB = TYPE_RANK[b.type] ?? 3;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Credit cards hold a negative balance (money owed), so folding them into
// "total balance" would understate your cash. Identify them from the
// credit_cards table — matching on hardcoded account names silently broke as
// soon as a card was renamed or a third one added.
export function totalBalance(accs: AccountWithBalance[], cardAccountIds: Set<number>): number {
  return accs
    .filter((a) => !cardAccountIds.has(a.id))
    .reduce((sum, a) => sum + a.currentBalance, 0);
}

export async function creditCardProfiles(accs?: AccountWithBalance[]): Promise<CreditCardProfile[]> {
  const cards = await db.select().from(creditCards).orderBy(desc(creditCards.id));
  if (!cards.length) return [];

  const balances = accs ?? (await accountBalances());
  const byAccountId = Object.fromEntries(balances.map((a) => [a.id, a]));

  return cards
    .filter((card) => byAccountId[card.accountId])
    .map((card) => {
      const account = byAccountId[card.accountId];
      const currentBalance = account.currentBalance;
      const limit = Math.max(0, card.creditLimit);
      const used = Math.max(0, -currentBalance);
      // Overpaying a card leaves a positive balance, which spends on top of
      // the limit — `limit - used` would have thrown that credit away.
      const available = Math.max(0, limit + currentBalance);
      return {
        id: card.id,
        accountId: card.accountId,
        accountName: account.name,
        accountNumber: account.accountNumber,
        branchName: account.branchName,
        providerName: card.providerName,
        cardLast4: card.cardLast4,
        creditLimit: limit,
        currentBalance,
        usedLimit: used,
        availableLimit: available,
        utilizationPercent: limit > 0 ? Math.min(100, (used / limit) * 100) : 0,
      };
    });
}

// Balances and card profiles together. Calling creditCardProfiles() without
// balances recomputes every account balance a second time.
//
// `accs` and `cards` hold open accounts only, so a closed account vanishes
// from every page, total and dropdown built from them. `closed` lists the
// closed ones for the Accounts page; `all` is both, for edit forms that must
// still show the account an old record is filed under.
export async function ledgerSnapshot(): Promise<{
  accs: AccountWithBalance[];
  cards: CreditCardProfile[];
  closed: AccountWithBalance[];
  all: AccountWithBalance[];
}> {
  const all = await accountBalances();
  const accs = all.filter((a) => !a.closedAt);
  const closed = all.filter((a) => a.closedAt);
  const cards = await creditCardProfiles(accs);
  return { accs, cards, closed, all };
}

export async function monthlyIncome(month: string): Promise<number> {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const row = await db
    .select({ total: sql<number>`COALESCE(SUM(${incomes.amount}),0)` })
    .from(incomes)
    .where(and(sql`${incomes.txnDate} BETWEEN ${start} AND ${end}`, isNull(incomes.loanId)));
  return Number(row[0]?.total ?? 0);
}

export async function monthlyExpense(month: string): Promise<number> {
  const start = `${month}-01`;
  const end = `${month}-31`;
  const row = await db
    .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` })
    .from(expenses)
    .where(and(sql`${expenses.txnDate} BETWEEN ${start} AND ${end}`, isNull(expenses.loanId)));
  return Number(row[0]?.total ?? 0);
}

