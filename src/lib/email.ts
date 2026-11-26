import nodemailer from 'nodemailer';
import { after } from 'next/server';
import { moneyWithSymbol } from './money';
import { hashOtp } from './otp';
import { getOwner } from './owner';

// Email is optional. With SMTP_HOST and SMTP_FROM set, Hisab can email
// sign-in codes and a notice for every change. Without them, password sign-in
// is the only way in and notices are skipped.
export function smtpConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_FROM;
}

function createTransporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  // Port 465 speaks TLS from the first byte; 587 and 25 upgrade with STARTTLS.
  // SMTP_SECURE overrides the guess for servers that do it differently.
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

function fromAddress(): string {
  return `${process.env.SMTP_FROM_NAME || 'Hisab'} <${process.env.SMTP_FROM}>`;
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

// ── HTML email shell ─────────────────────────────────────────────────────────
function emailLayout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

      <!-- Header -->
      <tr>
        <td style="background:#0f172a;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Hisab</h1>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;letter-spacing:0.05em;">PERSONAL FINANCE TRACKER</p>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:32px;">
          ${bodyHtml}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:11px;">Automated notification from your Hisab ledger</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// Notes, account names and provider names go straight into the email body.
// An unescaped `&` or `<` in "Traveler's Holiday & Co." silently mangled the
// row it landed in, and anything sharper than that was live markup.
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tableRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 14px;background:#f8fafc;color:#64748b;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;width:38%;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${label}</td>
    <td style="padding:9px 14px;color:#0f172a;font-size:13px;border-bottom:1px solid #e2e8f0;">${value}</td>
  </tr>`;
}

function dataTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;border-collapse:collapse;margin-top:16px;">${rows}</table>`;
}

// ── Email-address confirmation ───────────────────────────────────────────────
export async function sendEmailChangeCode(code: string, to: string): Promise<void> {
  const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || '10';
  const body = `
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700;">Confirm your new email</h2>
    <p style="margin:0 0 28px;color:#475569;font-size:14px;line-height:1.6;">
      Enter this code in Hisab's Settings to start using this address.
      It expires in <strong>${expiryMinutes} minutes</strong>.
    </p>
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:#0f172a;border-radius:12px;padding:22px 48px;">
        <p style="margin:0;color:#ffffff;font-size:44px;font-weight:700;letter-spacing:14px;font-family:monospace;">${code}</p>
      </div>
    </div>
    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">Didn't ask for this? Ignore this email; nothing changes.</p>
  `;
  await createTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: `${code} — Confirm your Hisab email`,
    html: emailLayout('Confirm your new email', body),
    text: `Your Hisab confirmation code is: ${code}\n\nExpires in ${expiryMinutes} minutes.`,
  });
}

// ── OTP / Magic-link email ───────────────────────────────────────────────────
export async function sendOtpEmail(code: string, to: string): Promise<void> {
  // Carry the hashed token in the link, never the raw code — keeps the secret
  // out of browser history, server logs and referrer headers.
  const magicLink = `${appUrl()}/api/auth/magic?token=${hashOtp(code)}`;
  const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || '10';

  const body = `
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700;">Sign in to Hisab</h2>
    <p style="margin:0 0 28px;color:#475569;font-size:14px;line-height:1.6;">
      Use the code below or click the button to sign in instantly.
      This code expires in <strong>${expiryMinutes} minutes</strong>.
    </p>

    <!-- OTP Code box -->
    <div style="text-align:center;margin:0 0 28px;">
      <div style="display:inline-block;background:#0f172a;border-radius:12px;padding:22px 48px;">
        <p style="margin:0 0 6px;color:#94a3b8;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;">Your sign-in code</p>
        <p style="margin:0;color:#ffffff;font-size:44px;font-weight:700;letter-spacing:14px;font-family:monospace;">${code}</p>
      </div>
    </div>

    <!-- Divider -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td style="border-top:1px solid #e2e8f0;"></td>
        <td style="padding:0 16px;color:#94a3b8;font-size:12px;white-space:nowrap;">or sign in with one click</td>
        <td style="border-top:1px solid #e2e8f0;"></td>
      </tr>
    </table>

    <!-- Magic link button -->
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${magicLink}"
         style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.2px;">
        Sign In to Hisab
      </a>
    </div>

    <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
      Didn't request this? You can safely ignore this email.<br>
      The link expires automatically in ${expiryMinutes} minutes.
    </p>
  `;

  await createTransporter().sendMail({
    from: fromAddress(),
    to,
    subject: `${code} — Your Hisab Sign-In Code`,
    html: emailLayout('Sign in to Hisab', body),
    text: `Your Hisab sign-in code is: ${code}\n\nOr sign in instantly: ${magicLink}\n\nExpires in ${expiryMinutes} minutes.`,
  });
}

// ── Notification emails ──────────────────────────────────────────────────────
type NotifCtx = Record<string, string | number | boolean | null | undefined>;

const EVENT_META: Record<string, { title: string }> = {
  'income.add':       { title: 'Income Added'       },
  'income.update':    { title: 'Income Updated'     },
  'income.delete':    { title: 'Income Deleted'     },
  'expense.add':      { title: 'Expense Added'      },
  'expense.update':   { title: 'Expense Updated'    },
  'expense.delete':   { title: 'Expense Deleted'    },
  'account.add':      { title: 'Account Added'      },
  'account.update':   { title: 'Account Updated'    },
  'account.delete':   { title: 'Account Deleted'    },
  'account.close':    { title: 'Account Closed'     },
  'account.reopen':   { title: 'Account Reopened'   },
  'account.transfer': { title: 'Transfer Completed' },
  'loan.add':         { title: 'Loan Recorded'      },
  'loan.update':      { title: 'Loan Updated'       },
  'loan.close':       { title: 'Loan Closed'        },
  'loan.delete':      { title: 'Loan Deleted'       },
  'settings.password':{ title: 'Password Changed'   },
  'settings.email':   { title: 'Email Changed'      },
  'settings.profile': { title: 'Profile Updated'    },
  'settings.prefs':   { title: 'Preferences Updated'},
};

const FIELD_LABELS: Record<string, string> = {
  amount: 'Amount', source: 'Source', category: 'Category',
  account_name: 'Account', txn_date: 'Date', note: 'Note',
  name: 'Account Name', type: 'Type', opening_balance: 'Opening Balance',
  from_account: 'From Account', to_account: 'To Account', charge: 'Charge',
  provider: 'Provider / Person', balance: 'Outstanding Balance',
  status: 'Status', due_date: 'Due Date',
  credit_limit: 'Credit Limit', card_last4: 'Card (last 4)',
};

const AMOUNT_FIELDS = ['amount', 'balance', 'opening_balance', 'charge', 'credit_limit'];

// Delivered after the response is sent. Awaiting SMTP inside the action held
// every save for a second or two before the page could move on.
// Skipped entirely when SMTP is not configured.
export async function sendNotification(eventType: string, ctx: NotifCtx): Promise<void> {
  if (!smtpConfigured()) return;
  // Formatted now, while this request's currency preferences are loaded.
  const rows = notificationRows(ctx);
  after(() => deliverNotification(eventType, ctx, rows));
}

function notificationRows(ctx: NotifCtx): string {
  return Object.entries(ctx)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => {
      const label = FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const isAmount = AMOUNT_FIELDS.includes(k);
      const display = isAmount && typeof v === 'number' ? moneyWithSymbol(v) : String(v ?? '');
      return tableRow(esc(label), esc(display));
    })
    .join('');
}

async function deliverNotification(eventType: string, ctx: NotifCtx, rows: string): Promise<void> {
  try {
    const owner = await getOwner();
    if (!owner?.email) return;
    const meta = EVENT_META[eventType] ?? { title: eventType };

    const body = `
      <h2 style="margin:0 0 6px;color:#0f172a;font-size:20px;font-weight:700;">${esc(meta.title)}</h2>
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;">
        A change was recorded in your Hisab account.
      </p>
      ${dataTable(rows)}
    `;

    await createTransporter().sendMail({
      from: fromAddress(),
      to: owner.email,
      subject: `${meta.title} — Hisab`,
      html: emailLayout(meta.title, body),
      text: `${meta.title}\n\n${Object.entries(ctx).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n')}`,
    });
  } catch (err) {
    console.error(`[sendNotification] ${eventType}:`, err);
  }
}
