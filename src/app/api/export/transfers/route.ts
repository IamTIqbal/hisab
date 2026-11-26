import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { transfers, accounts } from '@/lib/db/schema';
import { sessionUser } from '@/lib/auth';
import { csvRow, csvResponseBody } from '@/lib/csv';

export async function GET() {
  if (!(await sessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.select().from(transfers).orderBy(transfers.txnDate, transfers.id);

  const allAccounts = await db.select({ id: accounts.id, name: accounts.name }).from(accounts);
  const accMap = Object.fromEntries(allAccounts.map((a) => [a.id, a.name]));

  const lines = ['Date,From,To,Amount,Charge,Note', ...rows.map((t) =>
    csvRow([
      t.txnDate,
      accMap[t.fromAccountId] ?? String(t.fromAccountId),
      accMap[t.toAccountId] ?? String(t.toAccountId),
      t.amount, t.charge, t.note,
    ])
  )];

  return new NextResponse(csvResponseBody(lines), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="hisab-transfers.csv"',
    },
  });
}
