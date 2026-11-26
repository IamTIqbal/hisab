import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { PageHeader } from '@/components/Ledger';
import { IconChevron } from '@/components/Icons';

export const metadata = { title: 'More' };

const LINKS = [
  { href: '/accounts', title: 'Accounts', sub: 'Balances, cards, moving money' },
  { href: '/loans', title: 'Loans', sub: 'What you owe and what is owed to you' },
  { href: '/reports', title: 'Reports', sub: 'Month and year at a glance' },
  { href: '/exports', title: 'Export', sub: 'Download your records as CSV' },
  { href: '/settings', title: 'Settings', sub: 'Sign-in email and password' },
];

export default async function MorePage() {
  await requireAuth();
  return (
    <div className="space-y-5">
      <PageHeader title="More" />
      <nav className="leaf overflow-hidden" aria-label="More pages">
        <ul className="ledger">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="row text-ink no-underline hover:bg-[#F6F8FB]">
                <div className="row-main">
                  <p className="row-title">{l.title}</p>
                  <p className="row-sub">{l.sub}</p>
                </div>
                <IconChevron className="h-5 w-5 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action="/api/logout" method="post">
        <button type="submit" className="btn-secondary w-full">Sign out</button>
      </form>
    </div>
  );
}
