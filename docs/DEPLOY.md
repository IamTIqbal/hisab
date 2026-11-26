# Deploying Hisab

This guide takes you from nothing to your own Hisab running on the internet, installed on your phone. It uses three free services:

| Service | What it does for Hisab | Cost for one person |
| --- | --- | --- |
| [GitHub](https://github.com) | Holds your copy of the code | Free |
| [Turso](https://turso.tech) | The database (SQLite in the cloud) | Free tier is far more than one ledger needs |
| [Vercel](https://vercel.com) | Runs the app and gives it a web address | Free (Hobby plan) |
| An SMTP mail service | Optional: emailed sign-in codes and change notices | Free tiers exist (see [Part 3](#part-3-email-optional)) |

Plan on about 15 minutes, plus 10 more if you set up email.

> **Example address.** This guide uses `https://hisab.podu.dev` wherever your app's address goes. That is the author's own Hisab, shown only as an example, and it is private. Use your own address instead: the `something.vercel.app` URL Vercel gives your project, or your own domain. You need a computer with a terminal for Part 1; everything else is in the browser.

**Contents**

1. [Create the database on Turso](#part-1-create-the-database-on-turso)
2. [Deploy to Vercel](#part-2-deploy-to-vercel)
3. [Email (optional)](#part-3-email-optional)
4. [First sign-in and installing the app](#part-4-first-sign-in-and-installing-the-app)
5. [Afterwards: domain, updates, backups](#part-5-afterwards)
6. [Troubleshooting](#troubleshooting)

---

## Part 1: Create the database on Turso

### 1.1 Install the Turso CLI

macOS (Homebrew):

```bash
brew install tursodatabase/tap/turso
```

Linux, or Windows using WSL:

```bash
curl -sSfL https://get.tur.so/install.sh | bash
```

Close and reopen the terminal, then check it works:

```bash
turso --version
```

### 1.2 Sign in

```bash
turso auth signup    # first time: creates your Turso account in the browser
# or
turso auth login     # if you already have one
```

### 1.3 Create the database

Pick a location close to where Vercel will run your app. Vercel's default region is Washington, D.C. (`iad1`); if you live in South Asia, choosing Mumbai or Singapore for both is faster. To see Turso's locations:

```bash
turso db locations
```

Create the database (the name `hisab` is up to you):

```bash
turso db create hisab
# or pin a location:
turso db create hisab --location bom
```

### 1.4 Get the URL and a token

```bash
turso db show hisab --url
```

That prints something like `libsql://hisab-yourname.turso.io`. This is your **`TURSO_DATABASE_URL`**.

```bash
turso db tokens create hisab
```

That prints a long string starting with `eyJ`. This is your **`TURSO_AUTH_TOKEN`**. Treat it like a password: anyone with it can read and change your ledger.

You do **not** need to create any tables. Hisab builds them itself the first time it starts.

### 1.5 Make two secrets

Still in the terminal:

```bash
openssl rand -hex 32
```

Copy the 64-character result. This is your **`SESSION_SECRET`**. It encrypts your sign-in cookie.

```bash
openssl rand -hex 16
```

Copy that too. This is your **`SETUP_TOKEN`**. Until you create your account, `/setup` asks for it, so a stranger who stumbles on your new address can't create the account first.

No `openssl`? Any password manager's generator works: use at least 32 random letters and digits for the session secret.

Keep all four values in a safe note for the next part.

---

## Part 2: Deploy to Vercel

### Option A: the Deploy button (easiest)

1. Open the [Hisab repository](https://github.com/IamTIqbal/hisab) and click **Deploy with Vercel** in the README.
2. Sign in to Vercel with GitHub if asked.
3. **Create Git Repository:** Vercel makes a copy of Hisab in your GitHub account. Keep it **private** if you like; it works either way.
4. **Configure Project:** Vercel asks for four values. Paste the ones from Part 1:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `SESSION_SECRET`
   - `SETUP_TOKEN`
5. Click **Deploy** and wait about two minutes.
6. When it says *Congratulations*, click **Continue to Dashboard** and copy your address, for example `https://hisab-abc123.vercel.app` (or later your own domain, like `https://hisab.podu.dev`).

### Option B: fork and import

1. On GitHub, click **Fork** on the Hisab repository.
2. In Vercel, click **Add New… → Project**, pick your fork and click **Import**.
3. Open **Environment Variables** and add the four values from Part 1.
4. Click **Deploy**.

### 2.1 Tell Hisab its own address

Emailed sign-in links need to know where your app lives. Even if you skip email now, set it:

1. Vercel dashboard → your project → **Settings → Environment Variables**.
2. Add `NEXT_PUBLIC_APP_URL` = your address, e.g. `https://hisab.podu.dev` (no slash at the end).
3. Go to **Deployments**, open the menu (⋯) on the latest one and click **Redeploy**.

Every time you change an environment variable you have to redeploy like this before it takes effect.

### 2.2 Optional: run close to your database

Vercel → project → **Settings → Functions → Function Region**. Choose the region nearest your Turso location (e.g. Mumbai `bom1` for Turso `bom`). Redeploy. Pages load noticeably faster when the two sit together.

---

## Part 3: Email (optional)

Without email, Hisab works fully: you sign in with your password. With email you also get:

- **Sign in with an emailed code** or a one-tap link, handy on a new phone.
- **A notice for every change** (entry added, account closed, password changed), so you notice anything you didn't do.
- **Verified email changes**: a new address must be confirmed with a code.

Hisab sends mail over plain SMTP, so any mail provider works. Add these environment variables in Vercel (Settings → Environment Variables) and redeploy:

| Variable | Meaning |
| --- | --- |
| `SMTP_HOST` | The provider's SMTP server name |
| `SMTP_PORT` | `587` (STARTTLS, most common) or `465` (TLS from the start) |
| `SMTP_SECURE` | Leave empty. Hisab uses TLS from the start on port 465 and STARTTLS otherwise. Set `true` or `false` only if your provider says to |
| `SMTP_USER` | The login for the SMTP server |
| `SMTP_PASS` | Its password or app password/API key |
| `SMTP_FROM` | The address emails come from. Usually must be your own address or a verified domain |
| `SMTP_FROM_NAME` | The sender name, e.g. `Hisab` |

Emails go to the address you entered at setup (change it in **Settings → Email**).

### Gmail (personal account)

Gmail needs an **app password**; your normal password is refused.

1. Turn on 2-Step Verification: [myaccount.google.com/security](https://myaccount.google.com/security).
2. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), name it `Hisab`, click **Create**, and copy the 16-letter password (spaces don't matter).
3. Set:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   SMTP_FROM=you@gmail.com
   ```

Gmail limits personal accounts to about 500 messages a day, which is plenty.

### Zoho Mail

1. In Zoho Mail: **Settings → Security → App Passwords**, generate one for `Hisab`.
2. Set (use `smtp.zoho.in`, `smtp.zoho.eu` etc. if your account is in that region):
   ```
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=465
   SMTP_USER=you@yourdomain.com
   SMTP_PASS=<app password>
   SMTP_FROM=you@yourdomain.com
   ```

### Brevo (free: 300 emails a day)

1. Sign up at [brevo.com](https://www.brevo.com), then **Senders, Domains & Dedicated IPs → Senders** and add and verify the address you'll send from.
2. Open **SMTP & API → SMTP** and click **Generate a new SMTP key**.
3. Set:
   ```
   SMTP_HOST=smtp-relay.brevo.com
   SMTP_PORT=587
   SMTP_USER=<the "Login" shown on that page, ends in @smtp-brevo.com>
   SMTP_PASS=<the SMTP key>
   SMTP_FROM=<your verified sender address>
   ```

### Resend (free: 100 emails a day, needs your own domain)

1. Sign up at [resend.com](https://resend.com), add your domain under **Domains** and add the DNS records it shows.
2. Create an API key under **API Keys**.
3. Set:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=465
   SMTP_USER=resend
   SMTP_PASS=<API key, starts with re_>
   SMTP_FROM=hisab@yourdomain.com
   ```

### Check that it works

After redeploying, sign out and choose **Email me a code instead** on the sign-in page. If nothing arrives within a minute:

- Look in spam, and mark the message *Not spam* once.
- Vercel → project → **Logs**, and search for `requestOtp` or `sendNotification`. The error there names the problem (wrong password, blocked port, unverified sender).
- See [Troubleshooting](#troubleshooting).

To turn email off again, delete `SMTP_HOST` and redeploy.

---

## Part 4: First sign-in and installing the app

### 4.1 Create your account

1. Open your address (e.g. `https://hisab.podu.dev`). You're sent to `/setup`.
2. Enter your **setup token** (the `SETUP_TOKEN` from Part 1), **your name**, **your email** and a **password** (8+ characters). Click **Create my ledger**.
3. You're signed in. From now on `/setup` shows "not found"; it can't be used again, so nobody else can create an account on your install.

The first time any page loads after a deploy, Hisab creates or updates its tables. That first load can take a second or two longer.

### 4.2 Set your preferences

Open **Settings** (top right on a computer; **More → Settings** on a phone):

- **Currency symbol**: `৳` by default. Pick from the suggestions or type your own (up to 4 characters, e.g. `₹`, `$`, `Rs`).
- **Number grouping**: *South Asian* (`1,00,000.00`) or *International* (`100,000.00`).
- **Time zone**: decides what "today" and "this month" mean.

### 4.3 Add your accounts

Go to **Accounts → Add account** and add each place you keep money: bank accounts, mobile wallets, cash in hand, credit cards (with their limit). Give each one its current balance as the opening balance. Then start recording expenses and income.

### 4.4 Install it on your phone

- **Android (Chrome):** open your Hisab address, tap the **⋮** menu → **Install app** (or **Add to Home screen**).
- **iPhone/iPad (Safari):** tap **Share** → **Add to Home Screen**.
- **Desktop (Chrome/Edge):** click the install icon at the right end of the address bar.

It then opens full-screen like any other app.

---

## Part 5: Afterwards

### Use your own domain

Vercel → project → **Settings → Domains** → add e.g. `hisab.podu.dev` (your own subdomain) and create the DNS record Vercel shows at your domain registrar. Then change `NEXT_PUBLIC_APP_URL` to the new address and redeploy. You'll need to sign in again on the new address.

### Get updates

If you used the Deploy button or a fork, your copy doesn't update by itself.

- **Fork:** on your fork's GitHub page click **Sync fork → Update branch**. Vercel deploys the update automatically.
- **Deploy-button copy:** in your copy run:
  ```bash
  git remote add upstream https://github.com/IamTIqbal/hisab.git
  git pull upstream main
  git push
  ```

Database changes that come with an update are applied automatically on the first page load. Read the release notes before updating while Hisab is in beta.

### Backups

Your ledger lives only in Turso, so back it up now and then:

```bash
turso db shell hisab .dump > hisab-backup-$(date +%F).sql
```

To restore into a fresh database:

```bash
turso db create hisab-restored
turso db shell hisab-restored < hisab-backup-2026-01-31.sql
```

Then point `TURSO_DATABASE_URL` (and a new token for that database) at it and redeploy. Paid Turso plans also offer point-in-time restore.

**Export → CSV** in the app gives you spreadsheets of your entries, but it isn't a full backup: it can't be loaded back in.

### Rotate secrets

- **`SESSION_SECRET`:** generate a new one, update it in Vercel, redeploy. Everyone (you) is signed out.
- **`TURSO_AUTH_TOKEN`:** `turso db tokens invalidate hisab` cancels all existing tokens; then create a new one, update it in Vercel and redeploy.
- **`SETUP_TOKEN`:** not used after setup; you can delete it.

### Reset a forgotten password

With email set up, choose **Email me a code instead** on the sign-in page, then change your password in Settings.

Without email, on your computer, in a copy of the code:

```bash
npm install
TURSO_DATABASE_URL=libsql://hisab-<your-org>.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
npm run reset-password -- 'my new password'
```

---

## Troubleshooting

| What you see | Cause and fix |
| --- | --- |
| Every page shows **"Application error"** or 500 right after deploying | `SESSION_SECRET` is missing or shorter than 32 characters. Vercel → Logs shows `SESSION_SECRET is missing`. Set it and redeploy. |
| Logs say `TURSO_DATABASE_URL is not set` | Add the variable for the **Production** environment, then redeploy. |
| Logs say `SERVER_ERROR: … 401` or `Unauthorized` from libsql | `TURSO_AUTH_TOKEN` is wrong, expired or for a different database. Create a new one with `turso db tokens create hisab`. |
| `/setup` says the setup token is wrong | It must match `SETUP_TOKEN` in Vercel exactly. Changed it? Redeploy first. |
| `/setup` shows "not found" but you never set up | Someone (or you, in another tab) already created the owner. If that wasn't you, create a new Turso database, point the app at it, set a fresh `SETUP_TOKEN` and redeploy. |
| "Too many wrong attempts" | 5 wrong passwords or codes within 15 minutes pauses sign-in for 15 minutes. Wait, or [reset the password](#reset-a-forgotten-password) (that also clears the pause). |
| No "Email me a code" button | `SMTP_HOST` or `SMTP_FROM` is not set, or you didn't redeploy after adding them. |
| "Could not send the email" | Wrong SMTP user/password (Gmail needs an app password), wrong port, or the `SMTP_FROM` address isn't allowed by the provider. The Vercel log shows the exact SMTP error. |
| Emails arrive but the one-tap link opens `localhost` | Set `NEXT_PUBLIC_APP_URL` to your real address and redeploy. |
| The installed phone app shows an old version | Close it fully and reopen it. If that doesn't help, sign out and in once; updates replace the offline copy. |
| Pages are slow | Put Vercel's Function Region next to your Turso location ([2.2](#22-optional-run-close-to-your-database)). |

Still stuck? Open an [issue](https://github.com/IamTIqbal/hisab/issues) with the error from the Vercel log. Remove any tokens or personal data from it first.
