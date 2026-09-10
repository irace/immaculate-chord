import { profile, json } from '@/lib/server';
export async function GET(req: Request) {
  const user = await profile(req);
  return json({ signedIn: !!user, username: user?.username || null });
}
