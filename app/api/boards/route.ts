import { getDb } from '@/db';
import { getPuzzle } from '@/lib/puzzles';
import {
  profile,
  identity,
  boardAttempts,
  type BoardRow,
  hash,
  json,
  publicBoard,
  readBoard,
  sameOrigin,
} from '@/lib/server';
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const body = (await req.json()) as { puzzleId: string; ownerToken: string };
    if (
      !getPuzzle(body.puzzleId) ||
      typeof body.ownerToken !== 'string' ||
      !/^[-\w]{40,100}$/.test(body.ownerToken)
    )
      return json({ error: 'Invalid session.' }, 400);
    const ownerHash = await hash(body.ownerToken);
    const user = await profile(req);
    if (user) {
      // A unique account/puzzle index makes concurrent claims safe.
      await getDb()
        .prepare(
          'UPDATE OR IGNORE boards SET account_id = ? WHERE id = ? AND account_id IS NULL AND lease_until < ?',
        )
        .bind(
          user.id,
          (await hash(`${body.puzzleId}:${ownerHash}`)).slice(0, 32),
          Date.now(),
        )
        .run();
      await getDb()
        .prepare(
          'INSERT OR IGNORE INTO boards (id,puzzle_id,owner_hash,account_id,created_at) VALUES (?,?,?,?,?)',
        )
        .bind(
          (await hash(`account:${user.id}:${body.puzzleId}`)).slice(0, 32),
          body.puzzleId,
          ownerHash,
          user.id,
          Date.now(),
        )
        .run();
      const ranked = await getDb()
        .prepare('SELECT * FROM boards WHERE account_id = ? AND puzzle_id = ?')
        .bind(user.id, body.puzzleId)
        .first<import('@/lib/server').BoardRow>();
      if (!ranked) throw new Error();
      return json(await publicBoard(req, ranked), 201);
    }
    const id = (await hash(`${body.puzzleId}:${ownerHash}`)).slice(0, 32);
    await getDb()
      .prepare(
        'INSERT OR IGNORE INTO boards (id,puzzle_id,owner_hash,created_at) VALUES (?,?,?,?)',
      )
      .bind(id, body.puzzleId, ownerHash, Date.now())
      .run();
    const board = await readBoard(id);
    if (!board) throw new Error();
    return json(
      {
        ...(await publicBoard(
          new Request(req.url, {
            headers: { Authorization: `Bearer ${body.ownerToken}` },
          }),
          board,
        )),
      },
      201,
    );
  } catch {
    return json(
      { error: 'Could not open your session. Please try again.' },
      503,
    );
  }
}

export async function GET(req: Request) {
  const accountId = identity(req);
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!accountId && (!token || !/^[-\w]{40,100}$/.test(token)))
    return json({ completedPuzzleIds: [] });
  try {
    const result = await getDb()
      .prepare(
        accountId
          ? 'SELECT * FROM boards WHERE account_id = ?'
          : 'SELECT * FROM boards WHERE owner_hash = ? AND account_id IS NULL',
      )
      .bind(accountId || (await hash(token!)))
      .all<BoardRow>();
    return json({
      completedPuzzleIds: result.results
        .filter((b) => !!b.locked || boardAttempts(b).length >= 9)
        .map((b) => b.puzzle_id),
    });
  } catch {
    return json({ error: 'Could not load completed sets.' }, 503);
  }
}
