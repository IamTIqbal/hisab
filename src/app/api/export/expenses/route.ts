import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { expenses, accounts } from '@/lib/db/schema';
import { eq, isNull, sql, and } from 'drizzle-orm';
import { sessionUser } from '@/lib/auth';
import { csvRow, csvResponseBody } from '@/lib/csv';
import { isValidMonth } from '@/lib/money';

export async function GET(req: NextRequest) {
  if (!(await sessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only YYYY-MM: it goes into the SQL filter and the download's file name.
  const raw = req.nextUrl.searchParams.get('month') ?? undefined;
  const month = isValidMonth(raw) ? raw : null;
  const conditions = [isNull(expenses.loanId), ...(month ? [sql`strftime('%Y-%m', ${expenses.txnDate}) = ${month}`] : [])];

  const rows = await db
    .select({ expense: expenses, accountName: accounts.name })
    .from(expenses)
    .innerJoin(accounts, eq(accounts.id, expenses.accountId))
    .where(and(...conditions))
    .orderBy(expenses.txnDate, expenses.id);

  const lines = ['Date,Category,Account,Amount,Note', ...rows.map(({ expense: e, accountName }) =>
    csvRow([e.txnDate, e.category, accountName, e.amount, e.note])
  )];

  return new NextResponse(csvResponseBody(lines), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="hisab-expenses${month ? `-${month}` : ''}.csv"`,
    },
  });
}
