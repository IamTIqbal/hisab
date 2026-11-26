import { requireAuth } from '@/lib/auth';
import { currentMonth, monthLabel } from '@/lib/money';
import { PageHeader } from '@/components/Ledger';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Export' };

export default async function ExportsPage() {
  await requireAuth();
  const month = currentMonth();

  const files = [
    { href: `/api/export/expenses?month=${month}`, title: 'Expenses', sub: monthLabel(month) },
    { href: '/api/export/expenses', title: 'Expenses', sub: 'Everything recorded' },
    { href: `/api/export/income?month=${month}`, title: 'Income', sub: monthLabel(month) },
    { href: '/api/export/income', title: 'Income', sub: 'Everything recorded' },
    { href: '/api/export/transfers', title: 'Transfers', sub: 'Everything recorded' },
    { href: '/api/export/loans', title: 'Loans', sub: 'Open and settled' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Export" />
      <p className="max-w-prose text-muted">CSV files open in Excel or Google Sheets. Bengali text and currency signs are kept intact.</p>
      <section className="leaf overflow-hidden">
        <ul className="ledger">
          {files.map((f) => (
            <li key={f.href}>
              <a href={f.href} download className="row text-ink no-underline hover:bg-[#F6F8FB]">
                <div className="row-main">
                  <p className="row-title">{f.title}</p>
                  <p className="row-sub">{f.sub}</p>
                </div>
                <span className="btn-secondary btn-sm pointer-events-none">Download</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
