'use client';

import { useEffect } from 'react';

// Rendered on the sign-in page. Saved copies of ledger pages belong to the
// signed-in session, so they are wiped once that session has ended.
export function ClearOfflineCache() {
  useEffect(() => {
    if ('caches' in window) {
      caches.keys().then((keys) => keys.filter((k) => k.startsWith('hisab-pages')).forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);
  return null;
}
