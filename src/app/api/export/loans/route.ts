import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { loans } from '@/lib/db/schema';
import { sessionUser } from '@/lib/auth';
import { csvRow, csvResponseBody } from '@/lib/csv';

export async function GET() {
  if (!(await sessionUser())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db.select().from(loans).orderBy(loans.txnDate, loans.id);

  const lines = ['Date,Type,Provider,Amount,Balance,Status,DueDate,Note', ...rows.map((l) =>
    csvRow([l.txnDate, l.type, l.provider, l.amount, l.balance, l.status, l.dueDate, l.note])
  )];

  return new NextResponse(csvResponseBody(lines), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="hisab-loans.csv"',
    },
  });
}
