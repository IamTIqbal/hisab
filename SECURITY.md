# Security policy

Hisab holds people's financial records, so security reports are taken seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Use GitHub's private reporting instead: on this repository open **Security → Report a vulnerability**. Include what you found, how to reproduce it, and what an attacker could do with it.

You'll get a reply within 7 days. Once a fix is released you'll be credited in the release notes, unless you'd rather not be.

## Supported versions

Hisab is in beta. Only the latest release on `main` receives fixes.

## How Hisab protects an install

- **One owner per install.** `/setup` creates the owner in one atomic statement and returns 404 for good afterwards. Set `SETUP_TOKEN` so nobody else can claim a fresh deploy before you do.
- **Passwords** are hashed with bcrypt (cost 12). Emailed codes are stored only as SHA-256 hashes, expire (10 minutes by default) and can be used once.
- **Rate limits.** 5 wrong passwords, or 5 wrong codes, within 15 minutes pauses that sign-in method for 15 minutes. At most 5 codes are emailed per 15 minutes.
- **Sessions** are sealed, HttpOnly, SameSite=Lax cookies (Secure in production) that last 30 days. In production the app refuses to run without a `SESSION_SECRET` of at least 32 characters.
- **Every page, server action and CSV export** checks the session on the server.
- **Headers:** HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, a strict referrer policy and a restrictive permissions policy.
- **CSV exports** neutralise cells that spreadsheet apps would run as formulas.
- **Email links** carry a hash, not the code, and only sign in on an explicit button press, so mail scanners that open links can't use them.
- **Card numbers:** only the last four digits are stored.

## Your responsibilities as the person running an install

- Keep `SESSION_SECRET`, `TURSO_AUTH_TOKEN` and SMTP passwords secret; rotate them if they leak (see [docs/DEPLOY.md](docs/DEPLOY.md#rotate-secrets)).
- Finish `/setup` right after deploying.
- Keep your copy up to date and back up your database.
