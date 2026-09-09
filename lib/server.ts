import { getDb, getGradingConfig } from '@/db';
import type { Answer } from './game';
export type BoardRow = {
  id: string;
  puzzle_id: string;
  owner_hash: string;
  answers: string;
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
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  return !!token && token.length < 200 && (await hash(token)) === b.owner_hash;
}
export async function publicBoard(req: Request, b: BoardRow) {
  return {
    id: b.id,
    puzzleId: b.puzzle_id,
    answers: JSON.parse(b.answers) as Answer[],
    locked: !!b.locked,
    editable: !b.locked && (await owns(req, b)),
    gradingReady: !!getGradingConfig().key,
  };
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get('Origin');
  return !origin || origin === new URL(req.url).origin;
}
