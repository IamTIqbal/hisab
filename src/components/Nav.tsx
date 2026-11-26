'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconHome, IconOut, IconIn, IconPlus, IconMore } from './Icons';

const TOP_LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/expenses', label: 'Expenses' },
  { href: '/income', label: 'Income' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/loans', label: 'Loans' },
  { href: '/reports', label: 'Reports' },
];

// Pages reached from "More" on a phone keep "More" lit.
const MORE_PATHS = ['/accounts', '/loans', '/reports', '/exports', '/settings', '/more'];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="top-nav hidden md:flex gap-1">
      {TOP_LINKS.map(({ href, label }) => (
        <Link key={href} href={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const onMore = MORE_PATHS.some((p) => isActive(pathname, p));
  const item = (href: string, label: string, Icon: typeof IconHome, active: boolean) => (
    <li>
      <Link href={href} aria-current={active ? 'page' : undefined}>
        <span className="nav-ico"><Icon /></span>
        <span>{label}</span>
      </Link>
    </li>
  );

  return (
    <nav aria-label="Main" className="bottom-nav">
      <ul>
        {item('/', 'Home', IconHome, pathname === '/')}
        {item('/expenses', 'Spent', IconOut, isActive(pathname, '/expenses'))}
        <li>
          <Link href="/expenses?add=1" className="nav-add" aria-label="Add an expense">
            <span className="nav-add-disc"><IconPlus className="w-6 h-6" /></span>
          </Link>
        </li>
        {item('/income', 'Earned', IconIn, isActive(pathname, '/income'))}
        {item('/more', 'More', IconMore, onMore)}
      </ul>
    </nav>
  );
}
