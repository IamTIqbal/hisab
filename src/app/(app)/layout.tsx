import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { TopNav, BottomNav } from '@/components/Nav';
import { currencySymbol } from '@/lib/money';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  // The amount fields and figures draw the currency sign from CSS. The symbol
  // is validated on save (no quotes, backslashes or brackets), and
  // JSON.stringify yields a quoted string CSS accepts as-is.
  const currencyCss = `:root{--currency:${JSON.stringify(currencySymbol())}}`;

  return (
    <>
      <style>{currencyCss}</style>
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[60] rounded-lg bg-leaf px-4 py-2 text-ink">
        Skip to content
      </a>
      <header className="app-header">
        <div className="mx-auto flex h-14 max-w-[64rem] items-center justify-between gap-4 px-4 md:h-16 md:px-6">
          <Link href="/" className="wordmark" aria-label="Hisab, overview">
            <span className="wordmark-name">Hisab</span>
          </Link>
          <TopNav />
          <Link
            href="/settings"
           
            className="hidden md:inline-flex h-10 items-center rounded-full px-3 text-white/80 hover:bg-white/10 hover:text-white"
          >
            Settings
          </Link>
        </div>
      </header>

      <main id="main" className="page">
        {children}
      </main>

      <BottomNav />
    </>
  );
}
