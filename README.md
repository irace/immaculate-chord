# Immaculate Chord

A single-player 3×3 music grid with 20 curated puzzles, anonymous D1 sessions, immutable answers and read-only completed boards.

## Run

Use Node 22.13 or newer. Install with `npm ci`, start with `npm run dev`, and build with `npm run build`. Generate schema migrations with `npm run db:generate`; the Sites deployment applies them. Local D1 needs the checked-in migration applied before playing. Run `npm test` and `npx tsc --noEmit` for the application checks.

## Grading

Configure `OPENROUTER_API_KEY` as a hosted secret through Sites. `OPENROUTER_MODEL` defaults to `openrouter/free`. The key is only read by server code. Until configured, browsing and session creation work, while submission is disabled. Do not put the key in a public environment variable or source file. Local environment keys are listed in `.env.example`.

The judge estimates both prompt fits and obscurity. The server computes `max(1, round(min(rowFit, colFit) * (0.8 + 0.2 * obscurity / 100)))`. These are AI judgments, not verified catalog facts or population rarity percentiles. Free routing may select different models, so judgments may vary. Successful identical input grades are cached. There is a conservative shared daily cap of 45 uncached grading attempts (UTC), and the provider can impose additional limits. Cached grades do not consume that cap. Provider failures and invalid outputs do not commit an answer.

## Sessions and sharing

A random 256-bit browser credential is stored locally; the server stores its SHA-256 hash. A deterministic opaque board ID lets the same browser resume one board per puzzle. Answers live in D1. Public reads never return the credential hash. Every answer write checks the credential, completion status and a short exclusive lease, then atomically saves the answer. A ninth answer locks the board. Clearing browser storage loses editing access; completed links remain viewable.

The app has no sign-in UI. Sites initially hosts it behind owner-only platform access for review. To make links work for friends, explicitly change the Site's audience to public. The game's read-only link behavior does not bypass that platform access policy.

## Validation

Automated route tests use the actual handlers with in-memory SQLite and explicitly mocked OpenRouter responses. They cover resuming, unauthorized writes, failed grading, overlapping requests, duplicates, final locking and scoring boundaries. Live OpenRouter grading requires a real key and remains untested until supplied. Experimental WebMCP tools are feature-detected; their browser registration has not been verified because a supported validation context was not available.
