import { NextRequest, NextResponse } from 'next/server';
import { verifyOtp, verifyOtpHash } from '@/lib/otp';
import { appUrl } from '@/lib/email';
import { getOwner } from '@/lib/owner';
import { signIn } from '@/lib/auth';

function escapeAttr(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '');
}

// Mail providers (Outlook Safe Links, Gmail's scanner, corporate gateways)
// open every link in a message before the person does. When a GET consumed the
// token, the scanner signed itself in and the real click landed on "expired".
// A GET now only shows a button; the token is spent by the POST it submits,
// which no scanner sends.
export async function GET(req: NextRequest) {
  const token = escapeAttr(req.nextUrl.searchParams.get('token') ?? '');
  const code = escapeAttr(req.nextUrl.searchParams.get('code') ?? ''); // legacy links

  if (!token && !code) {
    return NextResponse.redirect(new URL('/login?error=missing', appUrl()));
  }

  const field = token ? `<input type="hidden" name="token" value="${token}">` : `<input type="hidden" name="code" value="${code}">`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#1F3A5F">
<title>Sign in to Hisab</title>
<style>
  html,body{margin:0;height:100%}
  body{display:grid;place-items:center;background:#1F3A5F;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:1.5rem}
  main{background:#fff;border-radius:16px;padding:2rem 1.75rem;max-width:22rem;width:100%;text-align:center;color:#1D2B44;box-sizing:border-box}
  h1{font-size:1.35rem;margin:0 0 .5rem}
  p{color:#5C6878;margin:0 0 1.5rem;line-height:1.5}
  button{width:100%;min-height:48px;border:0;border-radius:10px;background:#1D2B44;color:#fff;font:600 1rem system-ui,sans-serif;cursor:pointer}
  button:focus-visible{outline:3px solid #2F5FA7;outline-offset:3px}
</style></head>
<body><main>
  <h1>Sign in to Hisab</h1>
  <p>Continue on this device to open your ledger.</p>
  <form method="post" action="/api/auth/magic">${field}<button type="submit" autofocus>Continue to Hisab</button></form>
</main></body></html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const token = String(form.get('token') ?? '');
  const code = String(form.get('code') ?? '');
  // Back to the host the request came in on, where the cookie was just set.
  const redirect = (path: string) => NextResponse.redirect(new URL(path, req.url), 303);

  if (!token && !code) return redirect('/login?error=missing');

  const valid = token ? await verifyOtpHash(token) : (await verifyOtp(code)) !== false;
  if (!valid) return redirect('/login?error=expired');

  const user = await getOwner();
  if (!user) return redirect('/login?error=nouser');

  await signIn(user);

  return redirect('/');
}
