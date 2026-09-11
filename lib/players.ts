import { getDb } from '@/db';
import { boardAttempts, type BoardRow } from './server';
import { getPuzzle } from './puzzles';

export async function getPlayerProfile(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const user = await getDb()
    .prepare('SELECT id, username FROM users WHERE public_id = ?')
    .bind(id)
    .first<{ id: string; username: string }>();
  if (!user) return null;
  const result = await getDb()
    .prepare(
      'SELECT * FROM boards WHERE account_id = ? AND (locked=1 OR json_array_length(COALESCE(attempts,answers))>=9) ORDER BY puzzle_id',
    )
    .bind(user.id)
    .all<BoardRow>();
  const boards = result.results.map((board) => {
    const answers = boardAttempts(board).filter((a) => a.accepted);
    return {
      id: board.id,
      puzzleId: board.puzzle_id,
      title: getPuzzle(board.puzzle_id)?.title || board.puzzle_id,
      filled: answers.length,
      score: answers.reduce((sum, a) => sum + a.score, 0),
    };
  });
  return {
    username: user.username,
    profileId: id,
    boards,
    total: boards.reduce((sum, b) => sum + b.score, 0),
  };
}
