import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

function createDb() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('TURSO_DATABASE_URL is not set');

  // A local SQLite file can't be created inside a folder that doesn't exist,
  // and a fresh clone has no storage/ yet. Make it, so `npm run dev` and
  // `npm run build` work straight after cloning.
  if (url.startsWith('file:')) {
    const path = url.slice('file:'.length).split('?')[0];
    if (path && path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

  return drizzle(client, { schema });
}

declare global {
  var __db: ReturnType<typeof createDb> | undefined;
}

export const db = globalThis.__db ?? createDb();
if (process.env.NODE_ENV !== 'production') globalThis.__db = db;
