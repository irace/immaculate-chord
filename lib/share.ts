import { readBoard, boardAttempts } from './server';
import { getPuzzle } from './puzzles';

export const SHARE_ORIGIN = 'https://chord.irace.dev';
export async function finishedShare(puzzleId: string, boardId: string) {
  if (!/^[a-f0-9]{32}$/.test(boardId)) return null;
  const puzzle = getPuzzle(puzzleId);
  if (!puzzle) return null;
  const board = await readBoard(boardId);
  if (!board || board.puzzle_id !== puzzleId) return null;
  const attempts = boardAttempts(board);
  if (!board.locked && attempts.length < 9) return null;
  const answers = attempts.filter((a) => a.accepted);
  return {
    puzzle,
    answers,
    total: answers.reduce((sum, a) => sum + a.score, 0),
  };
}
