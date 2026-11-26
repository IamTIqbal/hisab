import Link from 'next/link';
import Image from 'next/image';
import { accountIconMeta, money, currencySymbol, monthLabel, shiftMonth, currentMonth } from '@/lib/money';
import { IconChevron } from './Icons';

// ৳1,23,456.50 (in the owner's currency and grouping) with the fraction set smaller, the way figures sit in a ledger.
export function Amount({ value, tone, sign = false, className = '' }: { value: number; tone?: 'debit' | 'credit'; sign?: boolean; className?: string }) {
  const formatted = money(Math.abs(value));
  const [whole, paisa] = formatted.split('.');
  const prefix = value < 0 ? '−' : sign && value > 0 ? '+' : '';
  const toneClass = tone === 'debit' ? 'text-debit' : tone === 'credit' ? 'text-credit' : '';
  return (
    <span className={`num ${toneClass} ${className}`}>
      {prefix}{currencySymbol()}{whole}
      <span style={{ fontSize: '0.68em', opacity: paisa === '00' ? 0.5 : 0.85 }}>.{paisa}</span>
    </span>
  );
}

export function AccountMark({ name, type, size = 40 }: { name: string; type: string; size?: number }) {
  const icon = accountIconMeta(name, type);
  return (
    <span className={`mark ${icon.bg ?? ''}`} style={{ width: size, height: size }} aria-hidden>
      {icon.kind === 'image' ? <Image src={icon.src!} alt="" width={size} height={size} unoptimized={icon.src!.endsWith('.svg')} /> : icon.symbol}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h1 className="display page-title">{title}</h1>
      {children}
    </header>
  );
}

// ‹ November 2026 › — prev/next month links, with the rest of the query kept.
export function MonthStepper({ month, basePath, params = {} }: { month: string; basePath: string; params?: Record<string, string> }) {
  const href = (m: string) => {
    const q = new URLSearchParams({ ...params, month: m });
    return `${basePath}?${q.toString()}`;
  };
  const next = shiftMonth(month, 1);
  const isLatest = next > currentMonth();
  return (
    <div className="month-step">
      <Link href={href(shiftMonth(month, -1))} aria-label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`}>
        <IconChevron dir="left" className="w-5 h-5" />
      </Link>
      <span className="display text-[1.05rem] min-w-[9.5rem] text-center">{monthLabel(month)}</span>
      <Link
        href={href(next)}
        aria-label={`Next month, ${monthLabel(next)}`}
        aria-disabled={isLatest || undefined}
        tabIndex={isLatest ? -1 : undefined}
      >
        <IconChevron className="w-5 h-5" />
      </Link>
    </div>
  );
}

// The add/edit form, folded away under a "New …" line until it is needed.
// Forms inside must carry key={editing id}: a tap on Edit is a client-side
// navigation that reuses the DOM, and <select defaultValue> only applies on
// mount — without the key the edit form kept the add form's account and
// category, and saving silently changed them.
//
// Edit links inside a row's <details> are plain <a>, not <Link>: tapped
// right after the row expands, the client router fetched the edit page and
// then never showed it (about 1 in 6 taps). A full page load always lands.
export function EntrySheet({ title, open, id = 'entry', children }: { title: string; open?: boolean; id?: string; children: React.ReactNode }) {
  return (
    <details className="entry" id={id} open={open}>
      <summary>
        <span className="entry-plus" aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </span>
        {title}
      </summary>
      <div className="entry-body">{children}</div>
    </details>
  );
}
