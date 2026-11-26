'use server';

import crypto from 'crypto';
import { notFound, redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createOwnerIfNone, hasOwner } from '@/lib/owner';
import { signIn } from '@/lib/auth';
import { recordFailure, tooManyFailures } from '@/lib/rateLimit';
import { str, fail } from '@/lib/form';
import { validEmail, validPassword } from '@/lib/validate';

const TOKEN_EVENT = 'auth.setup_token_failed';

function tokenMatches(given: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function createOwnerAction(formData: FormData) {
  if (await hasOwner()) notFound();

  const expected = process.env.SETUP_TOKEN;
  if (expected) {
    if (await tooManyFailures(TOKEN_EVENT, 10, 15)) fail('/setup', 'Too many wrong setup tokens. Wait 15 minutes.');
    if (!tokenMatches(str(formData, 'setup_token'), expected)) {
      await recordFailure(TOKEN_EVENT);
      fail('/setup', 'That setup token is not right. It is the SETUP_TOKEN value in your hosting environment.');
    }
  }

  const name = str(formData, 'name');
  const email = str(formData, 'email').toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');

  if (!name || name.length > 80) fail('/setup', 'Enter your name (up to 80 characters).');
  if (!validEmail(email)) fail('/setup', 'Enter a valid email address.');
  const pwError = validPassword(password);
  if (pwError) fail('/setup', pwError);
  if (password !== confirm) fail('/setup', 'The two passwords do not match.');

  const id = await createOwnerIfNone({ name, email, passwordHash: await bcrypt.hash(password, 12) });
  // Someone else finished setup a moment earlier.
  if (id === null) notFound();

  await signIn({ id, username: email });
  redirect('/');
}
