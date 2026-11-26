import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot, totalBalance, monthlyIncome, monthlyExpense } from '@/lib/db/queries';
import { currentMonth, monthLabel, formatDay, todayDate } from '@/lib/money';
import { Amount, AccountMark } from '@/components/Ledger';
import { IconOut, IconIn, IconSwap } from '@/components/Icons';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await requireAuth();

  const month = currentMonth();
  const monthName = monthLabel(month).split(' ')[0];
  const [{ accs, cards }, incomeTotal, expenseTotal] = await Promise.all([
    ledgerSnapshot(),
    monthlyIncome(month),
    monthlyExpense(month),
  ]);

  const cardsByAccountId = Object.fromEntries(cards.map((c) => [c.accountId, c]));
  const cardAccountIds = new Set(cards.map((c) => c.accountId));
  const inHand = totalBalance(accs, cardAccountIds);
  const cardDue = cards.reduce((s, c) => s + c.usedLimit, 0);
  // Sum the per-card figure rather than limit − used: a card paid past zero
  // carries credit above its limit, which the subtraction would discard.
  const cardAvailable = cards.reduce((s, c) => s + c.availableLimit, 0);
  const cardLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const net = incomeTotal - expenseTotal;

  // Near-empty bank accounts are kept off the overview; they stay on Accounts.
  const shown = accs.filter((acc) => cardAccountIds.has(acc.id) || acc.type !== 'bank' || acc.currentBalance >= 10);
  const hiddenCount = accs.length - shown.length;
  const cashAndBank = shown.filter((a) => !cardAccountIds.has(a.id));
  const cardAccounts = shown.filter((a) => cardAccountIds.has(a.id));

  return (
    <div className="overview">
        {/* The balance band continues the header: what you hold, then the
            month so far, then the three things you come here to do. */}
        <section className="band ov-band" aria-labelledby="in-hand">
          <p className="band-date">{formatDay(todayDate())}</p>
          <h1 id="in-hand" className="band-label">Money in hand</h1>
          <p className="band-figure">
            <Amount value={inHand} />
          </p>
          <p className="band-note">
            {cashAndBank.length} cash and bank {cashAndBank.length === 1 ? 'account' : 'accounts'}
            {cardDue > 0 ? <>, <Amount value={cardDue} /> owed on cards</> : ', not counting cards'}
          </p>
          <nav aria-label="Quick add" className="quick">
            <Link href="/expenses?add=1" className="quick-btn"><span className="quick-icon"><IconOut className="h-5 w-5" /></span>Spend</Link>
            <Link href="/income?add=1" className="quick-btn"><span className="quick-icon"><IconIn className="h-5 w-5" /></span>Receive</Link>
            <Link href="/accounts?transfer=1#transfer" className="quick-btn"><span className="quick-icon"><IconSwap className="h-5 w-5" /></span>Transfer</Link>
          </nav>
        </section>


        <section className="leaf overflow-hidden ov-accounts" aria-labelledby="accounts-h">
          <div className="leaf-head">
            <h2 id="accounts-h">Accounts</h2>
            <Link href="/accounts">Manage</Link>
          </div>
          {accs.length === 0 ? (
            <div className="empty">
              <p>Add the accounts you hold — bank, bKash, cash in wallet — and their balances will appear here.</p>
              <Link href="/accounts?add=1" className="btn-primary">Add an account</Link>
            </div>
          ) : (
            <ul className="ledger">
              {cashAndBank.map((acc) => (
                <li key={acc.id}>
                  <div className="row row-compact">
                    <AccountMark name={acc.name} type={acc.type} size={36} />
                    <div className="row-main leader-row">
                      <span className="row-title truncate">{acc.name}</span>
                      <span className="leader hidden sm:block" aria-hidden />
                    </div>
                    <Amount value={acc.currentBalance} tone={acc.currentBalance < 0 ? 'debit' : undefined} className="row-amount" />
                  </div>
                </li>
              ))}
              {hiddenCount > 0 && (
                <li>
                  <Link href="/accounts" className="row row-compact text-sm text-muted no-underline hover:text-ink">
                    {hiddenCount} near-empty bank {hiddenCount === 1 ? 'account' : 'accounts'} not shown
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {cardAccounts.length > 0 && (
          <section className="leaf overflow-hidden ov-cards" aria-labelledby="cards-h">
            <div className="leaf-head">
              <h2 id="cards-h">Credit cards</h2>
              <span className="text-sm text-muted">
                <Amount value={cardAvailable} /> of <Amount value={cardLimit} /> free
              </span>
            </div>
            <ul className="ledger">
              {cardAccounts.map((acc) => {
                const cc = cardsByAccountId[acc.id];
                return (
                  <li key={acc.id}>
                    <div className="row">
                      <AccountMark name={acc.name} type="credit" size={36} />
                      <div className="row-main">
                        <p className="row-title">{acc.name}</p>
                        <div className="bar mt-1.5 max-w-[14rem]" role="img" aria-label={`${cc.utilizationPercent.toFixed(0)}% of limit used`}>
                          <span style={{ width: `${cc.utilizationPercent}%` }} />
                        </div>
                        <p className="row-sub"><Amount value={cc.availableLimit} /> available</p>
                      </div>
                      <div className="text-right">
                        <Amount value={cc.usedLimit} tone={cc.usedLimit > 0 ? 'debit' : undefined} className="row-amount" />
                        <p className="row-sub">owed</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="leaf overflow-hidden ov-month" aria-labelledby="month-h">
          <div className="leaf-head">
            <h2 id="month-h">{monthName} so far</h2>
            <Link href="/reports">Report</Link>
          </div>
          <dl className="tally tally-3">
            <div>
              <dt className="figure-label">Earned</dt>
              <dd className="figure-md"><Amount value={incomeTotal} tone="credit" /></dd>
            </div>
            <div>
              <dt className="figure-label">Spent</dt>
              <dd className="figure-md"><Amount value={expenseTotal} tone="debit" /></dd>
            </div>
            <div>
              <dt className="figure-label">{net >= 0 ? 'Left over' : 'Overspent'}</dt>
              <dd className="figure-md"><Amount value={net} tone={net >= 0 ? 'credit' : 'debit'} /></dd>
            </div>
          </dl>
        </section>
    </div>
  );
}
