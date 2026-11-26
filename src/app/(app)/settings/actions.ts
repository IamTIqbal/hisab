'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq, and, ne, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';
import { requireAuth } from '@/lib/auth';
import { sendNotification, sendEmailChangeCode, smtpConfigured } from '@/lib/email';
import { generateOtp, saveOtp, verifyOtp } from '@/lib/otp';
import { countRecent, recordFailure } from '@/lib/rateLimit';
import { isValidCurrencySymbol, isValidTimezone, savePrefs, type Grouping } from '@/lib/prefs';
import { validEmail, validPassword } from '@/lib/validate';
import { str, fail } from '@/lib/form';

const PATH = '/settings';

function done(what: string): never {
  revalidatePath('/', 'layout');
  redirect(`${PATH}?success=${encodeURIComponent(what)}`);
}

async function checkPassword(hash: string, formData: FormData) {
  const ok = await bcrypt.compare(String(formData.get('current_password') ?? ''), hash);
  if (!ok) fail(PATH, 'Current password is incorrect.');
}

export async function updateProfile(formData: FormData) {
  const { user } = await requireAuth();
  const name = str(formData, 'name');
  if (!name || name.length > 80) fail(PATH, 'Enter your name (up to 80 characters).');
  await db.update(users).set({ name }).where(eq(users.id, user.id));
  await sendNotification('settings.profile', { name });
  done('Name saved.');
}

async function emailTaken(email: string, ownId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(ne(users.id, ownId), sql`(lower(${users.email}) = ${email} OR lower(${users.username}) = ${email})`))
    .limit(1);
  return !!row;
}

async function applyEmail(userId: number, oldEmail: string | null, email: string) {
  // The username follows the email so either one keeps working at sign-in.
  await db.update(users).set({ email, username: email }).where(eq(users.id, userId));
  // Sent to the new address; the old one is shown in the notice.
  await sendNotification('settings.email', { old_email: oldEmail ?? '', new_email: email });
}

// Step 1. With email set up, a code goes to the new address and nothing
// changes until it is entered. Without email there is nothing to verify with,
// so the change applies at once (the current password is still required).
export async function requestEmailChange(formData: FormData) {
  const { user } = await requireAuth();
  await checkPassword(user.passwordHash, formData);

  const email = str(formData, 'email').toLowerCase();
  if (!validEmail(email)) fail(PATH, 'Enter a valid email address.');
  if (email === (user.email ?? '').toLowerCase()) fail(PATH, 'That is already your email.');
  if (await emailTaken(email, user.id)) fail(PATH, 'That email is already in use.');

  if (!smtpConfigured()) {
    await applyEmail(user.id, user.email, email);
    done('Email changed.');
  }

  if ((await countRecent('auth.email_code_sent', 15)) >= 5) fail(PATH, 'Too many codes sent. Wait 15 minutes.');
  const code = generateOtp();
  try {
    await saveOtp(code, 'email', email);
    await sendEmailChangeCode(code, email);
    await recordFailure('auth.email_code_sent'); // counts sends
  } catch (err) {
    console.error('[requestEmailChange]', err);
    fail(PATH, 'Could not send the confirmation email. Check the SMTP settings.');
  }
  redirect(`${PATH}?verify=${encodeURIComponent(email)}`);
}

// Step 2: the code from the new inbox.
export async function confirmEmailChange(formData: FormData) {
  const { user } = await requireAuth();
  const result = await verifyOtp(str(formData, 'code'), 'email');
  if (!result || !result.target) fail(PATH, 'That code is wrong or has expired. Request a new one.');
  if (await emailTaken(result.target, user.id)) fail(PATH, 'That email is already in use.');
  await applyEmail(user.id, user.email, result.target);
  done('Email changed.');
}

export async function changePassword(formData: FormData) {
  const { user } = await requireAuth();
  const newPassword = String(formData.get('new_password') ?? '');
  const confirmPassword = String(formData.get('confirm_password') ?? '');

  const pwError = validPassword(newPassword);
  if (pwError) fail(PATH, pwError);
  if (newPassword !== confirmPassword) fail(PATH, 'The new passwords do not match.');
  await checkPassword(user.passwordHash, formData);

  await db.update(users).set({ passwordHash: await bcrypt.hash(newPassword, 12) }).where(eq(users.id, user.id));

  // A password change is the notice that most needs to reach the owner if
  // somebody else made it.
  await sendNotification('settings.password', {
    changed_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  });
  done('Password changed.');
}

export async function updatePreferences(formData: FormData) {
  await requireAuth();
  const currencySymbol = str(formData, 'currency_symbol');
  const grouping = str(formData, 'grouping') as Grouping;
  const timezone = str(formData, 'timezone');

  if (!isValidCurrencySymbol(currencySymbol)) {
    fail(PATH, 'Currency symbol: 1 to 4 characters, no spaces, quotes or brackets.');
  }
  if (grouping !== 'south-asian' && grouping !== 'international') fail(PATH, 'Pick a number grouping.');
  if (!isValidTimezone(timezone)) fail(PATH, 'Pick a time zone from the list.');

  await savePrefs({ currencySymbol, grouping, timezone });
  await sendNotification('settings.prefs', { currency: currencySymbol, grouping, timezone });
  done('Preferences saved.');
}
