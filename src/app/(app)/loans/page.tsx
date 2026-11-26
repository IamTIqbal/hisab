import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot, openAccountsFor } from '@/lib/db/queries';
import { accountOptions } from '@/lib/accountOptions';
import { Picker } from '@/components/Picker';
import { AmountField, ChoiceChips, DateField } from '@/components/EntryFields';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { Amount, EntrySheet, PageHeader } from '@/components/Ledger';
import { db } from '@/lib/db/client';
import { loans, loanProviders } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { todayDate, formatDay, currencySymbol } from '@/lib/money';
import { addLoan, updateLoan, closeLoan, deleteLoan, addLoanProvider, deleteLoanProvider, recordPayment } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Loans' };

type SP = { edit?: string; pay?: string; add?: string; error?: string };

export default async function LoansPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAuth();
  const sp = await searchParams;
  const editId = sp.edit ? parseInt(sp.edit, 10) || 0 : 0;
  const payId = sp.pay ? parseInt(sp.pay, 10) || 0 : 0;
  const today = todayDate();

  const [{ accs, all, cards }, activeLoans, closedLoans, providers] = await Promise.all([
    ledgerSnapshot(),
    db.select().from(loans).where(eq(loans.status, 'active')).orderBy(desc(loans.txnDate), desc(loans.id)),
    db.select().from(loans).where(eq(loans.status, 'closed')).orderBy(desc(loans.txnDate), desc(loans.id)).limit(10),
    db.select().from(loanProviders).orderBy(loanProviders.name),
  ]);

  const editLoan = editId ? activeLoans.find((l) => l.id === editId) ?? closedLoans.find((l) => l.id === editId) ?? null : null;
  const loanFormAccs = openAccountsFor(all, editLoan?.accountId ?? undefined);

  const totalTaken = activeLoans.filter((l) => l.type === 'taken').reduce((s, l) => s + l.balance, 0);
  const totalGiven = activeLoans.filter((l) => l.type === 'given').reduce((s, l) => s + l.balance, 0);
  const cardDue = cards.reduce((s, c) => s + c.usedLimit, 0);
  const loanNet = totalGiven - (totalTaken + cardDue);

  // One ledger block per person or lender, matched case-insensitively.
  const groupMap = new Map<string, typeof activeLoans>();
  for (const loan of activeLoans) {
    const key = loan.provider.toLowerCase().trim();
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(loan);
  }
  const loanGroups = Array.from(groupMap.values());

  return (
    <div className="space-y-5">
      <PageHeader title="Loans" />

      <FormError message={sp.error} />

      <section className="leaf overflow-hidden" aria-label="Loan totals">
        <div className="grid grid-cols-2 md:grid-cols-4">
          <div className="px-4 py-4">
            <p className="figure-label">I owe</p>
            <p className="figure-md mt-1"><Amount value={totalTaken} tone="debit" /></p>
          </div>
          <div className="border-l border-rule px-4 py-4">
            <p className="figure-label">Owed to me</p>
            <p className="figure-md mt-1"><Amount value={totalGiven} tone="credit" /></p>
          </div>
          <div className="border-t border-rule px-4 py-4 md:border-l md:border-t-0">
            <p className="figure-label">Card dues</p>
            <p className="figure-md mt-1"><Amount value={cardDue} tone="debit" /></p>
          </div>
          <div className="border-l border-t border-rule px-4 py-4 md:border-t-0">
            <p className="figure-label">Net position</p>
            <p className="figure-md mt-1"><Amount value={loanNet} tone={loanNet >= 0 ? 'credit' : 'debit'} /></p>
          </div>
        </div>
        <p className="border-t border-rule px-4 py-2.5 text-sm text-muted">No interest is calculated on any loan.</p>
      </section>

      <EntrySheet title={editLoan ? `Edit loan with ${editLoan.provider}` : 'New loan'} open={!!editLoan || !!sp.add}>
        <form key={editLoan?.id ?? 'new'} action={editLoan ? updateLoan : addLoan} className="entry-form" data-online-only>
          {editLoan && <input type="hidden" name="id" value={editLoan.id} />}
          <ChoiceChips
            name="type"
            label="Direction"
            columns={2}
            defaultValue={editLoan?.type ?? 'taken'}
            options={[{ value: 'taken', label: 'I borrowed' }, { value: 'given', label: 'I lent' }]}
          />
          <AmountField defaultValue={editLoan?.amount} />
          <label className="field">
            <span>Person or lender</span>
            <input name="provider" className="input" list="provider-list" defaultValue={editLoan?.provider ?? ''} placeholder="Name or institution" required maxLength={80} />
            <datalist id="provider-list">
              {providers.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </label>
          {editLoan && (
            <label className="field">
              <span>Still outstanding ({currencySymbol()})</span>
              <input name="balance" type="number" inputMode="decimal" step="0.01" min="0" className="input" defaultValue={editLoan.balance} required />
            </label>
          )}
          <div className="field">
            <span id="loan-acc">Account</span>
            <Picker
              aria-labelledby="loan-acc"
              name="account_id"
              defaultValue={editLoan?.accountId ? String(editLoan.accountId) : ''}
              placeholder="Choose an account"
              options={accountOptions(loanFormAccs, cards)}
              required
            />
          </div>
          <DateField defaultValue={editLoan?.txnDate ?? today} today={today} />
          <label className="field">
            <span>Due by</span>
            <input name="due_date" type="date" className="input" defaultValue={editLoan?.dueDate ?? ''} />
            <span className="hint">Optional</span>
          </label>
          <label className="field">
            <span>Note</span>
            <input name="note" className="input" defaultValue={editLoan?.note ?? ''} placeholder="Optional" maxLength={200} />
          </label>
          <div className="span-all form-actions">
            <SubmitButton>{editLoan ? 'Save changes' : 'Save loan'}</SubmitButton>
            {editLoan && <Link href="/loans" className="btn-quiet">Cancel</Link>}
          </div>
        </form>
      </EntrySheet>

      <section aria-labelledby="active-h" className="space-y-3">
        <h2 id="active-h" className="display text-[1.2rem]">Open loans</h2>
        {loanGroups.length === 0 ? (
          <div className="leaf empty"><p>No open loans. Nothing owed either way.</p></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {loanGroups.map((groupLoans) => {
              const provider = groupLoans[0].provider;
              const net = groupLoans.reduce((s, l) => s + (l.type === 'given' ? l.balance : -l.balance), 0);
              return (
                <article key={provider} className="leaf overflow-hidden">
                  <div className="leaf-head">
                    <h3>{provider}</h3>
                    <div className="text-right">
                      <Amount value={net} sign tone={net >= 0 ? 'credit' : 'debit'} className="text-[1.15rem] font-semibold" />
                      <p className="text-xs text-muted">{net >= 0 ? 'owes you' : 'you owe'}</p>
                    </div>
                  </div>
                  <ul className="ledger">
                    {groupLoans.map((loan) => {
                      const paidPct = loan.amount > 0 ? Math.min(100, ((loan.amount - loan.balance) / loan.amount) * 100) : 0;
                      return (
                        <li key={loan.id} id={`loan-${loan.id}`} className="scroll-mt-20">
                          <div className="row items-start">
                            <div className="row-main">
                              <p className="row-title">{loan.type === 'taken' ? 'Borrowed' : 'Lent'} on {formatDay(loan.txnDate, { weekday: false, year: true })}</p>
                              <p className="row-sub">
                                {loan.dueDate ? `Due ${formatDay(loan.dueDate, { weekday: false, year: true })}` : 'No due date'}
                                {loan.note ? ` — ${loan.note}` : ''}
                              </p>
                              <div className={`bar mt-2 max-w-[14rem] ${loan.type === 'given' ? 'bar-credit' : ''}`} role="img" aria-label={`${paidPct.toFixed(0)}% repaid`}>
                                <span style={{ width: `${paidPct}%` }} />
                              </div>
                            </div>
                            <div className="text-right">
                              <Amount value={loan.balance} tone={loan.type === 'taken' ? 'debit' : 'credit'} className="row-amount" />
                              <p className="row-sub">of <Amount value={loan.amount} /></p>
                            </div>
                          </div>

                          {payId === loan.id ? (
                            <form action={recordPayment} className="entry-form border-t border-rule bg-[#F8FAFC] px-4 py-4" data-online-only>
                              <input type="hidden" name="id" value={loan.id} />
                              <p className="span-all font-semibold">{loan.type === 'taken' ? 'Record a repayment' : 'Record money received'}</p>
                              <AmountField name="payment_amount" max={loan.balance} autoFocus />
                              <div className="field">
                                <span id={`pay-acc-${loan.id}`}>{loan.type === 'taken' ? 'Paid from' : 'Received into'}</span>
                                <Picker
                                  aria-labelledby={`pay-acc-${loan.id}`}
                                  name="account_id"
                                  defaultValue={loan.accountId && accs.some((a) => a.id === loan.accountId) ? String(loan.accountId) : ''}
                                  placeholder="Choose an account"
                                  options={accountOptions(accs, cards, { cardsFirst: loan.type === 'taken' })}
                                  required
                                />
                              </div>
                              <DateField name="payment_date" defaultValue={today} today={today} />
                              <label className="field">
                                <span>Note</span>
                                <input name="note" className="input" placeholder="e.g. part payment" maxLength={200} />
                              </label>
                              <div className="span-all form-actions">
                                <SubmitButton>{loan.type === 'taken' ? 'Record repayment' : 'Record receipt'}</SubmitButton>
                                <Link href="/loans" className="btn-quiet">Cancel</Link>
                              </div>
                            </form>
                          ) : (
                            <div className="row-actions">
                              <Link href={`/loans?pay=${loan.id}#loan-${loan.id}`} className="btn-primary btn-sm">
                                {loan.type === 'taken' ? 'Repay' : 'Received'}
                              </Link>
                              <Link href={`/loans?edit=${loan.id}#entry`} className="btn-secondary btn-sm">Edit</Link>
                              <form action={closeLoan} data-online-only>
                                <input type="hidden" name="id" value={loan.id} />
                                <ConfirmButton type="submit" className="btn-secondary btn-sm" message="Close this loan? Any remaining balance is recorded as a final payment.">Close</ConfirmButton>
                              </form>
                              <form action={deleteLoan} data-online-only>
                                <input type="hidden" name="id" value={loan.id} />
                                <ConfirmButton type="submit" className="btn-danger btn-sm" message="Delete this loan and its payment history?">Delete</ConfirmButton>
                              </form>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {closedLoans.length > 0 && (
        <section className="leaf overflow-hidden" aria-labelledby="closed-h">
          <div className="leaf-head"><h2 id="closed-h">Recently settled</h2></div>
          <ul className="ledger">
            {closedLoans.map((loan) => (
              <li key={loan.id} className="row">
                <div className="row-main">
                  <p className="row-title">{loan.provider}</p>
                  <p className="row-sub">
                    {loan.type === 'taken' ? 'Borrowed' : 'Lent'} {formatDay(loan.txnDate, { weekday: false, year: true })}
                    {loan.note ? ` — ${loan.note}` : ''}
                  </p>
                </div>
                <Amount value={loan.amount} className="row-amount text-muted" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="leaf" aria-labelledby="providers-h">
        <div className="leaf-head"><h2 id="providers-h">Saved names</h2></div>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted">Names saved here are suggested when you add a loan.</p>
          <form action={addLoanProvider} className="flex gap-2" data-online-only>
            <label className="sr-only" htmlFor="provider-name">Name</label>
            <input id="provider-name" name="name" className="input" placeholder="Person or institution" required maxLength={80} />
            <SubmitButton className="btn-secondary" pendingLabel="Adding…">Add</SubmitButton>
          </form>
          {providers.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <li key={p.id} className="chip gap-1 pr-1">
                  {p.name}
                  <form action={deleteLoanProvider} data-online-only>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmButton type="submit" className="grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-debit-wash hover:text-debit" aria-label={`Remove ${p.name}`} message={`Remove ${p.name} from saved names?`}>×</ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
