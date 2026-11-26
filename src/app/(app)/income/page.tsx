import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot, openAccountsFor } from '@/lib/db/queries';
import { accountOptions } from '@/lib/accountOptions';
import { Picker } from '@/components/Picker';
import { AmountField, ChoiceChips, DateField } from '@/components/EntryFields';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { Amount, EntrySheet, MonthStepper, PageHeader } from '@/components/Ledger';
import { db } from '@/lib/db/client';
import { incomes, accounts } from '@/lib/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { INCOME_SOURCES, currentMonth, todayDate, isValidMonth, groupByDate, relativeDay, titleCase, monthLabel } from '@/lib/money';
import { addIncome, updateIncome, deleteIncome } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Income' };

type SP = { month?: string; source?: string; edit?: string; add?: string; error?: string };

export default async function IncomePage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAuth();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  const source = sp.source && INCOME_SOURCES.includes(sp.source as never) ? sp.source : 'all';
  const editId = sp.edit ? parseInt(sp.edit, 10) || 0 : 0;
  const today = todayDate();

  const inMonth = and(sql`strftime('%Y-%m', ${incomes.txnDate}) = ${month}`, isNull(incomes.loanId));
  const filtered = source !== 'all' ? and(inMonth, eq(incomes.source, source as never)) : inMonth;

  const [{ all, cards }, rows, bySource, editRow] = await Promise.all([
    ledgerSnapshot(),
    db
      .select({ income: incomes, accountName: accounts.name })
      .from(incomes)
      .innerJoin(accounts, eq(accounts.id, incomes.accountId))
      .where(filtered)
      .orderBy(desc(incomes.txnDate), desc(incomes.id)),
    db
      .select({ source: incomes.source, total: sql<number>`COALESCE(SUM(${incomes.amount}),0)` })
      .from(incomes)
      .where(inMonth)
      .groupBy(incomes.source)
      .orderBy(sql`SUM(${incomes.amount}) DESC`),
    editId ? db.select().from(incomes).where(and(eq(incomes.id, editId), isNull(incomes.loanId))).limit(1) : Promise.resolve([]),
  ]);

  const monthTotal = bySource.reduce((s, r) => s + Number(r.total), 0);
  const shownTotal = rows.reduce((s, r) => s + r.income.amount, 0);
  const editIncome = editRow[0] ?? null;
  const accs = openAccountsFor(all, editIncome?.accountId);
  const days = groupByDate(rows, (r) => r.income.txnDate);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ month, ...(source !== 'all' ? { source } : {}), ...extra }).toString();

  return (
    <div className="space-y-5">
      <PageHeader title="Income">
        <MonthStepper month={month} basePath="/income" params={source !== 'all' ? { source } : {}} />
      </PageHeader>

      <FormError message={sp.error} />

      <EntrySheet title={editIncome ? 'Edit income' : 'New income'} open={!!editIncome || !!sp.add || !!sp.error}>
        <form key={editIncome?.id ?? 'new'} action={editIncome ? updateIncome : addIncome} className="entry-form" data-online-only>
          {editIncome && <input type="hidden" name="id" value={editIncome.id} />}
          <AmountField defaultValue={editIncome?.amount} autoFocus={!!sp.add} />
          <ChoiceChips
            name="source"
            label="Source"
            columns={4}
            defaultValue={editIncome?.source ?? 'salary'}
            options={INCOME_SOURCES.map((s) => ({ value: s, label: titleCase(s) }))}
          />
          <div className="field">
            <span id="inc-into">Received into</span>
            <Picker
              aria-labelledby="inc-into"
              name="account_id"
              defaultValue={editIncome ? String(editIncome.accountId) : ''}
              placeholder="Choose an account"
              options={accountOptions(accs, cards, { cardsFirst: false })}
              required
            />
          </div>
          <DateField defaultValue={editIncome?.txnDate ?? today} today={today} />
          <label className="field span-all">
            <span>Note</span>
            <input name="note" className="input" defaultValue={editIncome?.note ?? ''} placeholder="Who paid, what for (optional)" maxLength={200} />
          </label>
          <div className="span-all form-actions">
            <SubmitButton>{editIncome ? 'Save changes' : 'Save income'}</SubmitButton>
            {editIncome && <Link href={`/income?${qs({})}`} className="btn-quiet">Cancel</Link>}
          </div>
        </form>
      </EntrySheet>

      <section className="leaf px-4 py-4" aria-label="Total">
        <p className="figure-label">{source === 'all' ? `Earned in ${monthLabel(month)}` : `${titleCase(source)}, ${monthLabel(month)}`}</p>
        <p className="figure-md mt-1"><Amount value={source === 'all' ? monthTotal : shownTotal} tone="credit" /></p>
      </section>

      {bySource.length > 1 && (
        <nav aria-label="Filter by source" className="chips -mx-4 px-4 md:mx-0 md:px-0">
          <Link href={`/income?month=${month}`} className="chip" aria-current={source === 'all' ? 'true' : undefined}>All</Link>
          {bySource.map((s) => (
            <Link key={s.source} href={`/income?month=${month}&source=${s.source}`} className="chip" aria-current={source === s.source ? 'true' : undefined}>
              {titleCase(s.source)}
            </Link>
          ))}
        </nav>
      )}

      <section className="leaf overflow-hidden" aria-label="Entries">
        {rows.length === 0 ? (
          <div className="empty">
            <p>No income recorded in {monthLabel(month)}.</p>
            {month === currentMonth() && <Link href="/income?add=1" className="btn-primary">Add income</Link>}
          </div>
        ) : (
          days.map(([day, items]) => (
            <div key={day}>
              <h2 className="ledger-day">
                <span>{relativeDay(day)}</span>
                <Amount value={items.reduce((s, r) => s + r.income.amount, 0)} />
              </h2>
              <ul className="ledger border-t border-rule">
                {items.map(({ income: inc, accountName }) => (
                  <li key={inc.id}>
                    <details className="row-more">
                      <summary className="row">
                        <div className="row-main">
                          <p className="row-title">{titleCase(inc.source)}</p>
                          <p className="row-sub">{inc.note ? `${inc.note} — ${accountName}` : accountName}</p>
                        </div>
                        <Amount value={inc.amount} tone="credit" className="row-amount" />
                      </summary>
                      <div className="row-actions">
                        <a href={`/income?${qs({ edit: String(inc.id) })}#entry`} className="btn-secondary btn-sm">Edit</a>
                        <form action={deleteIncome} data-online-only>
                          <input type="hidden" name="id" value={inc.id} />
                          <ConfirmButton type="submit" className="btn-danger btn-sm" message="Delete this income entry? Its amount comes off the account.">Delete</ConfirmButton>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
