import { requireAuth } from '@/lib/auth';
import { prefs } from '@/lib/prefs';
import { money } from '@/lib/money';
import { smtpConfigured } from '@/lib/email';
import { FormError, Notice } from '@/components/FormError';
import { SubmitButton } from '@/components/SubmitButton';
import { PageHeader } from '@/components/Ledger';
import {
  updateProfile,
  requestEmailChange,
  confirmEmailChange,
  changePassword,
  updatePreferences,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const CURRENCY_SUGGESTIONS = ['৳', '₹', '$', '€', '£', '¥', 'Rs', '₨', 'RM', 'AED', '₦', 'KSh'];

function timezones(): string[] {
  try {
    // The runtime's list leaves out plain "UTC"; offer it first.
    return ['UTC', ...Intl.supportedValuesOf('timeZone').filter((z) => z !== 'UTC')];
  } catch {
    return ['UTC', 'Asia/Dhaka', 'Asia/Kolkata', 'Europe/London', 'America/New_York'];
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string; verify?: string }>;
}) {
  const { user } = await requireAuth();
  const sp = await searchParams;
  const p = prefs();
  const emailOn = smtpConfigured();
  const zones = timezones();
  if (!zones.includes(p.timezone)) zones.unshift(p.timezone);

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" />

      <FormError message={sp.error} />
      {sp.success && <Notice>{sp.success}</Notice>}

      <section className="leaf" aria-labelledby="profile-h">
        <div className="leaf-head"><h2 id="profile-h">Your name</h2></div>
        <form action={updateProfile} className="grid max-w-sm gap-4 p-4" data-online-only>
          <label className="field">
            <span>Name</span>
            <input name="name" type="text" className="input" defaultValue={user.name ?? ''} maxLength={80} autoComplete="name" required />
          </label>
          <SubmitButton className="btn-primary w-fit">Save name</SubmitButton>
        </form>
      </section>

      <section className="leaf" aria-labelledby="email-h">
        <div className="leaf-head"><h2 id="email-h">Email</h2></div>
        <div className="space-y-4 p-4">
          <p>
            You sign in with <strong className="font-semibold">{user.email ?? user.username}</strong>.{' '}
            {emailOn
              ? 'Sign-in codes and change notices go to this address.'
              : 'Email is not set up on this server, so no codes or notices are sent.'}
          </p>

          {sp.verify ? (
            <form action={confirmEmailChange} className="grid max-w-sm gap-4" data-online-only>
              <p className="text-sm text-muted">We sent a 6-digit code to <strong>{sp.verify}</strong>. Enter it to switch to that address.</p>
              <label className="field">
                <span>Code</span>
                <input name="code" type="text" className="input num" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required autoFocus />
              </label>
              <SubmitButton className="btn-primary w-fit">Confirm new email</SubmitButton>
            </form>
          ) : (
            <form action={requestEmailChange} className="grid max-w-sm gap-4" data-online-only>
              <label className="field">
                <span>New email</span>
                <input name="email" type="email" className="input" autoComplete="email" required />
                {emailOn && <span className="hint">We’ll send a code to the new address first.</span>}
              </label>
              <label className="field">
                <span>Current password</span>
                <input name="current_password" type="password" className="input" autoComplete="current-password" required />
              </label>
              <SubmitButton className="btn-primary w-fit">Change email</SubmitButton>
            </form>
          )}
        </div>
      </section>

      <section className="leaf" aria-labelledby="pw-h">
        <div className="leaf-head"><h2 id="pw-h">Change password</h2></div>
        <form action={changePassword} className="grid max-w-sm gap-4 p-4" data-online-only>
          <label className="field">
            <span>Current password</span>
            <input name="current_password" type="password" className="input" autoComplete="current-password" required />
          </label>
          <label className="field">
            <span>New password</span>
            <input name="new_password" type="password" className="input" minLength={8} maxLength={128} autoComplete="new-password" required />
            <span className="hint">At least 8 characters.</span>
          </label>
          <label className="field">
            <span>Repeat new password</span>
            <input name="confirm_password" type="password" className="input" autoComplete="new-password" required />
          </label>
          <SubmitButton className="btn-primary w-fit">Change password</SubmitButton>
        </form>
      </section>

      <section className="leaf" aria-labelledby="prefs-h">
        <div className="leaf-head"><h2 id="prefs-h">Money and dates</h2></div>
        <form action={updatePreferences} className="grid max-w-sm gap-4 p-4" data-online-only>
          <label className="field">
            <span>Currency symbol</span>
            <input name="currency_symbol" type="text" className="input" defaultValue={p.currencySymbol} maxLength={4} list="currency-list" required />
            <datalist id="currency-list">
              {CURRENCY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
            <span className="hint">Shown before every amount. Up to 4 characters.</span>
          </label>
          <label className="field">
            <span>Number grouping</span>
            <select name="grouping" className="input" defaultValue={p.grouping}>
              <option value="south-asian">South Asian: 1,00,000.00</option>
              <option value="international">International: 100,000.00</option>
            </select>
            <span className="hint">Now showing: {p.currencySymbol}{money(1234567.5)}</span>
          </label>
          <label className="field">
            <span>Time zone</span>
            <select name="timezone" className="input" defaultValue={p.timezone}>
              {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
            </select>
            <span className="hint">Decides what “today” and “this month” mean.</span>
          </label>
          <SubmitButton className="btn-primary w-fit">Save preferences</SubmitButton>
        </form>
      </section>

      <form action="/api/logout" method="post">
        <button type="submit" className="btn-secondary w-full sm:w-auto">Sign out</button>
      </form>
    </div>
  );
}
