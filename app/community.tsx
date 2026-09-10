'use client';
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
const welcomeKey = 'chord-welcome-choice';
let welcomeAcknowledged = false;
function acknowledgeWelcome() {
  welcomeAcknowledged = true;
  try {
    localStorage.setItem(welcomeKey, '1');
  } catch {}
}
function hasSeenWelcome() {
  try {
    return welcomeAcknowledged || localStorage.getItem(welcomeKey) === '1';
  } catch {
    return welcomeAcknowledged;
  }
}
const themes = [
  ['punk', 'Punk basement', 'Torn flyers. Loud guitars.'],
  ['jazz', 'After-hours jazz', 'Blue notes and brass.'],
  ['disco', 'Disco fever', 'Mirror balls and velvet.'],
  ['synth', 'Midnight synth', 'Neon under a digital sky.'],
  ['folk', 'Folk sleeve', 'Warm paper and worn records.'],
  ['jam', 'Endless jam', 'Phish meets the Dead. Tie-dye after sundown.'],
  ['gizzard', 'Gizzverse', 'Acid green. Cosmic fuzz.'],
];
type Account = { signedIn: boolean; username: string | null; error?: string };
type Entry = {
  rank: number;
  username: string;
  score: number;
  completed: number;
  boardId: string | null;
};
export default function Community({
  puzzleId,
  disabled,
}: {
  puzzleId: string;
  disabled: boolean;
}) {
  const [panel, setPanel] = useState(''),
    [theme, setTheme] = useState('punk');
  const [account, setAccount] = useState<{
    signedIn: boolean;
    username: string | null;
  } | null>(null);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('puzzle'),
    [entries, setEntries] = useState<Entry[] | null>(null);
  const [returnTo, setReturnTo] = useState('/');
  useEffect(() => {
    setReturnTo(location.pathname);
    let choice = themes[Math.floor(Math.random() * themes.length)][0];
    try {
      const saved = localStorage.getItem('chord-theme');
      if (themes.some((t) => t[0] === saved)) choice = saved!;
    } catch {}
    document.documentElement.dataset.theme = choice;
    setTheme(choice);
    fetch('/api/account')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<Account>;
      })
      .then((a) => {
        setAccount(a);
        setReturnTo(location.pathname);
        if (a.signedIn) acknowledgeWelcome();
        else if (!hasSeenWelcome()) setPanel('welcome');
        if (new URLSearchParams(location.search).has('account'))
          history.replaceState(null, '', location.pathname);
      })
      .catch(() =>
        setError('Could not load your account. Reload to try again.'),
      );
  }, []);
  useEffect(() => {
    if (panel !== 'leaderboard') return;
    let active = true;
    setEntries(null);
    setError('');
    fetch(
      '/api/leaderboards' + (scope === 'puzzle' ? '?puzzle=' + puzzleId : ''),
    )
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<{ entries: Entry[] }>;
      })
      .then((d) => {
        if (active) setEntries(d.entries);
      })
      .catch(() => {
        if (active)
          setError('Could not load standings. Please reopen to retry.');
      });
    return () => {
      active = false;
    };
  }, [panel, scope, puzzleId]);
  function open(value: string) {
    setError('');
    setReturnTo(location.pathname);
    setPanel(value);
  }
  return (
    <>
      <nav className="community-nav" aria-label="Game menu">
        <button className="text-button" onClick={() => open('themes')}>
          Change the mood
        </button>
        <button className="text-button" onClick={() => open('leaderboard')}>
          Leaderboards
        </button>
        <button
          className="text-button"
          disabled={disabled}
          onClick={() => open('account')}
        >
          {account?.username ? <>{account.username}</> : 'Account'}
        </button>
      </nav>
      <Dialog
        open={!!panel}
        onOpenChange={(o) => !o && panel !== 'welcome' && setPanel('')}
      >
        <DialogContent showCloseButton={panel !== 'welcome'}>
          <DialogTitle>
            {panel === 'welcome'
              ? 'How do you want to play?'
              : panel === 'themes'
                ? 'Pick your sound'
                : panel === 'leaderboard'
                  ? 'Top of the bill'
                  : 'Your account'}
          </DialogTitle>
          {panel !== 'themes' && panel !== 'welcome' && (
            <DialogDescription>
              {panel === 'leaderboard'
                ? 'Completed games only. Equal scores share a rank.'
                : account?.signedIn
                  ? 'Your progress is saved to your account.'
                  : 'Sign in to save your progress and join the leaderboards.'}
            </DialogDescription>
          )}
          {panel === 'welcome' && (
            <>
              <DialogDescription>
                Same puzzles and scoring either way.
              </DialogDescription>
              <div className="welcome-options">
                <section>
                  <h2>With an account</h2>
                  <p>
                    Resume on any device and join the leaderboards. Your ChatGPT
                    display name and finished scores appear publicly.
                  </p>
                  <a
                    className="primary-button"
                    href={
                      '/signin-with-chatgpt?return_to=' +
                      encodeURIComponent(returnTo + '?account=1')
                    }
                    target="_top"
                    onClick={acknowledgeWelcome}
                  >
                    Sign in with ChatGPT
                  </a>
                </section>
                <section>
                  <h2>As a guest</h2>
                  <p>
                    Play and share your results without signing in. Progress
                    stays tied to this browser; clearing its storage loses
                    access. Guest scores don’t appear on leaderboards.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      acknowledgeWelcome();
                      setPanel('');
                    }}
                  >
                    Continue as guest
                  </button>
                </section>
              </div>
            </>
          )}
          {panel === 'themes' && (
            <div className="theme-options">
              {themes.map(([id, name, desc]) => (
                <button
                  key={id}
                  className="theme-option"
                  data-selected={id === theme}
                  aria-pressed={id === theme}
                  onClick={() => {
                    setTheme(id);
                    document.documentElement.dataset.theme = id;
                    try {
                      localStorage.setItem('chord-theme', id);
                    } catch {}
                  }}
                >
                  <strong>{name}</strong>
                  <span>{desc}</span>
                  {id === theme && <small>Now playing</small>}
                </button>
              ))}
            </div>
          )}
          {panel === 'account' && (
            <>
              {!account ? (
                <p>Loading account…</p>
              ) : !account.signedIn ? (
                <a
                  className="primary-button"
                  href={
                    '/signin-with-chatgpt?return_to=' +
                    encodeURIComponent(returnTo + '?account=1')
                  }
                  target="_top"
                >
                  Sign in with ChatGPT
                </a>
              ) : (
                <div className="account-profile">
                  <div className="player-name">
                    <strong>{account.username || 'Listener'}</strong>
                  </div>
                  <a
                    className="text-button"
                    target="_top"
                    href="/signout-with-chatgpt?return_to=/"
                  >
                    Sign out
                  </a>
                </div>
              )}
            </>
          )}
          {panel === 'leaderboard' && (
            <>
              <div className="standings-switch">
                <button
                  className="text-button"
                  aria-pressed={scope === 'puzzle'}
                  onClick={() => setScope('puzzle')}
                >
                  Puzzle {puzzleId}
                </button>
                <button
                  className="text-button"
                  aria-pressed={scope === 'overall'}
                  onClick={() => setScope('overall')}
                >
                  Overall
                </button>
              </div>
              {!entries && !error ? (
                <p role="status">Loading standings…</p>
              ) : entries?.length === 0 ? (
                account?.signedIn === false && (
                  <a
                    className="text-button"
                    href={
                      '/signin-with-chatgpt?return_to=' +
                      encodeURIComponent(returnTo + '?account=1')
                    }
                    target="_top"
                  >
                    Sign in to show on the leaderboard
                  </a>
                )
              ) : (
                entries && (
                  <div className="standings-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Player</th>
                          <th>Points</th>
                          {scope === 'overall' && <th>Sets</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr
                            key={
                              e.rank +
                              ':' +
                              e.username +
                              ':' +
                              e.boardId +
                              ':' +
                              entries.indexOf(e)
                            }
                          >
                            <td>{e.rank}</td>
                            <td>
                              {e.boardId ? (
                                <a href={'/' + puzzleId + '/' + e.boardId}>
                                  {e.username} ↗
                                </a>
                              ) : (
                                <span className="player-name">
                                  {e.username}
                                </span>
                              )}
                            </td>
                            <td>{e.score}</td>
                            {scope === 'overall' && <td>{e.completed}/20</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
