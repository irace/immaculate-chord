import { prepareCatalog, validSelection } from '@/lib/catalog';
import { getDb, getGradingConfig } from '@/db';
import {
  hash,
  json,
  readBoard,
  publicBoard,
  owns,
  sameOrigin,
  boardAttempts,
} from '@/lib/server';
import { getPuzzle } from '@/lib/puzzles';
import {
  scoreAnswer,
  validText,
  normalizeSong,
  acceptsAnswer,
  type Answer,
} from '@/lib/game';
import { grade } from '@/lib/grader';
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let lease: string | undefined;
  if (!sameOrigin(req))
    return json({ error: 'Request origin is not allowed.' }, 403);
  try {
    const b = await readBoard(id);
    if (!b) return json({ error: 'Board not found.' }, 404);
    if (!(await owns(req, b)))
      return json({ error: 'This shared board is read-only.' }, 403);
    const attempts = boardAttempts(b);
    if (b.locked || attempts.length >= 9)
      return json({ error: 'This board is complete and locked.' }, 409);
    const {
      cell,
      title,
      artist,
      catalog: selection,
    } = (await req.json()) as {
      catalog?: unknown;
      cell: number;
      title: unknown;
      artist: unknown;
    };
    if (
      (selection !== undefined && !validSelection(selection)) ||
      !Number.isInteger(cell) ||
      cell < 0 ||
      cell > 8 ||
      !validText(title) ||
      !validText(artist)
    )
      return json({ error: 'Enter a song title and artist.' }, 400);
    const answers: Answer[] = attempts.filter((a) => a.accepted);
    if (answers.some((a) => a.cell === cell))
      return json({ error: 'That square is already locked.' }, 409);
    if (
      answers.some((a) =>
        validSelection(selection) && a.catalog
          ? a.catalog.provider === selection.provider &&
            a.catalog.id === selection.id
          : normalizeSong(a.title, a.artist) === normalizeSong(title, artist),
      )
    )
      return json(
        { error: 'That song is already on your board. Choose another.' },
        409,
      );
    if (!getGradingConfig().key)
      return json(
        { error: 'Grading is not connected yet. Your square is still open.' },
        503,
      );
    lease = crypto.randomUUID();
    const db = getDb();
    const acquired = await db
      .prepare(
        'UPDATE boards SET lease = ?, lease_until = ? WHERE id = ? AND locked = 0 AND lease_until < ? AND answers = ? AND attempts IS ? RETURNING id',
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
    const p = getPuzzle(b.puzzle_id)!;
    const catalog = await prepareCatalog(
      p,
      cell,
      title.trim(),
      artist.trim(),
      validSelection(selection) ? selection : undefined,
    );
    const cacheKey = await hash(
      JSON.stringify({
        version: 4,
        catalog,
        puzzle: p.id,
        cell,
        row: p.rows[Math.floor(cell / 3)],
        column: p.cols[cell % 3],
        song: normalizeSong(title, artist),
        model: getGradingConfig().model,
      }),
    );
    const cached = await db
      .prepare('SELECT result FROM grades WHERE id = ?')
      .bind(cacheKey)
      .first<{ result: string }>();
    let result: Answer;
    if (cached) {
      result = JSON.parse(cached.result);
      result.score = scoreAnswer(
        result.rowFit,
        result.colFit,
        result.obscurity,
      );
    } else {
      const quota = await db
        .prepare(
          'INSERT INTO quotas (id,used) VALUES (?,1) ON CONFLICT(id) DO UPDATE SET used=used+1 WHERE used < 500 RETURNING used',
        )
        .bind(`grading:${new Date().toISOString().slice(0, 10)}`)
        .first();
      if (!quota)
        return json(
          {
            error:
              'Immaculate Chord limits how many requests can be made per day to keep costs down during this beta period. Please come back to play some more tomorrow.',
          },
          429,
        );
      result = await grade(p, cell, title.trim(), artist.trim(), catalog);
      await db
        .prepare('INSERT OR IGNORE INTO grades (id,result) VALUES (?,?)')
        .bind(cacheKey, JSON.stringify(result))
        .run();
    }
    if (answers.some((a) => a.canonicalKey === result.canonicalKey))
      return json(
        {
          error:
            'That recording is already on your board under another spelling. Choose another song.',
        },
        409,
      );
    const accepted = acceptsAnswer(result);
    attempts.push({ ...result, accepted });
    if (accepted) answers.push(result);
    const updated = await db
      .prepare(
        'UPDATE boards SET answers = ?, attempts = ?, locked = ?, lease = NULL, lease_until = 0 WHERE id = ? AND lease = ? AND locked = 0 RETURNING id',
      )
      .bind(
        JSON.stringify(answers),
        JSON.stringify(attempts),
        attempts.length >= 9 ? 1 : 0,
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
          error instanceof Error &&
          /judge|grade|Grading|Catalog|catalog|recording/.test(error.message)
            ? error.message
            : 'Could not save your answer. Your square is still open; please try again.',
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
