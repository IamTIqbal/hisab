'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { generateOtp, saveOtp, verifyOtp } from '@/lib/otp';
import { sendOtpEmail, smtpConfigured } from '@/lib/email';
import { findOwnerByLogin, getOwner } from '@/lib/owner';
import { signIn } from '@/lib/auth';
import { recordFailure, clearFailures, tooManyFailures, countRecent } from '@/lib/rateLimit';
import { str } from '@/lib/form';

const PASSWORD_EVENT = 'auth.password_failed';
const MAX_PASSWORD_FAILURES = 5;
const CODE_SENT_EVENT = 'auth.otp_sent';
const MAX_CODES_SENT = 5;
const WINDOW_MINUTES = 15;

// Compared against when no user matches, so a wrong email takes as long to
// reject as a wrong password and the form does not reveal which was wrong.
const DUMMY_HASH = '$2a$12$nJK7hfSU2cmC9ivbwmiRsuh2YMtIGxcpjOs8IMmdBV0JQVQgd1gzq';

type Result = { error: string } | undefined;

export async function passwordSignInAction(formData: FormData): Promise<Result> {
  if (await tooManyFailures(PASSWORD_EVENT, MAX_PASSWORD_FAILURES, WINDOW_MINUTES)) {
    return { error: `Too many wrong attempts. Wait ${WINDOW_MINUTES} minutes and try again.` };
  }

  const login = str(formData, 'login');
  const password = String(formData.get('password') ?? '');
  const user = await findOwnerByLogin(login);
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok) {
    await recordFailure(PASSWORD_EVENT);
    return { error: 'That email and password do not match.' };
  }

  await clearFailures(PASSWORD_EVENT);
  await signIn(user);
  redirect('/');
}

export async function requestOtpAction(): Promise<{ success: true } | { error: string }> {
  if (!smtpConfigured()) return { error: 'Email sign-in is not set up on this server. Use your password.' };

  const owner = await getOwner();
  if (!owner?.email) return { error: 'No email address is saved for this account. Use your password.' };

  if ((await countRecent(CODE_SENT_EVENT, WINDOW_MINUTES)) >= MAX_CODES_SENT) {
    return { error: `Too many codes sent. Wait ${WINDOW_MINUTES} minutes, or use your password.` };
  }

  const code = generateOtp();
  try {
    await saveOtp(code, 'login');
    await sendOtpEmail(code, owner.email);
    await recordFailure(CODE_SENT_EVENT); // counts sends, not failures
    return { success: true };
  } catch (err) {
    console.error('[requestOtp]', err);
    return { error: 'Could not send the email. Check the SMTP settings, or use your password.' };
  }
}

export async function verifyOtpAction(formData: FormData): Promise<Result> {
  const valid = await verifyOtp(str(formData, 'otp'), 'login');
  if (!valid) return { error: 'Invalid or expired code. Request a new one.' };

  const owner = await getOwner();
  if (!owner) return { error: 'No account is set up on this server yet.' };

  await signIn(owner);
  redirect('/');
}
