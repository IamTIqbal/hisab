# Hisab

**A personal ledger you host yourself.** Record what came in, what went out, where your money sits and who owes whom, on your phone or at your desk. One install belongs to one person: you deploy your own copy, with your own database, and nobody else's data is ever on it.

> **Status: beta (v1.0.0-beta.1).** It is used daily, but expect rough edges. Back up your database (see [docs/DEPLOY.md](docs/DEPLOY.md#backups)).

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FIamTIqbal%2Fhisab&project-name=hisab&repository-name=hisab&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,SESSION_SECRET,SETUP_TOKEN&envDescription=Turso%20database%20URL%20and%20token%2C%20a%2032%2B%20character%20session%20secret%2C%20and%20a%20setup%20token.%20SMTP%20is%20optional.&envLink=https%3A%2F%2Fgithub.com%2FIamTIqbal%2Fhisab%2Fblob%2Fmain%2Fdocs%2FDEPLOY.md)

<!-- Screenshots: add images to docs/screenshots/ and list them here.
| Home | Expenses | Accounts |
| --- | --- | --- |
| ![Home](docs/screenshots/home.png) | ![Expenses](docs/screenshots/expenses.png) | ![Accounts](docs/screenshots/accounts.png) |
-->

## What it does

- **Home** shows the money you have across cash and bank accounts, what you owe on credit cards, and every account's balance. Spend, Receive and Transfer are one tap away.
- **Expenses and income** by month, grouped by day. Amount first, one-tap categories, a searchable account picker, Today / Yesterday buttons.
- **Accounts**: banks and mobile wallets, cash, and credit cards with limits and usage. Adding one starts with one-tap tiles for Bangladesh's mobile wallets (bKash, Nagad, Rocket, Upay and more) and every scheduled bank, each with its logo. A bank account can hold the details someone needs to pay you, and **Copy details** puts them on the clipboard.
- **Transfers** between accounts, with an optional fee.
- **Loans** you took or gave, per person, with repayments against the account the money moved through.
- **Reports** by category for the month and month by month for the year.
- **CSV export** of income, expenses, transfers and loans.
- **Installable app** (PWA) for Android, iOS and desktop, with an offline page.
- **Your currency, number style and time zone.** Defaults are taka (৳), South Asian grouping (1,00,000) and Asia/Dhaka. Change them in Settings.
- **Optional email:** sign-in codes and a notice for every change, so you notice anything you didn't do.

## Self-host it (about 15 minutes)

You need free accounts on [GitHub](https://github.com), [Turso](https://turso.tech) (the database) and [Vercel](https://vercel.com) (the hosting). Email is optional.

1. **Create a Turso database** and get its URL and a token:
   ```bash
   turso db create hisab
   turso db show hisab --url        # TURSO_DATABASE_URL
   turso db tokens create hisab     # TURSO_AUTH_TOKEN
   ```
2. **Make two secrets:**
   ```bash
   openssl rand -hex 32   # SESSION_SECRET
   openssl rand -hex 16   # SETUP_TOKEN
   ```
3. **Click "Deploy with Vercel"** above and paste in the four values.
4. **Open `https://<your-address>/setup`** (for example `https://hisab.podu.dev/setup`), enter the setup token, your name, email and a password. That creates your account. `/setup` is then gone for good.
5. **Optional:** add SMTP settings for emailed codes and change notices, then redeploy.

The tables are created automatically on first visit; there is nothing to migrate by hand.

> **About the example address.** `hisab.podu.dev` is the author's own install, used in these docs to show what an address looks like. It is private: yours will be the `*.vercel.app` address Vercel gives your project, or your own domain.

**The step-by-step guide, covering every screen, SMTP settings for Gmail, Zoho, Brevo and Resend, custom domains, updates, backups and troubleshooting, is in [docs/DEPLOY.md](docs/DEPLOY.md).**

## Run it on your computer

Requires Node.js 20 or later.

```bash
git clone https://github.com/IamTIqbal/hisab.git
cd hisab
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. You are sent to `/setup` to create your account. The database is a local file, `storage/hisab.sqlite`, created on first run. Email is off until you fill in the SMTP lines in `.env.local`.

To start over, stop the server and delete `storage/`.

## Signing in

- **Password** always works: your email and the password you chose at setup.
- **Emailed code** appears on the sign-in page only when SMTP is configured. You get a 6-digit code and a one-tap link.
- Wrong passwords and codes are limited (5 tries per 15 minutes) and sessions last 30 days.
- Forgot your password with no email set up? See [Reset a forgotten password](docs/DEPLOY.md#reset-a-forgotten-password).

## Configuration

All settings are environment variables. `.env.example` has the common ones; the rest are optional.

| Variable | Required | What it is for |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `libsql://…` for Turso, or `file:./storage/hisab.sqlite` locally |
| `TURSO_AUTH_TOKEN` | with Turso | Database token. Empty for a local file |
| `SESSION_SECRET` | in production | 32+ characters. Signs the sign-in cookie. The app refuses to run in production without it |
| `SETUP_TOKEN` | recommended | Asked for on `/setup` so nobody else can claim a fresh deploy |
| `NEXT_PUBLIC_APP_URL` | with email | Your public address, used in emailed sign-in links |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | no | Your mail server. Leave `SMTP_HOST` empty to run without email |
| `SMTP_FROM` | with email | The address emails are sent from |
| `SMTP_SECURE`, `SMTP_FROM_NAME`, `OTP_EXPIRY_MINUTES` | no | Rarely needed: force TLS on/off, sender name (default `Hisab`), code lifetime in minutes (default 10) |

Your name, email, password, currency symbol, number grouping and time zone are set in the app under **Settings**.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:studio` | Browse the database in Drizzle Studio |
| `npm run icons` | Re-render the PNG app icons from `public/icons/icon.svg` |
| `npm run reset-password -- 'new password'` | Set a new owner password from the command line |

## How it works

- **Next.js 15** (App Router, server actions) and **React 19**
- **Turso / libSQL** (SQLite) through **Drizzle ORM**. `src/lib/db/ensureSchema.ts` creates every table on an empty database and adds new columns to older ones, on the first request after each deploy. It is safe to run on every cold start.
- **iron-session** for the encrypted sign-in cookie, **bcrypt** for the password, **Nodemailer** for optional SMTP
- **Tailwind CSS 3** with design tokens in `src/app/globals.css`
- A hand-written service worker (`public/sw.js`) for the installable app

```
src/
  app/
    (app)/        signed-in pages: home, expenses, income, accounts, loans, reports, export, settings
    setup/        first-run owner creation (404 once done)
    login/        password and emailed-code sign-in
    api/          sign-in link, sign-out, CSV exports
  components/     pickers, entry fields, ledger rows, navigation
  lib/
    db/           schema, client, ensureSchema, balance queries
    owner.ts      finds and creates the one owner
    prefs.ts      currency, grouping, time zone
    bankLogos.ts  bank and wallet logos matched by account name
    money.ts      formatting, dates, categories
public/           icons, bank logos, manifest, service worker
docs/             deploy guide
```

### Adding a bank logo

Logos are matched against the account name. Put a square PNG in `public/logo/` and add one line to `BANK_LOGOS` in [`src/lib/bankLogos.ts`](src/lib/bankLogos.ts). Accounts without a match show their first letter.

## Contributing

Bug reports and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Bank and wallet logos in `public/logo/` are trademarks of their owners and are included only to label your own accounts. They come from each provider's official website, or from its Wikipedia / Wikimedia Commons page where the official site couldn't be reached.
