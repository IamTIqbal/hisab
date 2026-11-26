# Contributing to Hisab

Thanks for helping. Bug fixes, docs and focused improvements are all welcome.

## Before you start

- **Small fix?** Open a pull request directly.
- **New feature or a bigger change?** Open an issue first, so we can agree on the approach before you spend time on it.
- **Out of scope:** multiple users on one install. Hisab is deliberately one person per deploy.
- **Security issues** go through [SECURITY.md](SECURITY.md), never a public issue.

## Set up

Requires Node.js 20 or later.

```bash
git clone https://github.com/<you>/hisab.git
cd hisab
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and create a test owner on `/setup`. The database is `storage/hisab.sqlite`; delete the `storage/` folder to start fresh.

To try email locally without a real account, run a catcher such as [Mailpit](https://mailpit.axllent.org) and set `SMTP_HOST=localhost`, `SMTP_PORT=1025`, `SMTP_FROM=hisab@example.com`.

## Rules for changes

- **Never commit real data.** No real names, emails, account or card numbers, balances or screenshots of a real ledger. Use obvious fakes (`Test Bank`, `owner@example.com`, `1234`).
- **Database changes must upgrade existing installs by themselves.** Add a new table to `TABLES` and a new column to `COLUMNS` in `src/lib/db/ensureSchema.ts`, as well as to `src/lib/db/schema.ts`. Changes must be additive and safe to run on every cold start. Don't rename or drop columns.
- **Server actions and API routes** must call `requireAuth()` (or `sessionUser()` in a route handler) before reading or writing anything.
- **Amounts and dates** go through `money()` / `moneyWithSymbol()` and `todayDate()` in `src/lib/money.ts`, so the owner's currency, grouping and time zone apply. Don't hard-code `৳` or a time zone.
- **Service worker:** if you change `public/sw.js`, bump its `VERSION` so installed apps drop their old cache.
- Keep the existing style: plain server components, server actions for forms, comments that explain *why*.

## Before opening the pull request

```bash
npm run typecheck
npm run lint
npm run build
```

All three must pass; CI runs the same. In the description, say what changed, why, and how you tested it, including which screens you clicked through.

## License

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
