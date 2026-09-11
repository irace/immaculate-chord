import { getDb } from '@/db';
import { getPuzzle } from '@/lib/puzzles';
import { boardAttempts, json, type BoardRow } from '@/lib/server';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getPuzzle(id)) return json({ error: 'Unknown puzzle.' }, 404);
  const search = new URL(req.url).searchParams;
  const cellText = search.get('cell');
  const cell = cellText === null ? null : Number(cellText);
  const after = search.get('after');
  const exclude = search.get('exclude');
  if (
    (cellText !== null && !/^[0-8]$/.test(cellText)) ||
    (after !== null && !/^[a-f0-9]{32}$/.test(after)) ||
    (exclude !== null && !/^[a-f0-9]{32}$/.test(exclude))
  )
    return json({ error: 'Invalid comparison request.' }, 400);
  try {
    const result = await getDb()
      .prepare(`
      SELECT b.*, u.username FROM boards b LEFT JOIN users u ON u.id=b.account_id
      WHERE b.puzzle_id=? AND (b.locked=1 OR json_array_length(COALESCE(b.attempts,b.answers))>=9)
      ${exclude ? 'AND b.id != ?' : ''}
      ${after ? 'AND b.id > ?' : ''}
      ${
        cell !== null
          ? `AND EXISTS (SELECT 1 FROM json_each(COALESCE(b.attempts,b.answers)) a
        WHERE json_extract(a.value,'$.cell')=? AND json_extract(a.value,'$.rowFit')>0 AND json_extract(a.value,'$.colFit')>0)`
          : ''
      }
      ORDER BY b.id LIMIT 31
    `)
      .bind(
        id,
        ...(exclude ? [exclude] : []),
        ...(after ? [after] : []),
        ...(cell !== null ? [cell] : []),
      )
      .all<BoardRow & { username: string | null }>();
    const rows = result.results.slice(0, 30);
    const entries = rows.map((b) => {
      const answers = boardAttempts(b).filter((a) => a.accepted);
      const answer =
        cell === null ? null : answers.find((a) => a.cell === cell);
      return {
        boardId: b.id,
        username: b.username || 'Guest',
        score: answers.reduce((sum, a) => sum + a.score, 0),
        filled: answers.length,
        ...(answer
          ? {
              pick: {
                title: answer.title,
                artist: answer.artist,
                score: answer.score,
                explanation: answer.explanation,
              },
            }
          : {}),
      };
    });
    return json({
      entries,
      next: result.results.length > 30 ? rows[rows.length - 1].id : null,
    });
  } catch {
    return json({ error: 'Could not load other players’ boards.' }, 503);
  }
}
