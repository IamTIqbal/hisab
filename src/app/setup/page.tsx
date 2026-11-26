import { notFound } from 'next/navigation';
import { hasOwner } from '@/lib/owner';
import { AuthCover } from '@/components/AuthCover';
import { FormError } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { createOwnerAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up' };

// First run only. Once the owner exists this page is a 404 for good.
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string; token?: string }> }) {
  if (await hasOwner()) notFound();
  const sp = await searchParams;
  const needsToken = !!process.env.SETUP_TOKEN;

  return (
    <AuthCover subtitle="Set up your ledger">
      <form action={createOwnerAction} className="space-y-5">
        <p className="text-ink-soft">Create the one account that can use this Hisab. You can change all of it later in Settings.</p>
        <FormError message={sp.error} />
        {needsToken && (
          <label className="field">
            <span>Setup token</span>
            <input name="setup_token" type="password" className="input" defaultValue={sp.token ?? ''} autoComplete="off" required />
            <span className="hint">The SETUP_TOKEN value from your hosting environment.</span>
          </label>
        )}
        <label className="field">
          <span>Your name</span>
          <input name="name" type="text" className="input" maxLength={80} autoComplete="name" required autoFocus={!needsToken} />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" className="input" autoComplete="email" required />
          <span className="hint">You sign in with this. Sign-in codes and change notices go here if email is set up.</span>
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" className="input" minLength={8} maxLength={128} autoComplete="new-password" required />
          <span className="hint">At least 8 characters.</span>
        </label>
        <label className="field">
          <span>Repeat password</span>
          <input name="confirm_password" type="password" className="input" minLength={8} maxLength={128} autoComplete="new-password" required />
        </label>
        <SubmitButton className="btn-primary w-full" pendingLabel="Creating…">Create my ledger</SubmitButton>
      </form>
    </AuthCover>
  );
}
