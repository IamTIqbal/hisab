import crypto from 'crypto';
import { db } from './db/client';
import { otpTokens } from './db/schema';
import { lt, eq, and, gte } from 'drizzle-orm';
import { recordFailure, clearFailures, tooManyFailures } from './rateLimit';

// 6-digit codes, stored only as a sha256 hash. 'login' codes sign the owner
// in; 'email' codes confirm a new address (carried in `target`).
export type OtpPurpose = 'login' | 'email';

// A wrong guess hashes to nothing on file, so failures are counted on their
// own. After MAX_GUESSES wrong codes inside the window every outstanding code
// of that purpose is burned: a brute force never gets more than that many
// tries at a live code, and the owner just asks for a new one.
const MAX_GUESSES = 5;
const GUESS_WINDOW_MINUTES = 15;

function sqlNow(offsetMinutes = 0): string {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}

export function generateOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function guessEvent(purpose: OtpPurpose) {
  return `auth.otp_failed.${purpose}`;
}

export async function saveOtp(code: string, purpose: OtpPurpose = 'login', target: string | null = null): Promise<void> {
  const expiryMinutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

  // A new code replaces every older one of the same purpose.
  await db.delete(otpTokens).where(lt(otpTokens.expiresAt, sqlNow()));
  await db.update(otpTokens).set({ used: 1 }).where(and(eq(otpTokens.purpose, purpose), eq(otpTokens.used, 0)));
  await clearFailures(guessEvent(purpose));

  await db.insert(otpTokens).values({
    tokenHash: hashOtp(code),
    purpose,
    target,
    expiresAt: sqlNow(expiryMinutes),
    used: 0,
  });
}

// Claims a token by its hash in one statement, so two requests arriving
// together (a double tap, a mail scanner racing the owner) cannot both use it.
// Returns the claimed row's `target`, or false if nothing was claimed.
async function claim(hash: string, purpose: OtpPurpose): Promise<{ target: string | null } | false> {
  if (!hash) return false;
  const rows = await db
    .update(otpTokens)
    .set({ used: 1 })
    .where(
      and(
        eq(otpTokens.tokenHash, hash),
        eq(otpTokens.purpose, purpose),
        eq(otpTokens.used, 0),
        gte(otpTokens.expiresAt, sqlNow()),
      ),
    )
    .returning({ target: otpTokens.target });
  return rows.length > 0 ? { target: rows[0].target } : false;
}

// The magic link carries the hash rather than the raw code. A full sha256 is
// not guessable, so this path is not rate-limited.
export async function verifyOtpHash(hash: string): Promise<boolean> {
  return (await claim(hash, 'login')) !== false;
}

// A code typed by hand: a million possibilities, so guesses are limited.
export async function verifyOtp(code: string, purpose: OtpPurpose = 'login'): Promise<{ target: string | null } | false> {
  const event = guessEvent(purpose);
  if (await tooManyFailures(event, MAX_GUESSES, GUESS_WINDOW_MINUTES)) return false;

  const result = await claim(hashOtp(code.trim()), purpose);
  if (result) {
    await clearFailures(event);
    return result;
  }

  await recordFailure(event);
  if (await tooManyFailures(event, MAX_GUESSES, GUESS_WINDOW_MINUTES)) {
    await db.update(otpTokens).set({ used: 1 }).where(and(eq(otpTokens.purpose, purpose), eq(otpTokens.used, 0)));
  }
  return false;
}
