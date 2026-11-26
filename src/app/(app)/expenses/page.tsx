import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot, accountsForDropdown } from '@/lib/db/queries';
import { accountOptions } from '@/lib/accountOptions';
import { Picker } from '@/components/Picker';
import { AmountField, ChoiceChips, DateField } from '@/components/EntryFields';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { Amount, EntrySheet, MonthStepper, PageHeader } from '@/components/Ledger';
import { db } from '@/lib/db/client';
import { expenses, accounts } from '@/lib/db/schema';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';
import { EXPENSE_CATEGORIES, currentMonth, todayDate, isValidMonth, groupByDate, relativeDay, titleCase, monthLabel } from '@/lib/money';
import { addExpense, updateExpense, deleteExpense } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Expenses' };

type SP = { month?: string; category?: string; edit?: string; add?: string; error?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAuth();
  const sp = await searchParams;
  const month = isValidMonth(sp.month) ? sp.month : currentMonth();
  // Any stored category is filterable — older entries may use names that are
  // no longer in EXPENSE_CATEGORIES.
  const category = sp.category && /^[\w &-]{1,40}$/.test(sp.category) ? sp.category : 'all';
  const editId = sp.edit ? parseInt(sp.edit, 10) || 0 : 0;
  const today = todayDate();

  const inMonth = and(sql`strftime('%Y-%m', ${expenses.txnDate}) = ${month}`, isNull(expenses.loanId));
  const filtered = category !== 'all' ? and(inMonth, eq(expenses.category, category)) : inMonth;

  const [{ all, cards }, rows, byCategory, todayRow, editRow] = await Promise.all([
    ledgerSnapshot(),
    db
      .select({ expense: expenses, accountName: accounts.name })
      .from(expenses)
      .innerJoin(accounts, eq(accounts.id, expenses.accountId))
      .where(filtered)
      .orderBy(desc(expenses.txnDate), desc(expenses.id)),
    db
      .select({ category: expenses.category, total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` })
      .from(expenses)
      .where(inMonth)
      .groupBy(expenses.category)
      .orderBy(sql`SUM(${expenses.amount}) DESC`),
    db
      .select({ total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` })
      .from(expenses)
      .where(and(eq(expenses.txnDate, today), isNull(expenses.loanId))),
    // Looked up by id, not from the filtered list — an entry in another month
    // stays editable from a stale link.
    editId ? db.select().from(expenses).where(and(eq(expenses.id, editId), isNull(expenses.loanId))).limit(1) : Promise.resolve([]),
  ]);

  const monthTotal = byCategory.reduce((s, r) => s + Number(r.total), 0);
  const shownTotal = rows.reduce((s, r) => s + r.expense.amount, 0);
  const todayTotal = Number(todayRow[0]?.total ?? 0);
  const editExpense = editRow[0] ?? null;
  const cardIds = new Set(cards.map((c) => c.accountId));
  const dropdownAccs = accountsForDropdown(all, cardIds, editExpense?.accountId);
  // An entry filed under a category that has since been merged keeps it on
  // offer while it is being edited, so saving it unchanged is possible.
  const categoryChoices: string[] = [...EXPENSE_CATEGORIES];
  if (editExpense && !categoryChoices.includes(editExpense.category)) categoryChoices.push(editExpense.category);
  const days = groupByDate(rows, (r) => r.expense.txnDate);
  const qs = (extra: Record<string, string>) => new URLSearchParams({ month, ...(category !== 'all' ? { category } : {}), ...extra }).toString();

  return (
    <div className="space-y-5">
      <PageHeader title="Expenses">
        <MonthStepper month={month} basePath="/expenses" params={category !== 'all' ? { category } : {}} />
      </PageHeader>

      <FormError message={sp.error} />

      <EntrySheet title={editExpense ? 'Edit expense' : 'New expense'} open={!!editExpense || !!sp.add || !!sp.error}>
        <form key={editExpense?.id ?? 'new'} action={editExpense ? updateExpense : addExpense} className="entry-form" data-online-only>
          {editExpense && <input type="hidden" name="id" value={editExpense.id} />}
          <AmountField defaultValue={editExpense?.amount} autoFocus={!!sp.add} />
          <ChoiceChips
            name="category"
            label="What for"
            defaultValue={editExpense?.category ?? 'food'}
            options={categoryChoices.map((c) => ({ value: c, label: titleCase(c) }))}
          />
          <div className="field">
            <span id="exp-from">Paid from</span>
            <Picker
              aria-labelledby="exp-from"
              name="account_id"
              defaultValue={editExpense ? String(editExpense.accountId) : ''}
              placeholder="Choose an account"
              options={accountOptions(dropdownAccs, cards)}
              required
            />
          </div>
          <DateField defaultValue={editExpense?.txnDate ?? today} today={today} />
          <label className="field span-all">
            <span>Note</span>
            <input name="note" className="input" defaultValue={editExpense?.note ?? ''} placeholder="Optional, e.g. lunch with team" maxLength={200} enterKeyHint="done" />
          </label>
          <div className="span-all form-actions">
            <SubmitButton>{editExpense ? 'Save changes' : 'Save expense'}</SubmitButton>
            {editExpense && <Link href={`/expenses?${qs({})}`} className="btn-quiet">Cancel</Link>}
          </div>
        </form>
      </EntrySheet>

      <section className="leaf" aria-label="Totals">
        <div className="grid grid-cols-2">
          <div className="px-4 py-4">
            <p className="figure-label">{category === 'all' ? `Spent in ${monthLabel(month)}` : `${titleCase(category)}, ${monthLabel(month)}`}</p>
            <p className="figure-md mt-1"><Amount value={category === 'all' ? monthTotal : shownTotal} tone="debit" /></p>
          </div>
          <div className="border-l border-rule px-4 py-4">
            <p className="figure-label">Spent today</p>
            <p className="figure-md mt-1"><Amount value={todayTotal} /></p>
          </div>
        </div>
      </section>

      {byCategory.length > 0 && (
        <nav aria-label="Filter by category" className="chips -mx-4 px-4 md:mx-0 md:px-0">
          <Link href={`/expenses?month=${month}`} className="chip" aria-current={category === 'all' ? 'true' : undefined}>All</Link>
          {byCategory.map((c) => (
            <Link key={c.category} href={`/expenses?month=${month}&category=${encodeURIComponent(c.category)}`} className="chip" aria-current={category === c.category ? 'true' : undefined}>
              {titleCase(c.category)}
            </Link>
          ))}
        </nav>
      )}

      <section className="leaf overflow-hidden" aria-label="Entries">
        {rows.length === 0 ? (
          <div className="empty">
            <p>Nothing spent{category !== 'all' ? ` on ${category}` : ''} in {monthLabel(month)}.</p>
            {month === currentMonth() && <Link href="/expenses?add=1" className="btn-primary">Add an expense</Link>}
          </div>
        ) : (
          days.map(([day, items]) => (
            <div key={day}>
              <h2 className="ledger-day">
                <span>{relativeDay(day)}</span>
                <Amount value={items.reduce((s, r) => s + r.expense.amount, 0)} />
              </h2>
              <ul className="ledger border-t border-rule">
                {items.map(({ expense: exp, accountName }) => (
                  <li key={exp.id}>
                    <details className="row-more">
                      <summary className="row">
                        <div className="row-main">
                          <p className="row-title">{titleCase(exp.category)}</p>
                          <p className="row-sub">{exp.note ? `${exp.note} — ${accountName}` : accountName}</p>
                        </div>
                        <Amount value={exp.amount} tone="debit" className="row-amount" />
                      </summary>
                      <div className="row-actions">
                        <a href={`/expenses?${qs({ edit: String(exp.id) })}#entry`} className="btn-secondary btn-sm">Edit</a>
                        <form action={deleteExpense} data-online-only>
                          <input type="hidden" name="id" value={exp.id} />
                          <ConfirmButton type="submit" className="btn-danger btn-sm" message="Delete this expense? Its amount goes back to the account.">Delete</ConfirmButton>
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
