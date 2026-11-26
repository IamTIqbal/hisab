'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  return (
    <section className="leaf empty mt-6">
      <h1 className="display mb-2 text-xl text-ink">{offline ? 'No connection' : 'This page didn’t load'}</h1>
      <p>
        {offline
          ? 'You’re offline and this page hasn’t been saved on this device yet. Connect and try again.'
          : 'The server or database didn’t respond. Your records are unchanged. Try again in a moment.'}
      </p>
      <button type="button" onClick={reset} className="btn-primary">Try again</button>
      {error.digest && <p className="mt-4 text-xs">Reference: {error.digest}</p>}
    </section>
  );
}
