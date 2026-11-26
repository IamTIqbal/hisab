'use client';

import { useEffect, useState } from 'react';

// Registers the offline service worker and shows a quiet bar while the device
// has no connection. Pages already visited stay readable offline; saving
// needs the server, so forms marked data-online-only are dimmed meanwhile.
export function ServiceWorker() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    const sync = () => {
      const isOff = !navigator.onLine;
      setOffline(isOff);
      document.documentElement.classList.toggle('is-offline', isOff);
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-bar" role="status">
      You’re offline. Showing saved pages. Changes need a connection.
    </div>
  );
}
