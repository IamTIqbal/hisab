'use client';

import { useState, useTransition } from 'react';
import { passwordSignInAction, requestOtpAction, verifyOtpAction } from './actions';

const ERROR_MESSAGES: Record<string, string> = {
  expired: 'That sign-in link has expired or was already used. Send a new code.',
  missing: 'That sign-in link is incomplete. Send a new code.',
  nouser: 'No account is set up on this server yet.',
};

type Step = 'password' | 'request' | 'verify';

export function LoginForm({ emailEnabled, errorParam, signedOut }: { emailEnabled: boolean; errorParam: string; signedOut: boolean }) {
  const initialError = ERROR_MESSAGES[errorParam] ?? (errorParam ? 'Sign-in failed. Try again.' : '');
  const [step, setStep] = useState<Step>('password');
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<{ error?: string } | { success: true } | undefined>, onOk?: () => void) {
    setError('');
    startTransition(async () => {
      const result = await action();
      if (result && 'error' in result && result.error) setError(result.error);
      else onOk?.();
    });
  }

  function submit(e: React.FormEvent<HTMLFormElement>, action: (fd: FormData) => Promise<{ error: string } | undefined>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    run(() => action(fd));
  }

  return (
    <div className="space-y-5">
      {error && <div role="alert" className="notice notice-error">{error}</div>}
      {!error && signedOut && <div role="status" className="notice notice-ok">You’re signed out.</div>}

      {step === 'password' && (
        <form onSubmit={(e) => submit(e, passwordSignInAction)} className="space-y-5">
          <label className="field">
            <span>Email</span>
            <input name="login" type="text" className="input" autoComplete="username" inputMode="email" required autoFocus />
          </label>
          <label className="field">
            <span>Password</span>
            <input name="password" type="password" className="input" autoComplete="current-password" required />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={isPending}>
            {isPending ? 'Signing in…' : 'Sign in'}
          </button>
          {emailEnabled && (
            <button type="button" className="btn-quiet w-full" onClick={() => { setStep('request'); setError(''); }}>
              Email me a code instead
            </button>
          )}
        </form>
      )}

      {step === 'request' && (
        <div className="space-y-5">
          <p className="text-ink-soft">We’ll email you a 6-digit code and a one-tap sign-in link.</p>
          <button onClick={() => run(requestOtpAction, () => setStep('verify'))} disabled={isPending} className="btn-primary w-full">
            {isPending ? 'Sending…' : 'Email me a code'}
          </button>
          <button type="button" className="btn-quiet w-full" onClick={() => { setStep('password'); setError(''); }}>
            Use my password
          </button>
        </div>
      )}

      {step === 'verify' && (
        <form onSubmit={(e) => submit(e, verifyOtpAction)} className="space-y-5">
          <p className="text-ink-soft">Code sent. Enter it below, or tap the link in the email.</p>
          <label className="field">
            <span>6-digit code</span>
            <input
              name="otp"
              type="text"
              className="input num text-center text-[2rem] font-semibold tracking-[0.35em]"
              placeholder="••••••"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              autoFocus
            />
          </label>
          <button type="submit" className="btn-primary w-full" disabled={isPending}>
            {isPending ? 'Checking…' : 'Sign in'}
          </button>
          <button type="button" onClick={() => { setStep('request'); setError(''); }} className="btn-quiet w-full">
            Send a new code
          </button>
        </form>
      )}
    </div>
  );
}
