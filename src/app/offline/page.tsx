// Pre-cached by the service worker and shown for any page that has never been
// opened on this device while there is no connection.
export const dynamic = 'force-static';
export const metadata = { title: 'Offline' };

export default function OfflinePage() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-brand px-4">
      <section className="leaf leaf-margin max-w-sm p-6">
        <p className="display mb-3 text-3xl font-bold text-brand">Hisab</p>
        <h1 className="display mb-2 text-xl">You’re offline</h1>
        <p className="mb-5 text-muted">
          This page hasn’t been opened on this device yet, so there’s no saved copy. Pages you’ve already visited still open without a connection.
        </p>
        {/* A full page load on purpose: the service worker serves this page when
            there is no connection, and a client-side route change would not retry. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="btn-primary">Open overview</a>
      </section>
    </main>
  );
}
