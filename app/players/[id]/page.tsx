import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowUpRight, Disc3, Check } from 'lucide-react';
import { getPlayerProfile } from '@/lib/players';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const player = await getPlayerProfile((await params).id);
  return {
    title: player
      ? `${player.username} — Immaculate Chord`
      : 'Player not found',
    description: 'Completed music grids on Immaculate Chord.',
  };
}
export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const player = await getPlayerProfile((await params).id);
  if (!player) notFound();
  return (
    <main className="shell profile-page">
      <header className="masthead">
        <a className="profile-home" href="/">
          <Disc3 size={36} aria-hidden="true" /> Immaculate Chord
        </a>
        <a className="outline-button" href="/">
          Play a grid <ArrowUpRight size={16} />
        </a>
      </header>
      <section className="profile-heading">
        <p className="eyebrow">THE PLAYER</p>
        <h1>{player.username}</h1>
        <p>
          {player.boards.length} completed{' '}
          {player.boards.length === 1 ? 'grid' : 'grids'} · {player.total} total
          points
        </p>
      </section>
      <section aria-labelledby="completed-grids">
        <h2 id="completed-grids">Completed grids</h2>
        {player.boards.length ? (
          <div className="profile-boards">
            {player.boards.map((board) => (
              <a
                className="profile-board"
                key={board.id}
                href={`/${board.puzzleId}/${board.id}`}
              >
                <span className="eyebrow">SET {board.puzzleId}</span>
                <h3>{board.title}</h3>
                <div className="profile-board-score">
                  {board.score}
                  <small> / 900</small>
                </div>
                <div className="profile-board-footer">
                  <span>
                    <Check size={14} /> {board.filled}/9 squares filled
                  </span>
                  <ArrowUpRight size={20} aria-hidden="true" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="small-print">No completed grids yet.</p>
        )}
      </section>
    </main>
  );
}
