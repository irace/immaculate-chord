import type { Metadata } from 'next';
import { finishedShare, SHARE_ORIGIN } from '@/lib/share';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ puzzleId: string; boardId: string }>;
}): Promise<Metadata> {
  const { puzzleId, boardId } = await params;
  const share = await finishedShare(puzzleId, boardId);
  if (!share)
    return {
      title: 'Immaculate Chord — The music grid',
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  const title = `I scored ${share.total} on Immaculate Chord!`;
  const description = `${share.puzzle.title} · ${share.answers.length}/9 squares filled · ${share.total}/900 points. Play this music grid yourself.`;
  const url = `${SHARE_ORIGIN}/${puzzleId}/${boardId}`;
  const images = [
    {
      url: `${SHARE_ORIGIN}/api/share/${puzzleId}/${boardId}`,
      width: 1200,
      height: 630,
      alt: `${title} ${description}`,
    },
  ];
  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: 'Immaculate Chord',
      images,
    },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}
