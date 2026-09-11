import { getDb } from '@/db';
import {
  json,
  readBoard,
  publicBoard,
  owns,
  sameOrigin,
  isLocalTesting,
} from '@/lib/server';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isLocalTesting(req)) return json({ error: 'Not found.' }, 404);
  if (!sameOrigin(req))
    return json({ error: 'Request origin is not allowed.' }, 403);
  const { id } = await params;
  const board = await readBoard(id);
  if (!board) return json({ error: 'Board not found.' }, 404);
  if (!(await owns(req, board)))
    return json({ error: 'This shared board is read-only.' }, 403);
  const cleared = await getDb()
    .prepare(
      "UPDATE boards SET answers = '[]', attempts = '[]', locked = 0, lease = NULL, lease_until = 0 WHERE id = ? AND lease_until < ? AND answers = ? AND attempts IS ? RETURNING id",
    )
    .bind(id, Date.now(), board.answers, board.attempts)
    .first();
  if (!cleared)
    return json(
      {
        error: 'An answer is being saved. Try clearing again when it finishes.',
      },
      409,
    );
  return json(await publicBoard(req, (await readBoard(id))!));
}
