import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from './db/client';
import { systemLogs } from './db/schema';

// Sliding-window attempt counting, stored in system_logs so it holds across
// serverless instances. Hisab has one owner, so limits are global per event
// rather than per client: a guesser and the owner share the budget, and the
// owner is never locked out for longer than the window.

function since(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString().replace('T', ' ').slice(0, 19);
}

export async function recordFailure(event: string): Promise<void> {
  await db.insert(systemLogs).values({ eventType: event, contextJson: null });
}

export async function countRecent(event: string, windowMinutes: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(systemLogs)
    .where(and(eq(systemLogs.eventType, event), gte(systemLogs.createdAt, since(windowMinutes))));
  return Number(row?.n ?? 0);
}

export async function tooManyFailures(event: string, max: number, windowMinutes: number): Promise<boolean> {
  return (await countRecent(event, windowMinutes)) >= max;
}

export async function clearFailures(event: string): Promise<void> {
  await db.delete(systemLogs).where(eq(systemLogs.eventType, event));
}
