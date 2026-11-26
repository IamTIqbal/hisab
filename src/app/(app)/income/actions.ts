'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { incomes, accounts } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { INCOME_SOURCES } from '@/lib/money';
import { sendNotification } from '@/lib/email';
import { str, num, int, fail, date } from '@/lib/form';
import { assertAccountOpen } from '@/lib/accountGuard';

async function accountName(id: number): Promise<string> {
  const rows = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0]?.name ?? String(id);
}

export async function addIncome(formData: FormData) {
  await requireAuth();
  const source = str(formData, 'source');
  const amount = num(formData, 'amount');
  const accountId = int(formData, 'account_id');
  const txnDate = date(formData, 'txn_date');
  const note = str(formData, 'note');

  if (!INCOME_SOURCES.includes(source as never)) fail('/income', 'Pick a valid income source.');
  if (amount <= 0) fail('/income', 'Amount must be greater than zero.');
  if (!accountId) fail('/income', 'Pick an account.');
  if (!txnDate) fail('/income', 'Enter a valid date.');

  await assertAccountOpen(accountId, '/income');
  await db.insert(incomes).values({ source: source as typeof INCOME_SOURCES[number], amount, accountId, txnDate, note: note || null });

  await sendNotification('income.add', {
    source, amount, account_name: await accountName(accountId), txn_date: txnDate, note: note || undefined,
  });

  revalidatePath('/income');
  redirect('/income');
}

export async function updateIncome(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  const source = str(formData, 'source');
  const amount = num(formData, 'amount');
  const accountId = int(formData, 'account_id');
  const txnDate = date(formData, 'txn_date');
  const note = str(formData, 'note');

  if (!id) fail('/income', 'Income entry not found.');
  if (!INCOME_SOURCES.includes(source as never)) fail('/income', 'Pick a valid income source.');
  if (amount <= 0) fail('/income', 'Amount must be greater than zero.');
  if (!accountId) fail('/income', 'Pick an account.');
  if (!txnDate) fail('/income', 'Enter a valid date.');

  const [before] = await db
    .select({ accountId: incomes.accountId, amount: incomes.amount, loanId: incomes.loanId })
    .from(incomes)
    .where(eq(incomes.id, id))
    .limit(1);
  if (!before) fail('/income', 'Income entry not found.');
  if (before.loanId) fail('/income', 'This entry is part of a loan. Change it on Loans.');
  if (before.accountId !== accountId || before.amount !== amount) await assertAccountOpen(before.accountId, '/income');
  await assertAccountOpen(accountId, '/income', before.accountId);
  await db.update(incomes).set({ source: source as typeof INCOME_SOURCES[number], amount, accountId, txnDate, note: note || null }).where(eq(incomes.id, id));

  await sendNotification('income.update', {
    source, amount, account_name: await accountName(accountId), txn_date: txnDate, note: note || undefined,
  });

  revalidatePath('/income');
  redirect('/income');
}

export async function deleteIncome(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/income', 'Income entry not found.');

  const rows = await db.select().from(incomes).where(eq(incomes.id, id)).limit(1);
  const snap = rows[0];
  if (!snap) fail('/income', 'Income entry not found.');
  if (snap.loanId) fail('/income', 'This entry is part of a loan. Change it on Loans.');
  await assertAccountOpen(snap.accountId, '/income');

  await db.delete(incomes).where(eq(incomes.id, id));

  if (snap) {
    await sendNotification('income.delete', {
      source: snap.source, amount: snap.amount,
      account_name: await accountName(snap.accountId),
      txn_date: snap.txnDate, note: snap.note || undefined,
    });
  }

  revalidatePath('/income');
  redirect('/income');
}
