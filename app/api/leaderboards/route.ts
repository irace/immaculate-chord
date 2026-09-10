import { getDb } from '@/db';
import { json } from '@/lib/server';
import { getPuzzle } from '@/lib/puzzles';
export async function GET(req: Request) {
  const puzzle = new URL(req.url).searchParams.get('puzzle');
  if (puzzle && !getPuzzle(puzzle))
    return json({ error: 'Unknown puzzle.' }, 400);
  // Only server-saved, finished runs count. Never accept client-supplied scores.
  const result = await getDb()
    .prepare(`
    WITH finished AS (
      SELECT b.id, b.puzzle_id, b.account_id,
        COALESCE((SELECT SUM(CAST(json_extract(a.value,'$.score') AS INTEGER))
          FROM json_each(COALESCE(b.attempts,b.answers)) a
          WHERE CAST(json_extract(a.value,'$.rowFit') AS INTEGER)>0
          AND CAST(json_extract(a.value,'$.colFit') AS INTEGER)>0),0) AS score
      FROM boards b WHERE b.account_id IS NOT NULL
        AND (b.locked=1 OR json_array_length(COALESCE(b.attempts,b.answers))>=9)
        ${puzzle ? 'AND b.puzzle_id = ?' : ''}
    ), totals AS (
      SELECT u.username, SUM(f.score) AS score, COUNT(*) AS completed,
        ${puzzle ? 'MAX(f.id)' : 'NULL'} AS boardId
      FROM finished f JOIN users u ON u.id=f.account_id GROUP BY u.id
    )
    SELECT *, DENSE_RANK() OVER (ORDER BY score DESC) AS rank FROM totals
    ORDER BY score DESC, username COLLATE NOCASE LIMIT 100
  `)
    .bind(...(puzzle ? [puzzle] : []))
    .all();
  return json({ entries: result.results });
}
