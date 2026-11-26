'use client';

// Last-resort boundary for errors in the root layout itself. It replaces the
// whole document, so it cannot rely on globals.css.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#1F3A5F', fontFamily: 'system-ui, sans-serif', padding: '1rem' }}>
        <main style={{ background: '#fff', borderRadius: 14, padding: '1.75rem', maxWidth: '22rem', color: '#1D2B44' }}>
          <h1 style={{ margin: '0 0 .5rem', fontSize: '1.25rem' }}>Hisab didn’t start</h1>
          <p style={{ margin: '0 0 1.25rem', color: '#5C6878', lineHeight: 1.5 }}>Something failed while loading the app. Your records are unchanged.</p>
          <button onClick={reset} style={{ minHeight: 48, padding: '0 1.25rem', border: 0, borderRadius: 10, background: '#1D2B44', color: '#fff', fontWeight: 600, fontSize: '1rem' }}>Try again</button>
        </main>
      </body>
    </html>
  );
}
