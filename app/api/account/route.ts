import { getDb } from '@/db';
import { identity, profile, json, sameOrigin } from '@/lib/server';
export async function GET(req: Request) {
  const user = await profile(req);
  return json({ signedIn: !!identity(req), username: user?.username || null });
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return json({ error: 'Request origin is not allowed.' }, 403);
  const id = identity(req);
  if (!id) return json({ error: 'Sign in to choose a username.' }, 401);
  try {
    const { username } = (await req.json()) as { username: unknown };
    if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(username))
      return json({ error: 'Use 3–20 letters, numbers, or underscores.' }, 400);
    await getDb()
      .prepare(
        'INSERT INTO users (id,username,username_key) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, username_key=excluded.username_key',
      )
      .bind(id, username, username.toLowerCase())
      .run();
    return json({ signedIn: true, username });
  } catch {
    return json({ error: 'That username is unavailable. Try another.' }, 409);
  }
}
