import type { Metadata, Viewport } from 'next';
import { Anek_Bangla } from 'next/font/google';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

// Self-hosted at build time by next/font, so the typeface is served from our
// own origin and is cached for offline use with the rest of the app shell.
const anek = Anek_Bangla({
  subsets: ['latin', 'bengali'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-anek',
});

export const metadata: Metadata = {
  title: { default: 'Hisab', template: '%s · Hisab' },
  description: 'Your personal ledger for income, expenses, accounts and loans.',
  manifest: '/manifest.json',
  applicationName: 'Hisab',
  appleWebApp: { capable: true, title: 'Hisab', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: '/icons/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1F3A5F',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={anek.variable}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
