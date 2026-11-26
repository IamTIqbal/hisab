import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionOptions, SessionData } from './session';
import { ensureSchema } from './db/ensureSchema';
import { getUserById, hasOwner } from './owner';
import { loadPrefs } from './prefs';
import type { User } from './db/schema';

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function signIn(user: Pick<User, 'id' | 'username'>) {
  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  await session.save();
}

// Every signed-in page, server action and API route starts here. It makes sure
// the database is set up, that the cookie belongs to the owner who still
// exists, and loads the owner's display preferences for this request.
export async function requireAuth() {
  const session = await getSession();
  await ensureSchema();

  if (!session.userId) redirect((await hasOwner()) ? '/login' : '/setup');

  const [user] = await Promise.all([getUserById(session.userId), loadPrefs()]);
  if (!user) {
    // The database was replaced under a live cookie. Treat it as signed out.
    session.destroy();
    redirect((await hasOwner()) ? '/login' : '/setup');
  }
  return { session, user };
}

// For route handlers, which answer 401 instead of redirecting.
export async function sessionUser(): Promise<User | null> {
  const session = await getSession();
  if (!session.userId) return null;
  await ensureSchema();
  const [user] = await Promise.all([getUserById(session.userId), loadPrefs()]);
  return user;
}
