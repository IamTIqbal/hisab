import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';

const PUBLIC_PATHS = ['/login', '/setup', '/offline'];
const STATIC_EXT = /\.(png|svg|jpg|jpeg|ico|json|js|css|txt|webp|woff2?|webmanifest)$/i;

// This file has to live under src/, next to app/: Next.js ignores a
// middleware.ts at the repo root once a src directory exists.
//
// Signed-out visitors go to /login; /login itself sends them on to /setup
// while no owner exists (that needs the database, which this edge code does
// not touch).
//
// A cookie that is merely present is not a session: once the seal expires or
// SESSION_SECRET rotates, iron-session hands the page an empty session and
// requireAuth() bounces to /login. Checking only for the cookie's existence
// would bounce that straight back to /, looping the browser between the two.
// Unseal it here so an unusable cookie is treated as signed out and cleared.
async function readSession(value: string): Promise<SessionData | null> {
  try {
    const data = await unsealData<SessionData>(value, {
      password: sessionOptions.password,
      ttl: sessionOptions.ttl,
    });
    return data?.userId ? data : null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_EXT.test(pathname) || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const cookie = request.cookies.get(sessionOptions.cookieName);
  const session = cookie ? await readSession(cookie.value) : null;

  if (!session) {
    const response = isPublic
      ? NextResponse.next()
      : NextResponse.redirect(new URL('/login', request.url));
    if (cookie) response.cookies.delete(sessionOptions.cookieName);
    return response;
  }

  // A signed-in visit to /login or /setup goes home; /offline stays reachable.
  if (pathname.startsWith('/login') || pathname.startsWith('/setup')) return NextResponse.redirect(new URL('/', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
