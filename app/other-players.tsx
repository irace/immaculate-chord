'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Info, Music2 } from 'lucide-react';
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

type Entry = {
  boardId: string;
  username: string;
  profileId?: string | null;
  score: number;
  filled: number;
  pick?: { title: string; artist: string; score: number; explanation: string };
};
export default function OtherPlayers({
  puzzleId,
  boardId,
  cell,
}: {
  puzzleId: string;
  boardId: string;
  cell?: number;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  async function fetchPage(after?: string) {
    const query = new URLSearchParams({ exclude: boardId });
    if (cell !== undefined) query.set('cell', String(cell));
    if (after) query.set('after', after);
    const response = await fetch(`/api/puzzles/${puzzleId}/community?${query}`);
    if (!response.ok) throw new Error('Could not load other players.');
    return response.json() as Promise<{
      entries: Entry[];
      next: string | null;
    }>;
  }
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError('');
    setEntries([]);
    setNext(null);
    fetchPage()
      .then((data) => {
        if (!cancelled) {
          setEntries(data.entries);
          setNext(data.next);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load other players.');
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [puzzleId, boardId, cell, retry]);
  async function more() {
    if (!next || busy) return;
    setBusy(true);
    setError('');
    try {
      const data = await fetchPage(next);
      setEntries((previous) => [...previous, ...data.entries]);
      setNext(data.next);
    } catch {
      setError('Could not load more players.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <TooltipProvider>
      <section
        className="other-players"
        aria-label={
          cell === undefined
            ? 'More takes on this grid'
            : 'Other players’ picks'
        }
      >
        <h3>
          {cell === undefined
            ? 'More takes on this grid'
            : 'Other players’ picks'}
        </h3>
        {entries.map((entry) => (
          <div
            className={`other-player${entry.pick ? ' with-pick' : ''}`}
            key={entry.boardId}
          >
            {entry.pick ? (
              <>
                <a
                  className="player-name"
                  href={
                    entry.profileId
                      ? `/players/${entry.profileId}`
                      : `/${puzzleId}/${entry.boardId}`
                  }
                >
                  {entry.username}
                </a>
                <div className="other-pick">
                  <span className="pick-song">
                    {entry.pick.title}
                    <small>{entry.pick.artist}</small>
                  </span>
                  <div className="pick-actions">
                    <strong>{entry.pick.score}%</strong>
                    <a
                      className="pick-icon"
                      href={`https://music.apple.com/us/search?term=${encodeURIComponent(`${entry.pick.title} ${entry.pick.artist}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Find ${entry.pick.title} on Apple Music`}
                      title="Apple Music"
                    >
                      <Music2 size={16} aria-hidden="true" />
                    </a>
                    <a
                      className="pick-icon"
                      href={`https://open.spotify.com/search/${encodeURIComponent(`${entry.pick.title} ${entry.pick.artist}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Find ${entry.pick.title} on Spotify`}
                      title="Spotify"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M6 9c4-1.5 8-1 12 1M7 12c3-1 7-.6 10 1M8 15c2.5-.6 5-.3 8 1" />
                      </svg>
                    </a>
                    <Tooltip>
                      <TooltipTrigger
                        className="pick-icon"
                        aria-label={`Why ${entry.pick.title} scored ${entry.pick.score}%`}
                      >
                        <Info size={16} aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent
                        className="pick-tooltip"
                        side="top"
                        align="end"
                      >
                        {entry.pick.explanation}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </>
            ) : (
              <div className="other-board">
                <span>
                  {entry.profileId ? (
                    <a href={`/players/${entry.profileId}`}>{entry.username}</a>
                  ) : (
                    entry.username
                  )}
                  <small>{entry.filled}/9 squares filled</small>
                </span>
                <a
                  className="other-board-link"
                  href={`/${puzzleId}/${entry.boardId}`}
                  aria-label={`View ${entry.username}’s board, ${entry.score} points`}
                >
                  <strong>
                    {entry.score}
                    <small> / 900</small>
                  </strong>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        ))}
        {!busy && !error && entries.length === 0 && (
          <p className="small-print">
            {cell === undefined
              ? 'No other finished boards yet.'
              : 'No other picks yet.'}
          </p>
        )}
        {busy && (
          <p className="small-print" role="status">
            Loading…
          </p>
        )}
        {error && (
          <p className="small-print" role="alert">
            {error}{' '}
            <button
              className="text-button"
              onClick={() =>
                entries.length ? void more() : setRetry((n) => n + 1)
              }
            >
              Retry
            </button>
          </p>
        )}
        {next && !busy && !error && (
          <button className="text-button" onClick={() => void more()}>
            Show more
          </button>
        )}
      </section>
    </TooltipProvider>
  );
}
