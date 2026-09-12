'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Disc3,
  ArrowUpRight,
  Plus,
  Headphones,
  Lock,
  Check,
  ArrowRight,
  Copy,
  LoaderCircle,
  Music2,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import SongSearch from './song-search';
import type { CatalogHit, CatalogSelection } from '@/lib/catalog/types';
import Community from './community';
import OtherPlayers from './other-players';
import { puzzles, getPuzzle } from '@/lib/puzzles';
import type { Board } from '@/lib/game';
import { registerGameTools } from '@/lib/webmcp';
function ListenLinks({ title, artist }: { title: string; artist: string }) {
  const query = encodeURIComponent(`${title} ${artist}`);
  return (
    <div
      className="listen-links"
      aria-label={`Listen to ${title} by ${artist}`}
    >
      <a
        href={`https://music.apple.com/us/search?term=${query}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Find ${title} by ${artist} on Apple Music (opens in a new tab)`}
      >
        <Music2 size={14} />
        <span>Apple Music</span>
        <ArrowUpRight size={12} />
      </a>
      <a
        href={`https://open.spotify.com/search/${query}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Find ${title} by ${artist} on Spotify (opens in a new tab)`}
      >
        <Headphones size={14} />
        <span>Spotify</span>
        <ArrowUpRight size={12} />
      </a>
    </div>
  );
}
function getToken() {
  let token = localStorage.getItem('chord-owner');
  if (!token) {
    token =
      crypto.randomUUID().replace(/-/g, '') +
      crypto.randomUUID().replace(/-/g, '');
    localStorage.setItem('chord-owner', token);
  }
  return token;
}
async function request(url: string, token: string, body?: unknown) {
  const r = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await r.json()) as Board & { error?: string };
  if (!r.ok)
    throw new Error(data.error || 'Something went wrong. Please try again.');
  return data as Board;
}
export default function Game({
  initialPuzzle = '01',
  boardId,
}: {
  initialPuzzle?: string;
  boardId?: string;
}) {
  const [puzzleId, setPuzzleId] = useState(initialPuzzle),
    [board, setBoard] = useState<Board | null>(null),
    [cell, setCell] = useState<number | null>(null),
    [collection, setCollection] = useState(false),
    [help, setHelp] = useState(false),
    [completedSets, setCompletedSets] = useState<string[]>([]),
    [startedSets, setStartedSets] = useState<string[]>([]),
    [completionCounts, setCompletionCounts] = useState<Record<
      string,
      number
    > | null>(null),
    [setsStatus, setSetsStatus] = useState(''),
    [catalogPick, setCatalogPick] = useState<CatalogHit | null>(null),
    [title, setTitle] = useState(''),
    [artist, setArtist] = useState(''),
    [busy, setBusy] = useState(false),
    [regrading, setRegrading] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false),
    [shareText, setShareText] = useState(''),
    [themeName, setThemeName] = useState('Punk basement');
  const token = useRef(''),
    busyRef = useRef(false),
    generation = useRef(0);
  useEffect(() => {
    if (!collection) return;
    let cancelled = false;
    setCompletedSets([]);
    setStartedSets([]);
    setCompletionCounts(null);
    setSetsStatus('Loading set progress…');
    fetch('/api/boards', {
      headers: token.current
        ? { Authorization: `Bearer ${token.current}` }
        : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{
          completedPuzzleIds: string[];
          startedPuzzleIds: string[];
          otherCompletionCounts: Record<string, number>;
        }>;
      })
      .then((data) => {
        if (cancelled) return;
        setCompletedSets(data.completedPuzzleIds);
        setStartedSets(data.startedPuzzleIds);
        setCompletionCounts(data.otherCompletionCounts);
        setSetsStatus('');
      })
      .catch(() => {
        if (!cancelled)
          setSetsStatus(
            'Could not load set progress. Reopen the list to retry.',
          );
      });
    return () => {
      cancelled = true;
    };
  }, [collection]);
  const puzzle = getPuzzle(puzzleId)!;
  const answers = board?.answers || [];
  const selected = answers.find((a) => a.cell === cell);
  const attempts = board?.attempts || [];
  const lastRejected = [...attempts]
    .reverse()
    .find((a) => a.cell === cell && !a.accepted);
  const guessesLeft = board?.guessesLeft ?? 9;
  const complete = !!board?.locked;
  const readonly = !!board && !board.editable;
  const total = answers.reduce((sum, a) => sum + a.score, 0);
  const load = useCallback(async (id: string, existing?: string) => {
    const gen = ++generation.current;
    setLoading(true);
    setError('');
    setBoard(null);
    setCell(null);
    try {
      token.current = getToken();
    } catch {
      token.current = '';
    }
    try {
      if (!existing && !token.current)
        throw new Error(
          'Enable browser storage to keep your private editing credential. Shared boards can still be viewed.',
        );
      let data = existing
        ? await request(`/api/boards/${existing}`, token.current)
        : await request('/api/boards', token.current, {
            puzzleId: id,
            ownerToken: token.current,
          });
      if (data.resumeWithAccount) {
        data = await request('/api/boards', token.current, {
          puzzleId: id,
          ownerToken: token.current,
        });
        if (gen === generation.current)
          window.history.replaceState(null, '', `/${id}/${data.id}`);
      }
      if (gen !== generation.current) return;
      if (data.puzzleId !== id)
        throw new Error(
          'This board belongs to another puzzle. Check the shared link.',
        );
      setPuzzleId(id);
      setBoard(data);
      if (!existing) window.history.replaceState(null, '', `/${id}/${data.id}`);
    } catch (e) {
      if (gen === generation.current) setError((e as Error).message);
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load(initialPuzzle, boardId);
  }, [initialPuzzle, boardId, load]);
  async function playPuzzle(id: string) {
    try {
      const ownerToken = getToken();
      const ownBoard = await request('/api/boards', ownerToken, {
        puzzleId: id,
        ownerToken,
      });
      // Native navigation adds a history entry and restores shared boards on Back.
      window.location.assign(`/${id}/${ownBoard.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const submit = useCallback(
    async (
      songTitle: string,
      songArtist: string,
      index: number,
      catalog?: CatalogSelection,
    ) => {
      if (busyRef.current)
        throw new Error('An answer is already being graded.');
      if (!board?.editable || board.locked)
        throw new Error('This board is read-only.');
      if (!songTitle.trim() || !songArtist.trim())
        throw new Error('Enter both a song title and artist.');
      if (!Number.isInteger(index) || index < 0 || index > 8)
        throw new Error('Invalid square.');
      busyRef.current = true;
      setBusy(true);
      setError('');
      try {
        const data = await request(
          `/api/boards/${board.id}/answers`,
          token.current,
          { cell: index, title: songTitle, artist: songArtist, catalog },
        );
        setBoard(data);
        return {
          cell: index,
          answer: data.attempts[data.attempts.length - 1],
          locked: data.locked,
        };
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [board],
  );
  useEffect(
    () =>
      registerGameTools(
        () => ({ puzzle, board }),
        submit,
        (index: number) => {
          setCell(index);
          setTitle('');
          setCatalogPick(null);
          setArtist('');
          setError('');
        },
      ),
    [puzzle, board, submit],
  );
  function openCell(index: number) {
    setCell(index);
    setTitle('');
    setCatalogPick(null);
    setArtist('');
    setError('');
  }
  async function regrade() {
    if (!board?.isOwner || !lastRejected || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setRegrading(true);
    setError('');
    try {
      const data = await request(
        `/api/boards/${board.id}/regrade`,
        token.current,
        {
          attemptIndex: attempts.indexOf(lastRejected),
        },
      );
      setBoard(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
      setRegrading(false);
    }
  }
  async function clearBoard() {
    if (!board?.canClearBoard || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      setBoard(
        await request(`/api/boards/${board.id}/clear`, token.current, {}),
      );
      setCell(null);
      setTitle('');
      setCatalogPick(null);
      setArtist('');
      setShareText('');
      setCopied(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function share() {
    if (!board) return;
    const url = `${window.location.origin}/${puzzleId}/${board.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareText(url);
    }
  }
  return (
    <main className="shell">
      <header className="masthead">
        <a className="brand" href="/">
          <Disc3 />
          <span className="wordmark">
            <span>IMMACULATE</span>
            <span>CHORD</span>
          </span>
          <span className="beta">VOL. 01</span>
        </a>
        <button className="text-button" onClick={() => setHelp(true)}>
          How to play <ArrowUpRight size={16} />
        </button>
      </header>
      <Community
        puzzleId={puzzleId}
        disabled={busy}
        onThemeChange={setThemeName}
      />
      <div className="intro">
        <div>
          <p className="eyebrow">TONIGHT’S SET / PUZZLE {puzzle.id} OF 20</p>
          <h1>
            {puzzle.title}
            <span>.</span>
          </h1>
          <p>{puzzle.subtitle}</p>
        </div>
        <button
          className="outline-button"
          onClick={() => setCollection(true)}
          disabled={busy}
        >
          Pick a different set <ArrowUpRight size={17} />
        </button>
      </div>
      {error && cell === null && (
        <div role="alert" className="error-banner">
          {error}{' '}
          {!board && (
            <button onClick={() => void load(puzzleId, boardId)}>
              Try again
            </button>
          )}
        </div>
      )}
      <div className="workspace">
        <section aria-label="Music grid">
          <div className="board">
            <div aria-hidden="true" />
            {puzzle.cols.map((c) => (
              <div className="col-label" data-kind={c.kind} key={c.label}>
                <span className="tag" data-kind={c.kind}>
                  {c.kind.toUpperCase()}
                </span>
                {c.label}
              </div>
            ))}
            {puzzle.rows.map((r, ri) => (
              <div className="grid-row" key={r.label}>
                <div className="row-label">
                  <span className="tag" data-kind={r.kind}>
                    {r.kind.toUpperCase()}
                  </span>
                  {r.label}
                </div>
                {puzzle.cols.map((c, ci) => {
                  const index = ri * 3 + ci,
                    a = answers.find((x) => x.cell === index),
                    rejected = [...attempts]
                      .reverse()
                      .find((x) => x.cell === index && !x.accepted);
                  return (
                    <div
                      key={c.label}
                      className={`cell-shell ${a ? 'has-song' : ''}`}
                    >
                      <button
                        className={`cell ${a ? 'filled' : rejected ? 'rejected-cell' : ''}`}
                        disabled={loading || !board || busy}
                        onClick={() => openCell(index)}
                        aria-label={`${r.label} and ${c.label}${a ? `: ${a.title} by ${a.artist}, ${a.score} percent` : rejected ? `: rejected guess ${rejected.title} by ${rejected.artist}` : ': empty square'}`}
                      >
                        {a ? (
                          <>
                            <span className="cell-grade">
                              {a.score}
                              <small>%</small>
                            </span>
                            <strong>{a.title}</strong>
                            <span className="cell-artist">{a.artist}</span>
                            <Lock className="cell-lock" size={12} />
                          </>
                        ) : rejected ? (
                          <>
                            <span className="rejected-label">Not a match</span>
                            <strong>{rejected.title}</strong>
                            <span className="cell-artist">
                              {rejected.artist}
                            </span>
                            <span className="retry-label">
                              {readonly ? 'View guess' : 'Try another song'}
                            </span>
                          </>
                        ) : (
                          <>
                            {readonly ? <Lock /> : <Plus />}
                            <span>
                              {readonly
                                ? 'Empty · 0 pts'
                                : loading
                                  ? 'Opening…'
                                  : attempts.some(
                                        (a) => a.cell === index && !a.accepted,
                                      )
                                    ? 'Try again'
                                    : 'Add a song'}
                            </span>
                          </>
                        )}
                      </button>
                      {a && readonly && (
                        <ListenLinks title={a.title} artist={a.artist} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
        <div className="session-sidebar">
          <aside className="score-panel">
            {complete && board?.player && (
              <p className="board-player">
                {board.player.profileId ? (
                  <a href={`/players/${board.player.profileId}`}>
                    {board.player.username} ↗
                  </a>
                ) : (
                  board.player.username
                )}
              </p>
            )}
            <p className="eyebrow session-status">
              {complete ? (
                <>
                  <Check size={16} aria-hidden="true" /> Finished
                </>
              ) : readonly ? (
                'SHARED SESSION'
              ) : (
                'YOUR SESSION'
              )}
            </p>
            <div
              className={`score-number${complete ? ' final-score' : ''}`}
              aria-label={
                complete
                  ? `Final score: ${total} out of 900`
                  : `${guessesLeft} guesses remaining out of 9`
              }
            >
              {complete ? total : guessesLeft}
              <span>/ {complete ? 900 : 9}</span>
            </div>
            {complete ? (
              <p>Final score</p>
            ) : (
              guessesLeft > 0 && (
                <p>
                  {guessesLeft} {guessesLeft === 1 ? 'guess' : 'guesses'} left ·{' '}
                  {9 - guessesLeft} used
                </p>
              )
            )}
            <p className="small-print">{answers.length}/9 squares filled</p>
            <div className="ticks" aria-hidden="true">
              {Array.from({ length: 9 }, (_, i) => (
                <i
                  key={i}
                  className={
                    i < attempts.length
                      ? attempts[i].accepted
                        ? 'done'
                        : 'missed'
                      : ''
                  }
                />
              ))}
            </div>
            {!complete && attempts.length > 0 && (
              <div className="total">
                <span>Total score</span>
                <strong>
                  {total}
                  <small> / 900</small>
                </strong>
              </div>
            )}
            {complete && (
              <>
                <button className="primary-button" onClick={() => void share()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                  {copied ? 'Link copied' : 'Copy public link'}
                </button>
              </>
            )}
            {readonly && !complete && (
              <p className="small-print">
                This player is still working on their grid.
              </p>
            )}
            {readonly && !board?.isOwner && (
              <button
                className="outline-button"
                onClick={() => {
                  void playPuzzle(puzzleId);
                }}
              >
                Play this grid yourself <ArrowRight size={16} />
              </button>
            )}
            {board && !board.gradingReady && (
              <div className="note">
                The judge isn’t connected yet. You can explore every puzzle and
                compose a pick. Submitting and scoring will open soon.
              </div>
            )}
            {loading && <p role="status">Opening your session…</p>}
          </aside>
          {complete && board && (
            <OtherPlayers
              key={board.id}
              puzzleId={puzzleId}
              boardId={board.id}
            />
          )}
          <p className="theme-credit" aria-live="polite">
            Theme: {themeName}
          </p>
          {board?.canClearBoard && (
            <button
              className="local-reset"
              disabled={busy || loading}
              onClick={clearBoard}
            >
              <RotateCcw size={13} aria-hidden="true" /> Clear board
            </button>
          )}
        </div>
      </div>
      <Dialog
        open={cell !== null}
        onOpenChange={(o) => {
          if (!o && !busy) {
            setCell(null);
            setError('');
          }
        }}
      >
        <DialogContent className="song-dialog">
          <DialogTitle>
            {selected
              ? 'Behind the pick'
              : readonly
                ? complete
                  ? 'No guesses left'
                  : 'An open square'
                : 'What’s your pick?'}
          </DialogTitle>
          {cell !== null && (
            <DialogDescription render={<div />} className="prompt-detail">
              <p>
                <b>
                  {puzzle.rows[Math.floor(cell / 3)].kind === 'fact'
                    ? 'The fact'
                    : 'The feeling'}
                  : {puzzle.rows[Math.floor(cell / 3)].label}
                </b>
                {puzzle.rows[Math.floor(cell / 3)].rule}
              </p>
              <p>
                <b>
                  {puzzle.cols[cell % 3].kind === 'fact'
                    ? 'The fact'
                    : 'The feeling'}
                  : {puzzle.cols[cell % 3].label}
                </b>
                {puzzle.cols[cell % 3].rule}
              </p>
            </DialogDescription>
          )}
          {!selected && lastRejected && (
            <div className="rejected-pick" role="status">
              <strong>Not a match · one guess used</strong>
              <p>
                {lastRejected.title} — {lastRejected.artist}
              </p>
              <p>{lastRejected.explanation}</p>
              {!!lastRejected.factSources?.length && (
                <p className="small-print">
                  {lastRejected.factSources.map((fact, index) => (
                    <a
                      key={index}
                      href={fact.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {index ? ' · ' : ''}Catalog source
                    </a>
                  ))}
                </p>
              )}
              {board?.isOwner &&
                (lastRejected.regraded ? (
                  <p className="small-print">
                    Re-graded · still not a match. No extra guess used.
                  </p>
                ) : (
                  <div className="regrade-action">
                    <p>
                      Think the judge got this wrong? Re-evaluate this same
                      guess once, without using another guess.
                    </p>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy || !board.gradingReady}
                      onClick={() => void regrade()}
                    >
                      {regrading ? 'Re-evaluating…' : 'Re-grade'}
                    </button>
                  </div>
                ))}
            </div>
          )}
          {error && readonly && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {selected ? (
            <div className="grade-detail">
              <div className="result-score">
                {selected.score}
                <span>%</span>
              </div>
              <h2>{selected.title}</h2>
              <p className="artist-name">{selected.artist}</p>
              <ListenLinks title={selected.title} artist={selected.artist} />
              <div className="grade-stats">
                <span>
                  Row fit<strong>{selected.rowFit}%</strong>
                </span>
                <span>
                  Column fit<strong>{selected.colFit}%</strong>
                </span>
                <span>
                  Obscurity<strong>{selected.obscurity}%</strong>
                </span>
              </div>
              <p>{selected.explanation}</p>
              {!!selected.factSources?.length && (
                <p className="small-print">
                  {selected.factSources.map((fact, index) => (
                    <a
                      key={index}
                      href={fact.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {index ? ' · ' : ''}Catalog source
                      {selected.factSources!.length > 1 ? ` ${index + 1}` : ''}
                    </a>
                  ))}
                </p>
              )}
              {board && (
                <OtherPlayers
                  key={`${board.id}:${selected.cell}`}
                  puzzleId={puzzleId}
                  boardId={board.id}
                  cell={selected.cell}
                />
              )}
            </div>
          ) : readonly ? (
            <p>
              {complete
                ? 'This square finished empty and contributes 0 points.'
                : 'This player hasn’t filled this square yet.'}
            </p>
          ) : (
            <form
              onKeyDown={(e) => {
                if (
                  e.key !== 'Enter' ||
                  !e.metaKey ||
                  e.nativeEvent.isComposing
                )
                  return;
                e.preventDefault();
                if (
                  e.repeat ||
                  busy ||
                  !board?.gradingReady ||
                  !title.trim() ||
                  !artist.trim()
                )
                  return;
                e.currentTarget.requestSubmit();
              }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (cell === null) return;
                try {
                  if (!catalogPick)
                    throw new Error(
                      'Choose a recording from the search results.',
                    );
                  await submit(title, artist, cell, {
                    provider: catalogPick.provider,
                    id: catalogPick.id,
                  });
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <SongSearch
                key={cell}
                value={catalogPick}
                disabled={busy}
                onChange={(pick) => {
                  setCatalogPick(pick);
                  setTitle(pick?.title || '');
                  setArtist(pick?.artist || '');
                  setError('');
                }}
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary-button"
                disabled={
                  busy ||
                  !board?.gradingReady ||
                  !title.trim() ||
                  !artist.trim()
                }
              >
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={17} /> Listening
                    closely…
                  </>
                ) : (
                  <>
                    Submit guess <ArrowRight size={17} />
                  </>
                )}
              </button>
              {!board?.gradingReady && (
                <p className="small-print">
                  Grading is not connected yet. Your square will stay open.
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={collection} onOpenChange={setCollection}>
        <DialogContent className="collection-dialog">
          <DialogTitle>The puzzle collection</DialogTitle>
          <DialogDescription>
            Twenty ways to connect the dots. Pick a grid; your progress saves as
            you play.
          </DialogDescription>
          {setsStatus && (
            <p className="small-print" role="status">
              {setsStatus}
            </p>
          )}
          <div className="puzzle-list">
            {puzzles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCollection(false);
                  void playPuzzle(p.id);
                }}
                className={p.id === puzzleId ? 'active' : ''}
              >
                <span className="puzzle-number">{p.id}</span>
                <span>
                  <strong>{p.title}</strong>
                  <small>{p.subtitle}</small>
                  {completedSets.includes(p.id) ? (
                    <span className="set-complete">
                      <Check size={13} aria-hidden="true" /> Completed
                    </span>
                  ) : startedSets.includes(p.id) ? (
                    <span className="set-complete">In progress</span>
                  ) : null}
                  {completionCounts !== null && (
                    <small>
                      {completionCounts[p.id] || 0} other{' '}
                      {(completionCounts[p.id] || 0) === 1
                        ? 'player has'
                        : 'players have'}{' '}
                      completed this set
                    </small>
                  )}
                </span>
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="song-dialog">
          <DialogTitle>Nine songs. Make them count.</DialogTitle>
          <DialogDescription>
            A music grid for what you know—and what you feel.
          </DialogDescription>
          <ol className="rules">
            <li>
              <b>Find the intersection.</b> Pick a song that fits its row and
              column. Facts are literal; feelings leave room for interpretation.
            </li>
            <li>
              <b>Choose your recording.</b> Search for a song or artist and
              select the matching recording. Every genre, language and era is
              welcome. No repeat recordings on a board.
            </li>
            <li>
              <b>Nine guesses total.</b> An accepted answer fills and locks its
              square. A rejected answer uses a guess but leaves the square open:
              try it again or move to another. Duplicate songs and
              grading-service failures and unverified catalog facts don’t use a
              guess.
            </li>
            <li>
              <b>Finish your set.</b> After nine guesses, new submissions close.
              Empty squares contribute zero. You can re-grade the latest
              rejected guess in an empty square once, without using another
              guess—even after finishing. Share your result and compare notes.
            </li>
          </ol>
          <p className="how-scoring">
            Match both prompts to score well. The weaker match determines your
            base score, and an obscure pick earns a bonus. A zero fit on either
            prompt rejects the answer; partial vibe matches can still score.
            Obscurity is an AI estimate, not a popularity percentile.
          </p>
          <div className="note">
            Scoring: the lower of the two fit ratings × (0.6 + 0.4 × obscurity /
            100), rounded to 1–100 for accepted answers. A perfect fit scores
            60–100. Rejected answers add no points.
          </div>
          <p className="small-print">
            Accounts save one run per puzzle and add finished scores to the
            leaderboards. Guests can play without signing in. For guests, your
            browser holds your private editing credential. Clearing browser
            storage loses editing access; save your finished link.
          </p>
          <section aria-labelledby="known-limitations">
            <h3 id="known-limitations">Known limitations</h3>
            <p className="small-print">
              Scores reflect an AI’s judgment and may get facts or musical taste
              wrong. It can get release dates flat-out wrong, accepting a song
              from the wrong decade or rejecting one from the right decade.
              Dates are not currently verified against a music catalog.
            </p>
          </section>
        </DialogContent>
      </Dialog>
      <Dialog open={!!shareText} onOpenChange={(o) => !o && setShareText('')}>
        <DialogContent>
          <DialogTitle>Your read-only grid link</DialogTitle>
          <DialogDescription>
            Copy this link to share your finished board.
          </DialogDescription>
          <input
            aria-label="Share link"
            readOnly
            value={shareText}
            onFocus={(e) => e.target.select()}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
