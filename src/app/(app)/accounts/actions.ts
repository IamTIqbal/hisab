'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { accounts, incomes, expenses, transfers, loans, creditCards } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { ledgerSnapshot } from '@/lib/db/queries';
import { sendNotification } from '@/lib/email';
import { moneyWithSymbol, currencySymbol } from '@/lib/money';
import { str, num, int, fail, date } from '@/lib/form';
import { assertAccountOpen } from '@/lib/accountGuard';

async function getAccountName(id: number): Promise<string> {
  const rows = await db.select({ name: accounts.name }).from(accounts).where(eq(accounts.id, id)).limit(1);
  return rows[0]?.name ?? String(id);
}

type AccountType = 'bank' | 'cash' | 'credit';
const ACCOUNT_TYPES: AccountType[] = ['bank', 'cash', 'credit'];

// The card-only fields of the account form. A card is a real account plus a
// credit_cards row; keeping them in sync is what makes limits and utilisation
// work everywhere they are shown.
interface CardDetails {
  providerName: string;
  cardLast4: string;
  creditLimit: number;
}

function readCardDetails(formData: FormData, name: string): CardDetails {
  // Accept whatever the user pasted — "6500", "4748****6500", a full PAN — and
  // keep only the trailing four digits. Nothing else about a card number is
  // worth storing, and a full one is worth actively not storing.
  const digits = str(formData, 'card_last4').replace(/\D/g, '');
  return {
    providerName: str(formData, 'provider_name') || name,
    cardLast4: digits.slice(-4),
    creditLimit: num(formData, 'credit_limit'),
  };
}

// Every card on file is displayed the same way, so the account number is
// derived rather than typed — it cannot drift from card_last4 or quietly end up
// holding the full number.
function maskedCardNumber(last4: string): string {
  return `**** **** **** ${last4}`;
}

// Bank details someone needs to pay into this account. Only a bank account
// carries them; for cash and cards they are cleared.
function readBankDetails(formData: FormData, type: AccountType) {
  if (type !== 'bank') return { holderName: null, bankName: null, routingNumber: null };
  return {
    holderName: str(formData, 'holder_name') || null,
    bankName: str(formData, 'bank_name') || null,
    routingNumber: str(formData, 'routing_number').replace(/\s/g, '') || null,
  };
}

function validateCard(card: CardDetails) {
  if (card.cardLast4.length !== 4) fail('/accounts', 'Enter the last 4 digits of the card number.');
  if (card.creditLimit <= 0) fail('/accounts', 'Credit limit must be greater than zero.');
}

export async function addAccount(formData: FormData) {
  await requireAuth();
  const name = str(formData, 'name');
  const type = str(formData, 'type') as AccountType;
  const branchName = str(formData, 'branch_name') || null;
  const openingBalance = num(formData, 'opening_balance');

  if (!name) fail('/accounts', 'Account name is required.');
  if (!ACCOUNT_TYPES.includes(type)) fail('/accounts', 'Pick a valid account type.');

  const card = type === 'credit' ? readCardDetails(formData, name) : null;
  if (card) validateCard(card);

  const accountNumber = card ? maskedCardNumber(card.cardLast4) : str(formData, 'account_number') || null;
  const bank = readBankDetails(formData, type);

  // Account and card profile land together or not at all — a card account
  // without its credit_cards row would show no limit anywhere.
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(accounts)
      .values({ name, type, accountNumber, branchName, openingBalance, ...bank })
      .returning();
    if (card) await tx.insert(creditCards).values({ accountId: created.id, ...card });
  });

  await sendNotification('account.add', {
    name, type, opening_balance: openingBalance,
    credit_limit: card?.creditLimit, card_last4: card?.cardLast4,
  });

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function updateAccount(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  const name = str(formData, 'name');
  const type = str(formData, 'type') as AccountType;
  const branchName = str(formData, 'branch_name') || null;
  const openingBalance = num(formData, 'opening_balance');

  if (!id) fail('/accounts', 'Account not found.');
  if (!name) fail('/accounts', 'Account name is required.');
  if (!ACCOUNT_TYPES.includes(type)) fail('/accounts', 'Pick a valid account type.');

  const card = type === 'credit' ? readCardDetails(formData, name) : null;
  if (card) validateCard(card);

  const accountNumber = card ? maskedCardNumber(card.cardLast4) : str(formData, 'account_number') || null;
  const bank = readBankDetails(formData, type);

  const [existing] = await db
    .select({ closedAt: accounts.closedAt, openingBalance: accounts.openingBalance })
    .from(accounts)
    .where(eq(accounts.id, id))
    .limit(1);
  if (!existing) fail('/accounts', 'Account not found.');
  // A closed account sits at zero; changing its opening balance would give it
  // a hidden balance that no total shows.
  if (existing.closedAt && existing.openingBalance !== openingBalance) {
    fail('/accounts', `${name} is closed. Reopen it to change its opening balance.`);
  }

  await db.transaction(async (tx) => {
    await tx.update(accounts).set({ name, type, accountNumber, branchName, openingBalance, ...bank }).where(eq(accounts.id, id));

    const [existingCard] = await tx.select().from(creditCards).where(eq(creditCards.accountId, id)).limit(1);
    if (card && existingCard) {
      await tx.update(creditCards).set(card).where(eq(creditCards.accountId, id));
    } else if (card) {
      await tx.insert(creditCards).values({ accountId: id, ...card });
    } else if (existingCard) {
      // Switched away from credit: the card profile would otherwise keep
      // reporting a limit and utilisation for an account that is no longer one.
      await tx.delete(creditCards).where(eq(creditCards.accountId, id));
    }
  });

  await sendNotification('account.update', {
    name, type, opening_balance: openingBalance,
    credit_limit: card?.creditLimit, card_last4: card?.cardLast4,
  });

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function deleteAccount(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/accounts', 'Account not found.');

  const [ic, ex, tr, ln] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(incomes).where(eq(incomes.accountId, id)),
    db.select({ n: sql<number>`count(*)` }).from(expenses).where(eq(expenses.accountId, id)),
    db.select({ n: sql<number>`count(*)` }).from(transfers).where(or(eq(transfers.fromAccountId, id), eq(transfers.toAccountId, id))),
    db.select({ n: sql<number>`count(*)` }).from(loans).where(eq(loans.accountId, id)),
  ]);
  if (Number(ic[0].n) + Number(ex[0].n) + Number(tr[0].n) + Number(ln[0].n) > 0) {
    fail('/accounts', 'This account has entries, so it can’t be deleted. Close it instead: it disappears everywhere and its history is kept.');
  }

  const name = await getAccountName(id);
  // Drop the card profile alongside the account, or it lingers pointing at an
  // account id that no longer exists.
  await db.transaction(async (tx) => {
    await tx.delete(creditCards).where(eq(creditCards.accountId, id));
    await tx.delete(accounts).where(eq(accounts.id, id));
  });
  await sendNotification('account.delete', { name });

  revalidatePath('/accounts');
  redirect('/accounts');
}

// Closing hides an account from every list, dropdown and total while keeping
// its history. Only an account at zero can close: hiding one that still holds
// money (or owes it, for a card) would quietly change every total.
export async function closeAccount(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/accounts', 'Account not found.');

  const { all } = await ledgerSnapshot();
  const acc = all.find((a) => a.id === id);
  if (!acc) fail('/accounts', 'Account not found.');
  if (acc.closedAt) redirect('/accounts');
  if (Math.abs(acc.currentBalance) >= 0.005) {
    fail('/accounts', `${acc.name} still shows ${moneyWithSymbol(acc.currentBalance)}. Move or settle it to ${currencySymbol()}0 first, then close it.`);
  }

  const [activeLoan] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.accountId, id), eq(loans.status, 'active')))
    .limit(1);
  if (activeLoan) fail('/accounts', `${acc.name} still has an open loan. Close or move the loan first.`);

  await db.update(accounts).set({ closedAt: sql`(datetime('now'))` }).where(eq(accounts.id, id));
  await sendNotification('account.close', { name: acc.name });

  revalidatePath('/', 'layout');
  redirect('/accounts');
}

export async function reopenAccount(formData: FormData) {
  await requireAuth();
  const id = int(formData, 'id');
  if (!id) fail('/accounts', 'Account not found.');

  await db.update(accounts).set({ closedAt: null }).where(eq(accounts.id, id));
  await sendNotification('account.reopen', { name: await getAccountName(id) });

  revalidatePath('/', 'layout');
  redirect('/accounts');
}

export async function addTransfer(formData: FormData) {
  await requireAuth();
  const fromAccountId = int(formData, 'from_account_id');
  const toAccountId = int(formData, 'to_account_id');
  const amount = num(formData, 'amount');
  const charge = num(formData, 'charge');
  const txnDate = date(formData, 'txn_date');
  const note = str(formData, 'note');

  if (!fromAccountId || !toAccountId) fail('/accounts', 'Pick both a source and a destination account.');
  if (fromAccountId === toAccountId) fail('/accounts', 'Source and destination must be different accounts.');
  if (amount <= 0) fail('/accounts', 'Transfer amount must be greater than zero.');
  if (charge < 0) fail('/accounts', 'Transfer charge cannot be negative.');
  if (!txnDate) fail('/accounts', 'Transfer date is required.');
  await assertAccountOpen(fromAccountId, '/accounts');
  await assertAccountOpen(toAccountId, '/accounts');

  const { accs: balances, cards } = await ledgerSnapshot();
  const cardByAccountId = new Map(cards.map((c) => [c.accountId, c]));
  const from = balances.find((a) => a.id === fromAccountId);
  if (!from) fail('/accounts', 'Source account not found.');
  if (!balances.some((a) => a.id === toAccountId)) fail('/accounts', 'Destination account not found.');

  const total = amount + charge;
  const fromCard = cardByAccountId.get(fromAccountId);
  if (fromCard) {
    // A credit card always sits at a negative balance — that IS the money owed.
    // What limits spending on it is the available credit, never a positive
    // balance, so the cash check below would reject every card transfer.
    if (total > fromCard.availableLimit + 0.001) {
      fail('/accounts', `Transfer exceeds available credit on ${from.name} (${moneyWithSymbol(fromCard.availableLimit)} available).`);
    }
  } else if (from.currentBalance + 0.001 < total) {
    fail('/accounts', `Insufficient balance in ${from.name} (${moneyWithSymbol(from.currentBalance)} available).`);
  }

  await db.insert(transfers).values({ fromAccountId, toAccountId, amount, charge, txnDate, note: note || null });

  const [fromName, toName] = await Promise.all([getAccountName(fromAccountId), getAccountName(toAccountId)]);
  await sendNotification('account.transfer', {
    from_account: fromName, to_account: toName, amount, charge: charge || undefined, txn_date: txnDate, note: note || undefined,
  });

  revalidatePath('/accounts');
  redirect('/accounts');
}
