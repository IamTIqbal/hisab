import { SessionOptions } from 'iron-session';

export interface SessionData {
  userId?: number;
  username?: string;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60;
const DEV_SECRET = 'insecure-local-development-secret-not-for-production';

// Sessions are sealed with SESSION_SECRET. A production server without a real
// secret would sign cookies with the value above, which is public in this
// repo, so anyone could forge a session. Refuse to run instead. The build
// itself does not need the secret, so `next build` (and CI) still pass.
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  const valid = !!secret && secret.length >= 32 && secret !== DEV_SECRET;
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (!valid && process.env.NODE_ENV === 'production' && !isBuild) {
    throw new Error(
      '[hisab] SESSION_SECRET is missing or shorter than 32 characters. ' +
        'Generate one with `openssl rand -hex 32` and set it in your hosting environment.',
    );
  }
  return valid ? secret! : DEV_SECRET;
}

export const sessionOptions: SessionOptions = {
  password: sessionSecret(),
  cookieName: 'hisab-session',
  // iron-session seals with its own 14-day default ttl unless told otherwise;
  // the seal and the cookie have to live exactly as long as each other.
  ttl: THIRTY_DAYS,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: THIRTY_DAYS,
  },
};
