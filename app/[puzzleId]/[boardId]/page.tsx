import Game from '@/app/game';
import { getPuzzle } from '@/lib/puzzles';
import { notFound } from 'next/navigation';
export default async function BoardPage({
  params,
}: {
  params: Promise<{ puzzleId: string; boardId: string }>;
}) {
  const { puzzleId, boardId } = await params;
  if (!getPuzzle(puzzleId) || !/^[a-f0-9]{32}$/.test(boardId)) notFound();
  return <Game initialPuzzle={puzzleId} boardId={boardId} />;
}
