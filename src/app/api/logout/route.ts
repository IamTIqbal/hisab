import { NextResponse, type NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, SessionData } from '@/lib/session';

// Sign-out is a POST from a form in the app. As a GET, any page on the web
// could sign you out with an <img src>. 303 turns the redirect into a GET.
export async function POST(req: NextRequest) {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.destroy();
  return NextResponse.redirect(new URL('/login?signedout=1', req.url), 303);
}

// Old bookmarks of /api/logout land somewhere harmless instead of signing out.
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL('/more', req.url), 303);
}
