import { getDb } from '@/db';
const unavailable = () =>
  new Error(
    'Catalog lookup is unavailable. Please try again; no guess was used.',
  );
export async function catalogJson<T>(
  provider: string,
  url: string,
  ttl: number,
  interval = 1500,
  retry = true,
): Promise<T> {
  const db = getDb();
  const key = `${provider}:${url}`;
  const cached = await db
    .prepare('SELECT value FROM catalog_cache WHERE id=? AND expires_at>?')
    .bind(key, Date.now())
    .first<{ value: string }>();
  if (cached) return JSON.parse(cached.value) as T;
  const now = Date.now();
  const slot = await db
    .prepare(`INSERT INTO catalog_rate (id,next_at) VALUES (?,?)
    ON CONFLICT(id) DO UPDATE SET next_at=MAX(next_at,?)+?
    WHERE next_at<=? RETURNING next_at`)
    .bind(provider, now + interval, now, interval, now + 6000)
    .first<{ next_at: number }>();
  if (!slot) throw unavailable();
  const wait = slot.next_at - interval - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'ImmaculateChord/1.0 (https://chord.irace.dev)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (retry && [429, 503].includes(response.status)) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return catalogJson<T>(provider, url, ttl, interval, false);
    }
    throw unavailable();
  }
  const body = await response.text();
  if (body.length > 4000000) throw unavailable();
  const result = JSON.parse(body) as T;
  await db
    .prepare(`INSERT INTO catalog_cache (id,value,expires_at) VALUES (?,?,?)
    ON CONFLICT(id) DO UPDATE SET value=excluded.value,expires_at=excluded.expires_at`)
    .bind(key, body, Date.now() + ttl)
    .run();
  // Bound storage to currently useful entries; no user identifiers are cached.
  await db
    .prepare('DELETE FROM catalog_cache WHERE expires_at<?')
    .bind(Date.now())
    .run();
  return result;
}
