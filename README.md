# Immaculate Chord

A single-player 3×3 music grid with 20 curated puzzles, anonymous D1 sessions, immutable answers and read-only completed boards.

## Run

Use Node 22.13 or newer. Install with `npm ci`, start with `npm run dev`, and build with `npm run build`. Generate schema migrations with `npm run db:generate`; the Sites deployment applies them. Local D1 needs the checked-in migration applied before playing. Run `npm test` and `npx tsc --noEmit` for the application checks.

## Grading

Configure `OPENROUTER_API_KEY` as a hosted secret through Sites. `OPENROUTER_MODEL` defaults to `nvidia/nemotron-3-super-120b-a12b:free`. The key is only read by server code. Until configured, browsing and session creation work, while submission is disabled. Do not put the key in a public environment variable or source file. Local environment keys are listed in `.env.example`.

The catalog verifies supported factual prompts; the judge estimates remaining prompt fits and obscurity. The server computes `max(1, round(min(rowFit, colFit) * (0.6 + 0.4 * obscurity / 100)))`. Subjective ratings are AI judgments, not population rarity percentiles. The judge uses a pinned general-purpose free model with structured-output support. Clear matches receive full fit credit; partial vibe credit requires an explained limitation. Obscurity uses fixed familiarity bands calibrated to general listeners and the individual recording, rather than artist fame. Successful identical input grades are cached by rubric version; rubric updates bypass older cached judgments. There is a conservative shared daily cap of 500 uncached grading attempts (UTC), and the provider can impose additional limits. Cached grades do not consume that cap. Provider failures and invalid outputs do not commit an answer.

## Sessions and sharing

A random 256-bit browser credential is stored locally; the server stores its SHA-256 hash. A deterministic opaque board ID lets the same browser resume one board per puzzle. Answers live in D1. Public reads never return the credential hash. Every answer write checks the credential, completion status and a short exclusive lease, then atomically saves the answer. Every valid grade consumes one of nine guesses. A zero fit on either prompt rejects the pick and leaves its square open; accepted picks lock their square. The ninth guess locks the board, with empty squares worth zero. Legacy submissions are treated as prior guesses without resetting progress. Clearing browser storage loses editing access; completed links remain viewable.

The app offers optional ChatGPT sign-in. The Site is publicly accessible. The game's read-only link behavior does not bypass that platform access policy.

## Validation

Automated route tests use the actual handlers with in-memory SQLite and explicitly mocked OpenRouter responses. They cover resuming, unauthorized writes, failed grading, overlapping requests, duplicates, final locking and scoring boundaries. Live OpenRouter grading was verified locally with the configured key and a separate test song. Experimental WebMCP tools are feature-detected; their browser registration has not been verified because a supported validation context was not available.

## Accounts and themes

Optional ChatGPT sign-in uses Sites' platform routes. Local `npm run dev` simulates one stable user (Seedy); production uses real ChatGPT identities. Local test accounts and scores stay in the local database. To test, choose Account → Sign in with ChatGPT. Sign out in Account to return to guest use.

ChatGPT display names are used automatically. Avatars are omitted because the available Sites interface does not document a forwarded profile-photo field. Missing names display as “Listener”; emails are never exposed on leaderboards. Stable platform IDs identify accounts, so duplicate display names are supported. Existing account IDs and progress are preserved; display names refresh when a player returns.

Accounts have one run per puzzle. Guest progress from this browser is attached automatically when applicable; shared boards remain read-only.

Leaderboards show up to 100 players, finished runs only, with equal points sharing a rank. Overall standings sum all completed puzzle scores. Scores are computed from server-saved grades; clients cannot write scores. These are casual leaderboards, not cheat-proof competitions.

Five visual themes (punk, jazz, disco, synthwave, folk) are independent of puzzles. The initial choice is random; choosing a theme saves it in browser storage.

Hosting must use Sites dispatch to authenticate the user headers. Do not expose the Worker directly through another host while trusting those headers. Make the Site public when ready to allow guests; private Sites still impose their hosting access gate. Database migrations ship with the build. No deployment is needed for local testing.

Signing in starts account play immediately, without username setup. Signed-in requests cannot submit to guest runs. Owned guest progress automatically moves into the account flow when opened; other players’ shared links stay read-only.

## Re-grading

Owners may request one fresh evaluation of the latest rejected attempt in an unfilled square, including on completed boards. It bypasses the grade cache, replaces that attempt, and preserves the guess count and board lock. Accepted corrections update saved answers and leaderboard totals. Errors leave the original attempt and re-grade eligibility unchanged. Re-grading uses the shared daily provider allowance and the same per-board submission lease.

Scores on existing boards and leaderboards are recomputed from saved fit/obscurity ratings using the current 60/40 formula, without new model calls or changing guess counts.


## Music catalog

`MUSIC_CATALOG_PROVIDER=musicbrainz` selects the initial provider. Add an adapter implementing `CatalogProvider` in `lib/catalog/types.ts` and register it in `lib/catalog/index.ts` to change providers without rewriting search UI or grading. Existing picks retain their provider and recording IDs so re-grades keep the same recording. MusicBrainz is the included adapter; another adapter must be implemented before selecting another provider.

Search waits 600 ms after typing. Server-side D1 caches searches for five minutes and metadata for seven days; a shared D1 reservation throttles uncached MusicBrainz requests, with one retry for transient 429/503 responses. The public MusicBrainz service is free for non-commercial use and limits clients to one request per second; review its terms before commercial use. No music catalog credential is needed.

The server resolves the selected recording ID. Decades use the catalog’s earliest known recording date, including an earlier single/EP appearance. Demos and live versions are distinct recordings. Duration uses the selected recording’s length. Album positions use an early official standard edition of a qualifying studio album, combining all discs in order; explicitly marked deluxe/bonus/remastered/compilation/live releases are excluded. An earlier EP does not prevent a later LP appearance from matching. Positive album matches are accepted; a mismatch is rejected only when the inspected catalog coverage is complete. Incomplete or inconclusive coverage leaves the guess unused. At most three candidate album groups and 100 editions per group are inspected. Original-edition metadata is imperfect and not always complete.

Unsupported facts (instruments, lyrics, artist classification, etc.) and obscurity still use the LLM. A low-confidence unverified fact (1–20) leaves the guess unused. Catalog failures happen before the model quota and before attempt persistence. Existing grades remain unchanged; old rejected guesses can be re-graded when an exact unique recording match is available.
