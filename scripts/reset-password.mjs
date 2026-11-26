/**
 * Sets a new password for the owner of this Hisab install.
 * For when you have forgotten it and email is not set up.
 *
 *   node scripts/reset-password.mjs 'my new password'
 *
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.local or the
 * environment, so it works on a local file or your Turso database:
 *
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... node scripts/reset-password.mjs 'my new password'
 */

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = resolve(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] ??= m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const password = process.argv[2] ?? '';
if (password.length < 8 || password.length > 128) {
  console.error("Usage: node scripts/reset-password.mjs 'new password'   (8 to 128 characters)");
  process.exit(1);
}

const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set (in .env.local or the environment).');
  process.exit(1);
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || undefined });
const { rows } = await db.execute('SELECT id, email, username FROM users ORDER BY id LIMIT 1');
if (rows.length === 0) {
  console.error('No owner yet. Open /setup in the browser to create one.');
  process.exit(1);
}

const hash = await bcrypt.hash(password, 12);
await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, rows[0].id] });
// Clear any sign-in lockout so the new password works straight away.
await db.execute("DELETE FROM system_logs WHERE event_type = 'auth.password_failed'");
console.log(`Password updated for ${rows[0].email ?? rows[0].username}. Sign in with it now.`);
