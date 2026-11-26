import { redirect } from 'next/navigation';
import { hasOwner } from '@/lib/owner';
import { smtpConfigured } from '@/lib/email';
import { ClearOfflineCache } from '@/components/ClearOfflineCache';
import { AuthCover } from '@/components/AuthCover';
import { LoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; signedout?: string }> }) {
  // A fresh install has nobody to sign in as yet.
  if (!(await hasOwner())) redirect('/setup');
  const sp = await searchParams;

  return (
    <AuthCover subtitle="Your personal ledger">
      <ClearOfflineCache />
      <LoginForm emailEnabled={smtpConfigured()} errorParam={sp.error ?? ''} signedOut={sp.signedout === '1'} />
    </AuthCover>
  );
}
