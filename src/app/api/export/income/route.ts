import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { incomes, accounts } from '@/lib/db/schema';
import { eq, isNull, sql, and } from 'drizzle-orm';
import { sessionUser } from '@/lib/auth';
import { csvRow, csvResponseBody } from '@/lib/csv';
import { isValidMonth } from '@/lib/money';

export async function GET(req: NextRequest) {
  if (!(await sessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Only YYYY-MM: it goes into the SQL filter and the download's file name.
  const raw = req.nextUrl.searchParams.get('month') ?? undefined;
  const month = isValidMonth(raw) ? raw : null;

  const conditions = [isNull(incomes.loanId), ...(month ? [sql`strftime('%Y-%m', ${incomes.txnDate}) = ${month}`] : [])];

  const rows = await db
    .select({ income: incomes, accountName: accounts.name })
    .from(incomes)
    .innerJoin(accounts, eq(accounts.id, incomes.accountId))
    .where(and(...conditions))
    .orderBy(incomes.txnDate, incomes.id);

  const lines = ['Date,Source,Account,Amount,Note', ...rows.map(({ income: i, accountName }) =>
    csvRow([i.txnDate, i.source, accountName, i.amount, i.note])
  )];

  return new NextResponse(csvResponseBody(lines), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="hisab-income${month ? `-${month}` : ''}.csv"`,
    },
  });
}
