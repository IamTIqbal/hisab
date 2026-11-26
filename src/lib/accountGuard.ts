import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { accounts } from './db/schema';
import { fail } from './form';

// A closed account takes no new money. Editing an old entry that is already
// filed under it is still allowed (`unchangedId` is that entry's account), so
// closing never makes its history uneditable.
export async function assertAccountOpen(accountId: number, path: string, unchangedId?: number) {
  if (!accountId || accountId === unchangedId) return;
  const [row] = await db
    .select({ name: accounts.name, closedAt: accounts.closedAt })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!row) fail(path, 'Account not found.');
  if (row.closedAt) fail(path, `${row.name} is closed. Reopen it on Accounts to use it again.`);
}
