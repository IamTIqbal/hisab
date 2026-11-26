import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot, type AccountWithBalance } from '@/lib/db/queries';
import { formatDay, todayDate, currencySymbol } from '@/lib/money';
import { accountOptions } from '@/lib/accountOptions';
import { bankDetailLines, bankDetailsText } from '@/lib/bankDetails';
import { ConfirmButton } from '@/components/ConfirmButton';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { AccountTypeFields } from '@/components/AccountTypeFields';
import { CopyButton } from '@/components/CopyButton';
import { Picker } from '@/components/Picker';
import { AmountField, DateField } from '@/components/EntryFields';
import { Amount, AccountMark, EntrySheet, PageHeader } from '@/components/Ledger';
import { addAccount, updateAccount, deleteAccount, closeAccount, reopenAccount, addTransfer } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accounts' };

type SP = { edit?: string; add?: string; transfer?: string; error?: string };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAuth();
  const sp = await searchParams;
  const editId = sp.edit ? parseInt(sp.edit, 10) || 0 : 0;

  const { accs, cards, closed } = await ledgerSnapshot();
  const cardsByAccountId = Object.fromEntries(cards.map((c) => [c.accountId, c]));
  const editAccount = editId ? accs.find((a) => a.id === editId) ?? null : null;
  const editCard = editAccount ? cardsByAccountId[editAccount.id] ?? null : null;
  const today = todayDate();

  const groups: { title: string; items: AccountWithBalance[] }[] = [
    { title: 'Bank and mobile banking', items: accs.filter((a) => a.type === 'bank' && !cardsByAccountId[a.id]) },
    { title: 'Cash', items: accs.filter((a) => a.type === 'cash' && !cardsByAccountId[a.id]) },
    { title: 'Credit cards', items: accs.filter((a) => cardsByAccountId[a.id]) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Accounts" />

      <FormError message={sp.error} />

      <EntrySheet title={editAccount ? `Edit ${editAccount.name}` : 'New account'} open={!!editAccount || !!sp.add}>
        <form key={editAccount?.id ?? 'new'} action={editAccount ? updateAccount : addAccount} className="entry-form" data-online-only>
          {editAccount && <input type="hidden" name="id" value={editAccount.id} />}
          <AccountTypeFields
            currency={currencySymbol()}
            defaultName={editAccount?.name ?? ''}
            showProviders={!editAccount}
            defaultType={editAccount?.type ?? 'bank'}
            defaultAccountNumber={editAccount?.accountNumber ?? ''}
            card={editCard}
            bank={editAccount}
          />
          <label className="field">
            <span>Branch</span>
            <input name="branch_name" className="input" defaultValue={editAccount?.branchName ?? ''} placeholder="Optional" maxLength={80} />
          </label>
          <label className="field">
            <span>Opening balance ({currencySymbol()})</span>
            <input name="opening_balance" type="number" inputMode="decimal" step="0.01" className="input" defaultValue={editAccount?.openingBalance ?? 0} />
            <span className="hint">What the account held before you started recording here.</span>
          </label>
          <div className="span-all form-actions">
            <SubmitButton>{editAccount ? 'Save changes' : 'Add account'}</SubmitButton>
            {editAccount && <Link href="/accounts" className="btn-quiet">Cancel</Link>}
          </div>
        </form>
      </EntrySheet>

      {accs.length >= 2 && (
        <EntrySheet id="transfer" title="Move money between accounts" open={!!sp.transfer}>
          <form action={addTransfer} className="entry-form" data-online-only>
            <AmountField />
            <div className="field">
              <span id="tr-from">From</span>
              <Picker aria-labelledby="tr-from" name="from_account_id" placeholder="Choose an account" options={accountOptions(accs, cards, { cardsFirst: false })} required />
            </div>
            <div className="field">
              <span id="tr-to">To</span>
              <Picker aria-labelledby="tr-to" name="to_account_id" placeholder="Choose an account" options={accountOptions(accs, cards, { cardsFirst: false })} required />
            </div>
            <label className="field">
              <span>Fee charged ({currencySymbol()})</span>
              <input name="charge" type="number" inputMode="decimal" step="0.01" min="0" className="input" defaultValue="0" />
              <span className="hint">Cash-out or transfer fee, taken from the source account.</span>
            </label>
            <DateField defaultValue={today} today={today} />
            <label className="field">
              <span>Note</span>
              <input name="note" className="input" placeholder="Optional" maxLength={200} />
            </label>
            <div className="span-all form-actions">
              <SubmitButton pendingLabel="Moving…">Move money</SubmitButton>
            </div>
          </form>
        </EntrySheet>
      )}

      {accs.length === 0 ? (
        <section className="leaf empty">
          <p>No accounts yet. Add each place you keep money: a bank, bKash or Nagad, cash in hand, a credit card.</p>
          <Link href="/accounts?add=1" className="btn-primary">Add an account</Link>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="leaf overflow-hidden" aria-label={group.title}>
            <div className="leaf-head">
              <h2>{group.title}</h2>
              <Amount
                value={group.items.reduce((s, a) => s + (cardsByAccountId[a.id] ? -cardsByAccountId[a.id].usedLimit : a.currentBalance), 0)}
                className="text-[0.95rem] font-semibold text-ink-soft"
              />
            </div>
            <ul className="ledger">
              {group.items.map((acc) => {
                const cc = cardsByAccountId[acc.id];
                const lines = cc ? [] : bankDetailLines(acc);
                const atZero = Math.abs(acc.currentBalance) < 0.005;
                const sub = cc ? null : [acc.bankName && acc.bankName !== acc.name ? acc.bankName : null, acc.accountNumber].filter(Boolean).join(', ');
                return (
                  <li key={acc.id}>
                    <details className="row-more">
                      <summary className="row">
                        <AccountMark name={acc.name} type={acc.type} />
                        <div className="row-main">
                          <p className="row-title">{acc.name}</p>
                          {cc ? (
                            <>
                              <div className="bar mt-1.5 max-w-[14rem]" role="img" aria-label={`${cc.utilizationPercent.toFixed(0)}% of limit used`}>
                                <span style={{ width: `${cc.utilizationPercent}%` }} />
                              </div>
                              <p className="row-sub">
                                <Amount value={cc.availableLimit} /> free of <Amount value={cc.creditLimit} />
                              </p>
                            </>
                          ) : (
                            sub && <p className="row-sub num">{sub}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Amount
                            value={cc ? cc.usedLimit : acc.currentBalance}
                            tone={(cc ? cc.usedLimit > 0 : acc.currentBalance < 0) ? 'debit' : undefined}
                            className="row-amount"
                          />
                          {cc && <p className="row-sub">owed</p>}
                        </div>
                      </summary>

                      <div className="row-detail">
                        {cc && <p className="text-sm text-muted">{cc.providerName} card ending {cc.cardLast4}</p>}

                        {lines.length > 0 && (
                          <dl className="bank-slip">
                            {lines.map(([k, v]) => (
                              <div key={k}>
                                <dt>{k}</dt>
                                <dd className={k === 'Account Number' || k === 'Routing Number' ? 'num' : undefined}>{v}</dd>
                              </div>
                            ))}
                          </dl>
                        )}

                        <div className="flex flex-wrap gap-2">
                          {lines.length > 1 && <CopyButton text={bankDetailsText(acc)} label="Copy details" className="btn-primary btn-sm" />}
                          {acc.accountNumber && !cc && <CopyButton text={acc.accountNumber} label="Copy number" />}
                          <a href={`/accounts?edit=${acc.id}#entry`} className="btn-secondary btn-sm">Edit</a>
                          {atZero && (
                            <form action={closeAccount} data-online-only>
                              <input type="hidden" name="id" value={acc.id} />
                              <ConfirmButton type="submit" className="btn-quiet btn-sm" message={`Close ${acc.name}? It disappears from every list and total. Its history is kept, and you can reopen it at the bottom of Accounts.`}>
                                Close account
                              </ConfirmButton>
                            </form>
                          )}
                          <form action={deleteAccount} data-online-only className="ml-auto">
                            <input type="hidden" name="id" value={acc.id} />
                            <ConfirmButton type="submit" className="btn-danger btn-sm" message={`Delete ${acc.name}? Only accounts with no entries can be deleted.`}>Delete</ConfirmButton>
                          </form>
                        </div>
                        {!atZero && (
                          <p className="text-sm text-muted">To close this account, bring its balance to {currencySymbol()}0 first.</p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {closed.length > 0 && (
        <details className="leaf overflow-hidden closed-accounts">
          <summary className="leaf-head cursor-pointer">
            <h2>Closed accounts</h2>
            <span className="text-sm text-muted">{closed.length} hidden</span>
          </summary>
          <ul className="ledger">
            {closed.map((acc) => (
              <li key={acc.id} className="row">
                <AccountMark name={acc.name} type={acc.type} />
                <div className="row-main">
                  <p className="row-title text-ink-soft">{acc.name}</p>
                  <p className="row-sub">Closed {acc.closedAt ? formatDay(acc.closedAt.slice(0, 10), { weekday: false, year: true }) : ''}. History kept.</p>
                </div>
                <form action={reopenAccount} data-online-only>
                  <input type="hidden" name="id" value={acc.id} />
                  <SubmitButton className="btn-secondary btn-sm" pendingLabel="Reopening…">Reopen</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
