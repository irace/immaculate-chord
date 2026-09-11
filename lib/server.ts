import { getDb, getGradingConfig } from '@/db';
import { scoreAnswer, acceptsAnswer, type Answer, type Attempt } from './game';
export type BoardRow = {
  account_id?: string | null;
  id: string;
  puzzle_id: string;
  owner_hash: string;
  answers: string;
  attempts: string | null;
  locked: number;
  lease: string | null;
  lease_until: number;
};
export async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (x) =>
    x.toString(16).padStart(2, '0'),
  ).join('');
}
export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function readBoard(id: string) {
  return getDb()
    .prepare('SELECT * FROM boards WHERE id = ?')
    .bind(id)
    .first<BoardRow>();
}
export async function owns(req: Request, b: BoardRow) {
  if (b.account_id) return identity(req) === b.account_id;
  if (identity(req)) return false;
  return ownsGuest(req, b);
}
async function ownsGuest(req: Request, b: BoardRow) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  return !!token && token.length < 200 && (await hash(token)) === b.owner_hash;
}
export function boardAttempts(b: BoardRow): Attempt[] {
  const attempts: Attempt[] = b.attempts
    ? JSON.parse(b.attempts)
    : (JSON.parse(b.answers) as Answer[]).map((a) => ({
        ...a,
        accepted: acceptsAnswer(a),
      }));
  return attempts.map((a) => ({
    ...a,
    score: scoreAnswer(a.rowFit, a.colFit, a.obscurity),
  }));
}
export async function publicBoard(req: Request, b: BoardRow) {
  const attempts = boardAttempts(b);
  const locked = !!b.locked || attempts.length >= 9;
  return {
    canClearBoard: isLocalTesting(req) && (await owns(req, b)),
    resumeWithAccount:
      !b.account_id && !!(await profile(req)) && (await ownsGuest(req, b)),
    id: b.id,
    puzzleId: b.puzzle_id,
    answers: attempts.filter((a) => a.accepted),
    attempts,
    guessesUsed: attempts.length,
    guessesLeft: Math.max(0, 9 - attempts.length),
    locked,
    isOwner: await owns(req, b),
    editable: !locked && (await owns(req, b)),
    gradingReady: !!getGradingConfig().key,
  };
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  return !origin || origin === new URL(req.url).origin;
}

// Sites dispatch verifies and supplies these headers; local Vite simulates them.
export function identity(req: Request) {
  return req.headers.get('oai-authenticated-user-email')
    ? req.headers.get('oai-authenticated-user-id')
    : null;
}
export async function profile(req: Request) {
  const id = identity(req);
  if (!id) return null;
  let name = req.headers.get('oai-authenticated-user-full-name') || '';
  if (
    req.headers.get('oai-authenticated-user-full-name-encoding') ===
    'percent-encoded-utf-8'
  ) {
    try {
      name = decodeURIComponent(name);
    } catch {
      name = '';
    }
  }
  const username =
    name
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, 100) || 'Listener';
  // Identity, not display name, distinguishes players with the same name.
  await getDb()
    .prepare(
      'INSERT INTO users (id,username,username_key) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, username_key=excluded.username_key WHERE users.username != excluded.username OR users.username_key != excluded.username_key',
    )
    .bind(id, username, 'chatgpt:' + id)
    .run();
  return { id, username };
}

export function isLocalTesting(req: Request) {
  return (
    process.env.NODE_ENV === 'development' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(req.url).hostname)
  );
}
