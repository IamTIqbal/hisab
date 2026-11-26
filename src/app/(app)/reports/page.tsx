import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { incomes, expenses } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { currentMonth, currentYear, MONTH_NAMES, isValidMonth, monthLabel, titleCase } from '@/lib/money';
import { Amount, MonthStepper, PageHeader } from '@/components/Ledger';
import { IconChevron } from '@/components/Icons';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reports' };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  await requireAuth();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const year = sp.year && /^\d{4}$/.test(sp.year) ? sp.year : month.slice(0, 4);
  const thisYear = currentYear();

  const [incomeRow, expenseRow, categoryRows, yearlyExpense, yearlyIncome] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${incomes.amount}),0)` })
      .from(incomes)
      .where(sql`strftime('%Y-%m', ${incomes.txnDate}) = ${month} AND ${incomes.loanId} IS NULL`),
    db.select({ total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` })
      .from(expenses)
      .where(sql`strftime('%Y-%m', ${expenses.txnDate}) = ${month} AND ${expenses.loanId} IS NULL`),
    db.select({ category: expenses.category, total: sql<number>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(sql`strftime('%Y-%m', ${expenses.txnDate}) = ${month} AND ${expenses.loanId} IS NULL`)
      .groupBy(expenses.category)
      .orderBy(sql`SUM(${expenses.amount}) DESC`),
    db.select({ m: sql<string>`strftime('%m', ${expenses.txnDate})`, total: sql<number>`SUM(${expenses.amount})` })
      .from(expenses)
      .where(sql`strftime('%Y', ${expenses.txnDate}) = ${year} AND ${expenses.loanId} IS NULL`)
      .groupBy(sql`strftime('%m', ${expenses.txnDate})`),
    db.select({ m: sql<string>`strftime('%m', ${incomes.txnDate})`, total: sql<number>`SUM(${incomes.amount})` })
      .from(incomes)
      .where(sql`strftime('%Y', ${incomes.txnDate}) = ${year} AND ${incomes.loanId} IS NULL`)
      .groupBy(sql`strftime('%m', ${incomes.txnDate})`),
  ]);

  const incomeTotal = Number(incomeRow[0]?.total ?? 0);
  const expenseTotal = Number(expenseRow[0]?.total ?? 0);
  const savings = incomeTotal - expenseTotal;
  const categoryTotal = categoryRows.reduce((s, r) => s + Number(r.total), 0);

  const spentBy: Record<string, number> = Object.fromEntries(yearlyExpense.map((r) => [r.m, Number(r.total)]));
  const earnedBy: Record<string, number> = Object.fromEntries(yearlyIncome.map((r) => [r.m, Number(r.total)]));
  const maxVal = Math.max(1, ...Object.values(spentBy), ...Object.values(earnedBy));
  const yearSpent = Object.values(spentBy).reduce((s, v) => s + v, 0);
  const yearEarned = Object.values(earnedBy).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Reports">
        <MonthStepper month={month} basePath="/reports" />
      </PageHeader>

      <section className="leaf overflow-hidden" aria-label={`Summary for ${monthLabel(month)}`}>
        <div className="tally">
          <div className="!border-t-0">
            <p className="figure-label">Earned</p>
            <p className="figure-md mt-1"><Amount value={incomeTotal} tone="credit" /></p>
          </div>
          <div className="!border-t-0">
            <p className="figure-label">Spent</p>
            <p className="figure-md mt-1"><Amount value={expenseTotal} tone="debit" /></p>
          </div>
          <div className="!border-t-0">
            <p className="figure-label">{savings >= 0 ? 'Saved' : 'Overspent'}</p>
            <p className="figure-md mt-1"><Amount value={savings} tone={savings >= 0 ? 'credit' : 'debit'} /></p>
            {incomeTotal > 0 && savings > 0 && (
              <p className="text-sm text-muted">{((savings / incomeTotal) * 100).toFixed(0)}% of what came in</p>
            )}
          </div>
        </div>
      </section>

      <section className="leaf overflow-hidden" aria-labelledby="where-h">
        <div className="leaf-head">
          <h2 id="where-h">Where it went</h2>
          <Link href={`/expenses?month=${month}`}>See entries</Link>
        </div>
        {categoryRows.length === 0 ? (
          <div className="empty"><p>No spending recorded in {monthLabel(month)}.</p></div>
        ) : (
          <ul className="ledger">
            {categoryRows.map((row) => {
              const total = Number(row.total);
              const pct = categoryTotal > 0 ? (total / categoryTotal) * 100 : 0;
              return (
                <li key={row.category}>
                  <Link href={`/expenses?month=${month}&category=${encodeURIComponent(row.category)}`} className="row block text-ink no-underline hover:bg-[#F6F8FB]">
                    <div className="flex w-full items-baseline gap-3">
                      <span className="row-title">{titleCase(row.category)}</span>
                      <span className="text-sm text-muted">{pct.toFixed(0)}%</span>
                      <span className="leader" aria-hidden />
                      <Amount value={total} className="font-semibold" />
                    </div>
                    <div className="bar mt-2"><span style={{ width: `${pct}%` }} /></div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="leaf overflow-hidden" aria-labelledby="year-h">
        <div className="leaf-head">
          <h2 id="year-h">The year {year}</h2>
          <div className="month-step">
            <Link href={`/reports?month=${month}&year=${Number(year) - 1}`} aria-label={`Year ${Number(year) - 1}`}>
              <IconChevron dir="left" className="h-5 w-5" />
            </Link>
            <Link
              href={`/reports?month=${month}&year=${Number(year) + 1}`}
              aria-label={`Year ${Number(year) + 1}`}
              aria-disabled={year >= thisYear || undefined}
              tabIndex={year >= thisYear ? -1 : undefined}
            >
              <IconChevron className="h-5 w-5" />
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-4 pt-3 text-sm text-muted">
          <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-credit" aria-hidden /> Earned <Amount value={yearEarned} className="text-ink" /></span>
          <span className="inline-flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-debit" aria-hidden /> Spent <Amount value={yearSpent} className="text-ink" /></span>
        </div>
        <ul className="ledger mt-2">
          {/* Newest month first, and only months that have happened: a column
              of future "Nothing recorded" rows told you nothing. */}
          {MONTH_NAMES.map((name, i) => ({ name, key: String(i + 1).padStart(2, '0') }))
            .filter(({ key }) => `${year}-${key}` <= currentMonth())
            .reverse()
            .map(({ name, key }) => {
            const spent = spentBy[key] ?? 0;
            const earned = earnedBy[key] ?? 0;
            const ym = `${year}-${key}`;
            const empty = !spent && !earned;
            return (
              <li key={key}>
                <Link
                  href={`/reports?month=${ym}&year=${year}`}
                  aria-current={ym === month ? 'true' : undefined}
                  className={`row block no-underline text-ink hover:bg-[#F6F8FB] aria-[current=true]:bg-[#EEF3FA] ${empty ? 'row-compact' : ''}`}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={`row-title ${empty ? 'font-medium text-muted' : ''}`}>{name}</span>
                    <span className="text-sm">
                      {empty ? (
                        <span className="text-muted">Nothing recorded</span>
                      ) : (
                        <><Amount value={earned} tone="credit" /> <span className="text-muted">in,</span> <Amount value={spent} tone="debit" /> <span className="text-muted">out</span></>
                      )}
                    </span>
                  </div>
                  {!empty && (
                    <div className="mt-1.5 grid gap-1">
                      <div className="bar bar-credit h-[5px]"><span style={{ width: `${(earned / maxVal) * 100}%` }} /></div>
                      <div className="bar h-[5px]"><span style={{ width: `${(spent / maxVal) * 100}%` }} /></div>
                    </div>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
