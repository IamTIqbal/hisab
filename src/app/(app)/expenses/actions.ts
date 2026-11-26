'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { expenses, accounts } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { isPickableCategory, moneyWithSymbol } from '@/lib/money';
import { assertAccountOpen } from '@/lib/accountGuard';
import { ledgerSnapshot } from '@/lib/db/queries';
import { sendNotification } from '@/lib/email';
import { str, num, int, fail, date } from '@/lib/form';

async function accountName(id: number): Promise<string> {
  const rows = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0]?.name ?? String(id);
}

// Spending is the usual way money leaves an account, so it has to respect the
// same headroom a transfer out of that account already does — a card can't
// exceed its limit, and a cash/bank account can't be walked below zero (a
// mobile wallet or bank balance can't actually go negative; a card is the one
// account type where a negative balance is the normal, expected state).
// `excludeAmount` is the pre-edit amount of the row being changed, already
// counted in the account's balance and not to be charged twice.
async function assertAccountCanAfford(accountId: number, amount: number, excludeAmount = 0) {
  const { accs: balances, cards } = await ledgerSnapshot();
  const card = cards.find((c) => c.accountId === accountId);
  if (card) {
    const headroom = card.availableLimit + excludeAmount;
    if (amount > headroom + 0.001) {
      fail('/expenses', `Expense exceeds available credit on ${card.accountName} (${moneyWithSymbol(headroom)} available).`);
    }
    return;
  }
  const account = balances.find((a) => a.id === accountId);
  if (!account) return;
  const headroom = account.currentBalance + excludeAmount;
  if (amount > headroom + 0.001) {
    fail('/expenses', `Insufficient balance in ${account.name} (${moneyWithSymbol(headroom)} available).`);
  }
}

export async function addExpense(formData: FormData) {
  await requireAuth();
  const category = str(formData, 'category');
  const amount = num(formData, 'amount');
  const accountId = int(formData, 'account_id');
  const txnDate = date(formData, 'txn_date');
  const note = str(formData, 'note');

  if (!isPickableCategory(category)) fail('/expenses', 'Pick a valid category.');
  if (amount <= 0) fail('/expenses', 'Amount must be greater than zero.');
  if (!accountId) fail('/expenses', 'Pick an account.');
  if (!txnDate) fail('/expenses', 'Enter a valid date.');

  await assertAccountOpen(accountId, '/expenses');
  await assertAccountCanAfford(accountId, amount);

  await db.insert(expenses).values({ category, amount, accountId, txnDate, note: note || null });

  await sendNotification('expense.add', {
    category, amount, account_name: await accountName(accountId), txn_date: txnDate, note: note || undefined,
  });

  revalidatePath('/expenses');
  redirect('/expenses');
}

export async function updateExpense(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  const category = str(formData, 'category');
  const amount = num(formData, 'amount');
  const accountId = int(formData, 'account_id');
  const txnDate = date(formData, 'txn_date');
  const note = str(formData, 'note');

  if (!id) fail('/expenses', 'Expense entry not found.');
  if (amount <= 0) fail('/expenses', 'Amount must be greater than zero.');
  if (!accountId) fail('/expenses', 'Pick an account.');
  if (!txnDate) fail('/expenses', 'Enter a valid date.');

  const [before] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  if (!before) fail('/expenses', 'Expense entry not found.');
  if (before.loanId) fail('/expenses', 'This entry is a loan payment. Change it on Loans.');
  // Moving money out of (or changing it in) a closed account would leave it a
  // hidden non-zero balance.
  if (before.accountId !== accountId || before.amount !== amount) await assertAccountOpen(before.accountId, '/expenses');
  // An older entry may carry a category that has since been merged away;
  // saving it unchanged is fine, switching to one is not.
  if (!isPickableCategory(category) && category !== before.category) fail('/expenses', 'Pick a valid category.');
  await assertAccountOpen(accountId, '/expenses', before.accountId);
  await assertAccountCanAfford(accountId, amount, before.accountId === accountId ? before.amount : 0);

  await db.update(expenses).set({ category, amount, accountId, txnDate, note: note || null }).where(eq(expenses.id, id));

  await sendNotification('expense.update', {
    category, amount, account_name: await accountName(accountId), txn_date: txnDate, note: note || undefined,
  });

  revalidatePath('/expenses');
  redirect('/expenses');
}

export async function deleteExpense(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/expenses', 'Expense entry not found.');

  const rows = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  const snap = rows[0];
  if (!snap) fail('/expenses', 'Expense entry not found.');
  if (snap.loanId) fail('/expenses', 'This entry is a loan payment. Change it on Loans.');
  await assertAccountOpen(snap.accountId, '/expenses');

  await db.delete(expenses).where(eq(expenses.id, id));

  if (snap) {
    await sendNotification('expense.delete', {
      category: snap.category, amount: snap.amount,
      account_name: await accountName(snap.accountId),
      txn_date: snap.txnDate, note: snap.note || undefined,
    });
  }

  revalidatePath('/expenses');
  redirect('/expenses');
}
