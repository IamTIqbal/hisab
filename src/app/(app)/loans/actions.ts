'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, sql, asc } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { loans, incomes, expenses, loanProviders, accounts } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { todayDate } from '@/lib/money';
import { sendNotification } from '@/lib/email';
import { str, num, int, fail, date } from '@/lib/form';
import { assertAccountOpen } from '@/lib/accountGuard';

async function accountName(id: number): Promise<string> {
  const rows = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0]?.name ?? String(id);
}

// Rebuilds the ledger entries this module owns for a loan.
//
// Correct accounting model:
//   TAKEN loan (you owe): income(full amount) at loan account + expense(amount paid) at payment accounts
//   GIVEN loan (owed to you): expense(full amount) at loan account + income(amount received) at payment accounts
//
// Neither type appears in income/expense pages because both are filtered by loanId IS NOT NULL.
//
// Ownership matters here. Rows noted "Payment…" (but not the derived
// "Payment reconciliation…") were written by recordPayment() or an auto-merge
// and carry their own account and date — wiping those on an edit moved real
// money between accounts behind the user's back. Everything else attached to
// the loan is derived and gets rebuilt, so imported rows with an unrecognised
// note keep the old wipe-and-rebuild behaviour rather than being mistaken for
// payments and double-counted.
// Kept as one parenthesised expression — drizzle's and() does not wrap raw sql
// operands, so a bare OR here would leak past the loan_id filter.
const notRecordedPayment = (note: typeof incomes.note | typeof expenses.note) =>
  sql`(${note} IS NULL OR ${note} NOT LIKE 'Payment%' OR ${note} LIKE 'Payment reconciliation%')`;
const OWNED_INCOME = notRecordedPayment(incomes.note);
const OWNED_EXPENSE = notRecordedPayment(expenses.note);

// Every multi-row change to a loan runs inside one write transaction: a
// failure halfway (a dropped connection to Turso) used to leave a loan whose
// balance no longer matched the income/expense rows behind it. libSQL opens
// these in write mode by default.
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function rebuildLoanLedger(
  tx: Tx,
  loanId: number, type: string, accountId: number,
  amount: number, targetPaid: number,
  txnDate: string, provider: string, note: string | null,
  { wipeAll = false }: { wipeAll?: boolean } = {},
) {
  if (wipeAll) {
    // The loan flipped taken <-> given, so every surviving row is on the wrong
    // side of the ledger and cannot be carried over.
    await tx.delete(incomes).where(eq(incomes.loanId, loanId));
    await tx.delete(expenses).where(eq(expenses.loanId, loanId));
  } else {
    await tx.delete(incomes).where(and(eq(incomes.loanId, loanId), OWNED_INCOME));
    await tx.delete(expenses).where(and(eq(expenses.loanId, loanId), OWNED_EXPENSE));
  }

  if (!accountId || amount <= 0) return;

  const baseNote = `Loan: ${provider} [Loan#${loanId}]`;
  const ledgerNote = note ? `${baseNote} | ${note}` : baseNote;
  const reconNote = `Payment reconciliation [Loan#${loanId}]`;

  // Payments already on the ledger. The reconciliation entry only needs to
  // cover the gap between those and the balance the user typed in.
  const paidRows = type === 'taken'
    ? await tx.select({ total: sql<number>`COALESCE(SUM(${expenses.amount}),0)` }).from(expenses).where(eq(expenses.loanId, loanId))
    : await tx.select({ total: sql<number>`COALESCE(SUM(${incomes.amount}),0)` }).from(incomes).where(eq(incomes.loanId, loanId));
  const alreadyPaid = Number(paidRows[0]?.total ?? 0);
  const adjustment = targetPaid - alreadyPaid;

  if (type === 'taken') {
    // Initial receipt: income for full loan amount
    await tx.insert(incomes).values({ source: 'other', amount, accountId, txnDate, note: ledgerNote, loanId });
    if (adjustment > 0.001) {
      await tx.insert(expenses).values({ category: 'loan', amount: adjustment, accountId, txnDate, note: reconNote, loanId });
    } else if (adjustment < -0.001) {
      // Balance raised above what the recorded payments imply — post the
      // reversal on the opposite side so account balances stay consistent.
      await tx.insert(incomes).values({ source: 'other', amount: -adjustment, accountId, txnDate, note: reconNote, loanId });
    }
  } else {
    // Initial disbursement: expense for full loan amount
    await tx.insert(expenses).values({ category: 'loan', amount, accountId, txnDate, note: ledgerNote, loanId });
    if (adjustment > 0.001) {
      await tx.insert(incomes).values({ source: 'other', amount: adjustment, accountId, txnDate, note: reconNote, loanId });
    } else if (adjustment < -0.001) {
      await tx.insert(expenses).values({ category: 'loan', amount: -adjustment, accountId, txnDate, note: reconNote, loanId });
    }
  }
}

export async function addLoan(formData: FormData) {
  await requireAuth();
  const type = str(formData, 'type');
  const provider = str(formData, 'provider');
  const amount = num(formData, 'amount');
  const note = str(formData, 'note');
  const txnDate = date(formData, 'txn_date') || todayDate();
  const dueDate = date(formData, 'due_date') || null;
  const accountId = int(formData, 'account_id');

  if (!['taken', 'given'].includes(type)) fail('/loans', 'Pick a valid loan type.');
  if (!provider) fail('/loans', 'Provider or person is required.');
  if (amount <= 0) fail('/loans', 'Loan amount must be greater than zero.');
  if (!accountId) fail('/loans', 'Pick an account for this loan.');
  await assertAccountOpen(accountId, '/loans');

  // Auto-merge: if existing active loans of the OPPOSITE type exist for this person,
  // treat this entry as payments on those loans instead of creating a new separate loan.
  await db.transaction(async (tx) => {
    const oppositeType = type === 'taken' ? 'given' : 'taken';
    const existingOpposite = await tx.select().from(loans).where(
      and(
        sql`LOWER(TRIM(${loans.provider})) = LOWER(TRIM(${provider}))`,
        eq(loans.type, oppositeType as 'taken' | 'given'),
        eq(loans.status, 'active'),
      )
    ).orderBy(asc(loans.txnDate));

    if (existingOpposite.length > 0) {
      // Apply this amount as payments against existing opposite-type loans (oldest first)
      let remaining = amount;
      for (const existing of existingOpposite) {
        if (remaining < 0.01) break;
        const payAmount = Math.min(remaining, existing.balance);
        const newBalance = Math.max(0, existing.balance - payAmount);
        const newStatus = newBalance < 0.01 ? 'closed' : 'active';

        await tx.update(loans).set({ balance: newBalance, status: newStatus }).where(eq(loans.id, existing.id));

        const payNote = note
          ? `Payment [Loan#${existing.id}] | ${note}`
          : `Payment ${type === 'taken' ? 'from' : 'to'} ${provider} [Loan#${existing.id}]`;

        if (type === 'taken') {
          // New "taken" = money received back → income at selected account (applied to given loan)
          await tx.insert(incomes).values({
            source: 'other', amount: payAmount, accountId,
            txnDate, note: payNote, loanId: existing.id,
          });
        } else {
          // New "given" = money paid out → expense at selected account (applied to taken loan)
          await tx.insert(expenses).values({
            category: 'loan', amount: payAmount, accountId,
            txnDate, note: payNote, loanId: existing.id,
          });
        }
        remaining -= payAmount;
      }

      if (remaining > 0.01) {
        // Excess beyond existing opposite loans → create a new loan for the remainder
        const [newLoan] = await tx.insert(loans).values({
          type: type as 'taken' | 'given', provider, amount: remaining, balance: remaining,
          txnDate, dueDate, status: 'active', note: note || null,
          accountId, affectsAccountBalance: 1,
        }).returning();
        await rebuildLoanLedger(tx, newLoan.id, type, accountId, remaining, 0, txnDate, provider, note || null);
      }
    } else {
      // Normal: no opposite-type loans — create new loan record
      const [newLoan] = await tx.insert(loans).values({
        type: type as 'taken' | 'given', provider, amount, balance: amount,
        txnDate, dueDate, status: 'active', note: note || null,
        accountId, affectsAccountBalance: 1,
      }).returning();
      await rebuildLoanLedger(tx, newLoan.id, type, accountId, amount, 0, txnDate, provider, note || null);
    }
  });

  await sendNotification('loan.add', {
    type, provider, amount,
    account_name: await accountName(accountId),
    txn_date: txnDate, due_date: dueDate || undefined, note: note || undefined,
    status: 'active',
  });

  revalidatePath('/loans');
  redirect('/loans');
}

export async function updateLoan(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  const type = str(formData, 'type');
  const provider = str(formData, 'provider');
  const amount = num(formData, 'amount');
  const balance = num(formData, 'balance');
  const note = str(formData, 'note');
  const txnDate = date(formData, 'txn_date');
  const dueDate = date(formData, 'due_date') || null;
  const accountId = int(formData, 'account_id');
  const newBalance = Math.max(0, Math.min(balance, amount));
  const paidSoFar = amount - newBalance;
  const status = newBalance <= 0 ? 'closed' : 'active';

  if (!id) fail('/loans', 'Loan not found.');
  if (!['taken', 'given'].includes(type)) fail('/loans', 'Pick a valid loan type.');
  if (!provider) fail('/loans', 'Provider or person is required.');
  if (amount <= 0) fail('/loans', 'Loan amount must be greater than zero.');
  if (!accountId) fail('/loans', 'Pick an account for this loan.');
  if (!txnDate) fail('/loans', 'Enter a valid date.');

  const [existing] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
  if (!existing) fail('/loans', 'Loan not found.');
  if (existing.accountId) await assertAccountOpen(existing.accountId, '/loans');
  await assertAccountOpen(accountId, '/loans');
  // Flipping taken/given would have to throw away payments recorded through
  // other accounts and dates, moving money between accounts.
  if (existing.type !== type && existing.amount - existing.balance > 0.001) {
    fail('/loans', 'This loan already has payments, so its direction can’t change. Delete it and record it again.');
  }

  await db.transaction(async (tx) => {
    await tx.update(loans).set({
      type: type as 'taken' | 'given', provider, amount,
      balance: newBalance, note: note || null,
      txnDate, dueDate, status, accountId,
      affectsAccountBalance: 1,
    }).where(eq(loans.id, id));

    // Rebuild the derived entries; recorded payments survive unless the loan
    // type flipped, which puts them on the wrong side of the ledger.
    await rebuildLoanLedger(tx, id, type, accountId, amount, paidSoFar, txnDate, provider, note || null, {
      wipeAll: existing.type !== type,
    });
  });

  await sendNotification('loan.update', {
    type, provider, amount, balance: newBalance, status,
    account_name: await accountName(accountId),
    txn_date: txnDate, due_date: dueDate || undefined, note: note || undefined,
  });

  revalidatePath('/loans');
  redirect('/loans');
}

// Records a partial or full payment on an existing loan.
// TAKEN loan (you owe):  payment creates an EXPENSE at the payment account → account balance decreases.
// GIVEN loan (owed to you): payment received creates an INCOME at the payment account → account balance increases.
// The original loan receipt/disbursement entry at the original account is NEVER touched here.
export async function recordPayment(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  const paymentAmount = num(formData, 'payment_amount');
  const accountId = int(formData, 'account_id');
  const paymentDate = date(formData, 'payment_date') || todayDate();
  const note = str(formData, 'note');

  if (!id) fail('/loans', 'Loan not found.');
  if (paymentAmount <= 0) fail('/loans', 'Payment amount must be greater than zero.');
  if (!accountId) fail('/loans', 'Pick the account this payment moves through.');

  const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
  if (!loan) fail('/loans', 'Loan not found.');
  if (paymentAmount > loan.balance + 0.001) fail('/loans', 'Payment amount exceeds the remaining balance.');
  await assertAccountOpen(accountId, '/loans');

  const newBalance = Math.max(0, Math.round((loan.balance - paymentAmount) * 100) / 100);
  const status = newBalance <= 0 ? 'closed' : 'active';

  const applied = await db.transaction(async (tx) => {
    // Only applies if the balance is still what was read above, so a double
    // submit cannot record the same payment twice.
    const res = await tx
      .update(loans)
      .set({ balance: newBalance, status })
      .where(and(eq(loans.id, id), eq(loans.balance, loan.balance), eq(loans.status, 'active')));
    if (res.rowsAffected !== 1) return false;

    const baseNote = `Payment: ${loan.provider} [Loan#${id}]`;
    const ledgerNote = note ? `${baseNote} | ${note}` : baseNote;

    if (loan.type === 'taken') {
      // You're paying back money: expense at the selected payment account
      await tx.insert(expenses).values({
        category: 'loan', amount: paymentAmount, accountId,
        txnDate: paymentDate, note: ledgerNote, loanId: id,
      });
    } else {
      // You're receiving repayment: income at the selected payment account
      await tx.insert(incomes).values({
        source: 'other', amount: paymentAmount, accountId,
        txnDate: paymentDate, note: ledgerNote, loanId: id,
      });
    }
    return true;
  });
  if (!applied) fail('/loans', 'This loan changed while you were saving. Check it and try again.');

  revalidatePath('/loans');
  redirect('/loans');
}

// Closing settles whatever is left. It must NOT erase the ledger: deleting the
// principal entry made the money you originally received (or lent out) vanish
// from your account balance, silently rewriting history.
export async function closeLoan(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/loans', 'Loan not found.');

  const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);
  if (!loan) fail('/loans', 'Loan not found.');
  if (loan.status === 'closed') redirect('/loans');
  if (loan.accountId && loan.balance > 0.001) await assertAccountOpen(loan.accountId, '/loans');

  await db.transaction(async (tx) => {
    // Claim the close first, so a double submit settles only once.
    const res = await tx
      .update(loans)
      .set({ balance: 0, status: 'closed' })
      .where(and(eq(loans.id, id), eq(loans.status, 'active')));
    if (res.rowsAffected !== 1) return;

    const remaining = Math.max(0, loan.balance);
    if (remaining > 0.001 && loan.accountId) {
      const settleNote = `Payment: ${loan.provider} [Loan#${id}] | settled on close`;
      if (loan.type === 'taken') {
        await tx.insert(expenses).values({
          category: 'loan', amount: remaining, accountId: loan.accountId,
          txnDate: todayDate(), note: settleNote, loanId: id,
        });
      } else {
        await tx.insert(incomes).values({
          source: 'other', amount: remaining, accountId: loan.accountId,
          txnDate: todayDate(), note: settleNote, loanId: id,
        });
      }
    }
  });

  await sendNotification('loan.close', {
    provider: loan.provider, type: loan.type, amount: loan.amount,
    txn_date: loan.txnDate,
  });

  revalidatePath('/loans');
  redirect('/loans');
}

export async function deleteLoan(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/loans', 'Loan not found.');

  const [loan] = await db.select().from(loans).where(eq(loans.id, id)).limit(1);

  await db.transaction(async (tx) => {
    await tx.delete(incomes).where(eq(incomes.loanId, id));
    await tx.delete(expenses).where(eq(expenses.loanId, id));
    await tx.delete(loans).where(eq(loans.id, id));
  });

  if (loan) {
    await sendNotification('loan.delete', {
      provider: loan.provider, type: loan.type, amount: loan.amount,
    });
  }

  revalidatePath('/loans');
  redirect('/loans');
}

export async function addLoanProvider(formData: FormData) {
  await requireAuth();
  const name = str(formData, 'name');
  if (!name) fail('/loans', 'Provider name is required.');
  await db.insert(loanProviders).values({ name }).onConflictDoNothing();
  revalidatePath('/loans');
  redirect('/loans');
}

export async function deleteLoanProvider(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/loans', 'Provider not found.');
  await db.delete(loanProviders).where(eq(loanProviders.id, id));
  revalidatePath('/loans');
  redirect('/loans');
}
