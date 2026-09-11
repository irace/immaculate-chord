'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown } from 'lucide-react';

type Entry = {
  boardId: string;
  username: string;
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
    <section
      className="other-players"
      aria-label={
        cell === undefined ? 'Other finished boards' : 'Other players’ picks'
      }
    >
      <h3>
        {cell === undefined ? 'Other finished boards' : 'Other players’ picks'}
      </h3>
      {entries.map((entry) => (
        <div
          className={`other-player${entry.pick ? ' with-pick' : ''}`}
          key={entry.boardId}
        >
          {entry.pick ? (
            <>
              <a className="player-name" href={`/${puzzleId}/${entry.boardId}`}>
                {entry.username}
              </a>
              <div className="pick-wrapper">
                <details className="other-pick">
                  <summary>
                    <span>
                      {entry.pick.title}
                      <small>{entry.pick.artist}</small>
                    </span>
                    <strong>{entry.pick.score}%</strong>
                    <ChevronDown size={14} aria-hidden="true" />
                  </summary>
                  <p className="pick-explanation">{entry.pick.explanation}</p>
                </details>
                <p className="hover-explanation" aria-hidden="true">
                  {entry.pick.explanation}
                </p>
              </div>
            </>
          ) : (
            <a className="other-board" href={`/${puzzleId}/${entry.boardId}`}>
              <span>
                {entry.username}
                <small>{entry.filled}/9 squares filled</small>
              </span>
              <strong>
                {entry.score}
                <small> / 900</small>
              </strong>
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
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
  );
}
