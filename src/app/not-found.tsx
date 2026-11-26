import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-paper px-4">
      <section className="leaf leaf-margin max-w-sm p-6">
        <h1 className="display mb-2 text-xl">No such page</h1>
        <p className="mb-5 text-muted">This page isn’t in the ledger. It may have moved.</p>
        <Link href="/" className="btn-primary">Go to overview</Link>
      </section>
    </main>
  );
}
