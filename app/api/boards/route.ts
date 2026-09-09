import { getDb } from '@/db';
import { getPuzzle } from '@/lib/puzzles';
import { hash, json, publicBoard, readBoard, sameOrigin } from '@/lib/server';
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
