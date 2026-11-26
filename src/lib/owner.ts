import { eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { users, type User } from './db/schema';
import { ensureSchema } from './db/ensureSchema';

// Hisab has exactly one person per install: the owner. These helpers are the
// only place that knows how that person is found.

// Once an owner exists they can never stop existing (there is no "delete
// account"), so a `true` is cached for the life of the server instance.
let ownerKnown = false;

export async function hasOwner(): Promise<boolean> {
  if (ownerKnown) return true;
  await ensureSchema();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(users);
  ownerKnown = Number(row?.n ?? 0) > 0;
  return ownerKnown;
}

export async function getOwner(): Promise<User | null> {
  await ensureSchema();
  const [user] = await db.select().from(users).orderBy(users.id).limit(1);
  return user ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

// Find the owner by the identifier typed on the sign-in form: their email, or
// the username of an install created before sign-in by email existed.
export async function findOwnerByLogin(identifier: string): Promise<User | null> {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  await ensureSchema();
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${id} OR lower(${users.username}) = ${id}`)
    .limit(1);
  return user ?? null;
}

// Creates the owner only if there is still no user, in one statement. SQLite
// runs a single INSERT … SELECT … WHERE NOT EXISTS atomically, so two people
// submitting /setup at the same moment cannot both become the owner: exactly
// one insert affects a row. Returns the new user's id, or null if an owner
// already existed.
export async function createOwnerIfNone(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<number | null> {
  await ensureSchema();
  const email = input.email.trim().toLowerCase();
  const result = await db.run(sql`
    INSERT INTO users (username, password_hash, name, email)
    SELECT ${email}, ${input.passwordHash}, ${input.name}, ${email}
    WHERE NOT EXISTS (SELECT 1 FROM users)
  `);
  if (result.rowsAffected !== 1) return null;
  ownerKnown = true;
  const owner = await getOwner();
  return owner?.id ?? null;
}
