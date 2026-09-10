import { getDb, getGradingConfig } from '@/db';
import {
  json,
  readBoard,
  publicBoard,
  owns,
  sameOrigin,
  boardAttempts,
} from '@/lib/server';
import { getPuzzle } from '@/lib/puzzles';
import { acceptsAnswer } from '@/lib/game';
import { grade } from '@/lib/grader';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(req))
    return json({ error: 'Request origin is not allowed.' }, 403);
  const { id } = await params;
  let lease: string | undefined;
  try {
    const b = await readBoard(id);
    if (!b) return json({ error: 'Board not found.' }, 404);
    if (!(await owns(req, b)))
      return json({ error: 'This shared board is read-only.' }, 403);
    const { attemptIndex } = (await req.json()) as { attemptIndex: number };
    const attempts = boardAttempts(b);
    if (
      !Number.isInteger(attemptIndex) ||
      attemptIndex < 0 ||
      attemptIndex >= attempts.length
    )
      return json({ error: 'Choose a rejected guess to re-grade.' }, 400);
    const previous = attempts[attemptIndex];
    if (
      previous.accepted ||
      previous.regraded ||
      attempts.some(
        (a, i) => a.cell === previous.cell && (a.accepted || i > attemptIndex),
      )
    )
      return json(
        {
          error:
            'Only the latest rejected guess in an open square can be re-graded, once.',
        },
        409,
      );
    if (!getGradingConfig().key)
      return json({ error: 'Grading is not connected yet.' }, 503);
    const db = getDb();
    lease = crypto.randomUUID();
    const acquired = await db
      .prepare(
        'UPDATE boards SET lease = ?, lease_until = ? WHERE id = ? AND lease_until < ? AND answers = ? AND attempts IS ? RETURNING id',
      )
      .bind(lease, Date.now() + 140000, id, Date.now(), b.answers, b.attempts)
      .first();
    if (!acquired)
      return json(
        {
          error:
            'Another answer is being saved. Wait a moment, then try again.',
        },
        409,
      );
    const quota = await db
      .prepare(
        'INSERT INTO quotas (id,used) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used < 45 RETURNING used',
      )
      .bind(`grading:${new Date().toISOString().slice(0, 10)}`)
      .first();
    if (!quota)
      return json(
        {
          error: 'Today’s grading allowance has been used. Try again tomorrow.',
        },
        429,
      );
    // Fresh evaluation: never reuse the cached grade or suggest a desired verdict.
    const result = await grade(
      getPuzzle(b.puzzle_id)!,
      previous.cell,
      previous.title,
      previous.artist,
    );
    if (
      attempts.some((a) => a.accepted && a.canonicalKey === result.canonicalKey)
    )
      return json(
        {
          error:
            'That recording already fills another square. Your original guess is unchanged.',
        },
        409,
      );
    attempts[attemptIndex] = {
      ...result,
      accepted: acceptsAnswer(result),
      regraded: true,
    };
    const updated = await db
      .prepare(
        'UPDATE boards SET answers = ?, attempts = ?, lease = NULL, lease_until = 0 WHERE id = ? AND lease = ? RETURNING id',
      )
      .bind(
        JSON.stringify(attempts.filter((a) => a.accepted)),
        JSON.stringify(attempts),
        id,
        lease,
      )
      .first();
    if (!updated)
      return json(
        {
          error:
            'Your session changed while grading. Reload before trying again.',
        },
        409,
      );
    return json(await publicBoard(req, (await readBoard(id))!));
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error && /judge|grade|Grading/.test(error.message)
            ? error.message
            : 'Could not re-grade this guess. Your original result is unchanged; please try again.',
      },
      503,
    );
  } finally {
    if (lease)
      await getDb()
        .prepare(
          'UPDATE boards SET lease = NULL, lease_until = 0 WHERE id = ? AND lease = ?',
        )
        .bind(id, lease)
        .run()
        .catch(() => {});
  }
}
