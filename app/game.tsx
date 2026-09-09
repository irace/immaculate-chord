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
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { puzzles, getPuzzle } from '@/lib/puzzles';
import type { Board } from '@/lib/game';
import { registerGameTools } from '@/lib/webmcp';
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
    [title, setTitle] = useState(''),
    [artist, setArtist] = useState(''),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false),
    [shareText, setShareText] = useState('');
  const token = useRef(''),
    busyRef = useRef(false),
    generation = useRef(0);
  const puzzle = getPuzzle(puzzleId)!;
  const answers = board?.answers || [];
  const selected = answers.find((a) => a.cell === cell);
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
      const data = existing
        ? await request(`/api/boards/${existing}`, token.current)
        : await request('/api/boards', token.current, {
            puzzleId: id,
            ownerToken: token.current,
          });
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
  const submit = useCallback(
    async (songTitle: string, songArtist: string, index: number) => {
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
          { cell: index, title: songTitle, artist: songArtist },
        );
        setBoard(data);
        return {
          cell: index,
          answer: data.answers.find((a) => a.cell === index),
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
          setArtist('');
          setError('');
        },
      ),
    [puzzle, board, submit],
  );
  function openCell(index: number) {
    setCell(index);
    setTitle('');
    setArtist('');
    setError('');
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
          <Disc3 /> IMMACULATE CHORD<span className="beta">VOL. 01</span>
        </a>
        <button className="text-button" onClick={() => setHelp(true)}>
          How to play <ArrowUpRight size={16} />
        </button>
      </header>
      <div className="intro">
        <div>
          <p className="eyebrow">THE MUSIC GRID / PUZZLE {puzzle.id} OF 20</p>
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
          The puzzle collection <ArrowUpRight size={17} />
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
            <div className="corner">
              <Headphones />
              <span>
                FIND YOUR
                <br />
                INTERSECTION
              </span>
            </div>
            {puzzle.cols.map((c) => (
              <div className="col-label" key={c.label}>
                <span className="tag">{c.kind.toUpperCase()}</span>
                {c.label}
              </div>
            ))}
            {puzzle.rows.map((r, ri) => (
              <div className="grid-row" key={r.label}>
                <div className="row-label">
                  <span className="tag">{r.kind.toUpperCase()}</span>
                  {r.label}
                </div>
                {puzzle.cols.map((c, ci) => {
                  const index = ri * 3 + ci,
                    a = answers.find((x) => x.cell === index);
                  return (
                    <button
                      key={c.label}
                      className={`cell ${a ? 'filled' : ''}`}
                      disabled={loading || !board || busy}
                      onClick={() => openCell(index)}
                      aria-label={`${r.label} and ${c.label}${a ? `: ${a.title} by ${a.artist}, ${a.score} percent` : ': empty square'}`}
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
                      ) : (
                        <>
                          {readonly ? <Lock /> : <Plus />}
                          <span>
                            {readonly
                              ? 'No song'
                              : loading
                                ? 'Opening…'
                                : 'Add a song'}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="board-caption">
            <span>
              {complete
                ? 'Complete. Locked. Unmistakably yours.'
                : readonly
                  ? 'Shared session · read-only'
                  : 'One song per square. No repeats.'}
            </span>
            <span>YOUR TASTE. YOUR NINE.</span>
          </div>
        </section>
        <aside className="score-panel">
          <p className="eyebrow">
            {complete
              ? 'THE FINISHED SET'
              : readonly
                ? 'SHARED SESSION'
                : 'YOUR SESSION'}
          </p>
          <div className="score-number">
            {answers.length}
            <span>/ 9</span>
          </div>
          <p>Songs on the board</p>
          <div className="ticks" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => (
              <i key={i} className={i < answers.length ? 'done' : ''} />
            ))}
          </div>
          {answers.length > 0 && (
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
              <p className="complete-note">
                <Check size={16} /> Your nine are locked in.
              </p>
              <button className="primary-button" onClick={() => void share()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                {copied ? 'Link copied' : 'Share your grid'}
              </button>
              <p className="small-print">
                Anyone with the link can view your finished grid.
              </p>
            </>
          )}
          {readonly && !complete && (
            <p className="small-print">
              This player is still working on their grid.
            </p>
          )}
          {readonly && (
            <button
              className="outline-button"
              onClick={() => {
                window.location.assign('/');
              }}
            >
              Play your own grid <ArrowRight size={16} />
            </button>
          )}
          <div className="score-divider" />
          <p className="eyebrow">THE PERFECT PICK</p>
          <h2>
            Fits the brief.
            <br />
            Digs a little deeper.
          </h2>
          <p>
            Match both prompts to score well. An unexpected pick adds a little
            extra.
          </p>
          <div className="legend">
            <span>
              <i className="fit-dot" />
              80% fit
            </span>
            <span>
              <i />
              20% deep cut
            </span>
          </div>
          <p className="small-print">
            The weaker match sets your ceiling. Obscurity is an AI estimate, not
            a popularity percentile.
          </p>
          {board && !board.gradingReady && (
            <div className="note">
              The judge isn’t connected yet. You can explore every puzzle and
              compose a pick. Submitting and scoring will open soon.
            </div>
          )}
          {loading && <p role="status">Opening your session…</p>}
        </aside>
      </div>
      <footer>
        <span>A LITTLE KNOWLEDGE. A LOT OF LISTENING.</span>
        <span>Facts × feelings × deep cuts</span>
      </footer>
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
                ? 'An open square'
                : 'What’s your pick?'}
          </DialogTitle>
          <DialogDescription>
            {cell !== null &&
              `${puzzle.rows[Math.floor(cell / 3)].label} × ${puzzle.cols[cell % 3].label}`}
          </DialogDescription>
          {cell !== null && (
            <div className="prompt-detail">
              <p>
                <b>
                  {puzzle.rows[Math.floor(cell / 3)].kind === 'fact'
                    ? 'The fact'
                    : 'The feeling'}
                </b>
                {puzzle.rows[Math.floor(cell / 3)].rule}
              </p>
              <p>
                <b>
                  {puzzle.cols[cell % 3].kind === 'fact'
                    ? 'The fact'
                    : 'The feeling'}
                </b>
                {puzzle.cols[cell % 3].rule}
              </p>
            </div>
          )}
          {selected ? (
            <div className="grade-detail">
              <div className="result-score">
                {selected.score}
                <span>%</span>
              </div>
              <h2>{selected.title}</h2>
              <p className="artist-name">{selected.artist}</p>
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
              <p className="small-print">
                <Lock size={12} /> Answer locked · AI judgment can be imperfect.
              </p>
            </div>
          ) : readonly ? (
            <p>This player hasn’t filled this square yet.</p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (cell === null) return;
                try {
                  await submit(title, artist, cell);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <label htmlFor="song-title">Song title</label>
              <input
                id="song-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The song you have in mind"
                maxLength={160}
                required
                disabled={busy}
              />
              <label htmlFor="song-artist">Artist</label>
              <input
                id="song-artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Who’s it by?"
                maxLength={160}
                required
                disabled={busy}
              />
              <p className="small-print">
                For a live version or cover, include the recording or release in
                the title.
              </p>
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
                    Submit & lock answer <ArrowRight size={17} />
                  </>
                )}
              </button>
              <p className="small-print">
                {board?.gradingReady
                  ? 'Once graded, this pick is final—even if it misses the brief.'
                  : 'Grading is not connected yet. Your square will stay open.'}
              </p>
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
          <div className="puzzle-list">
            {puzzles.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setCollection(false);
                  void load(p.id);
                }}
                className={p.id === puzzleId ? 'active' : ''}
              >
                <span className="puzzle-number">{p.id}</span>
                <span>
                  <strong>{p.title}</strong>
                  <small>{p.subtitle}</small>
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
              <b>Name your recording.</b> Enter a title and artist. Every genre,
              language and era is welcome. No repeat recordings on a board.
            </li>
            <li>
              <b>Commit to the pick.</b> Each submitted answer gets an AI score
              and locks. Failed grading requests leave the square open.
            </li>
            <li>
              <b>Finish your nine.</b> Your completed board locks automatically.
              Share its read-only link and compare notes.
            </li>
          </ol>
          <div className="note">
            Scoring: the lower of the two fit ratings × (0.8 + 0.2 × obscurity /
            100), rounded to 1–100. A perfect fit scores 80–100. A wrong answer
            stays near the bottom.
          </div>
          <p className="small-print">
            No account needed. Your browser holds your private editing
            credential. Clearing browser storage loses editing access; save your
            finished link. Scores reflect an AI’s judgment and may get facts or
            musical taste wrong.
          </p>
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
