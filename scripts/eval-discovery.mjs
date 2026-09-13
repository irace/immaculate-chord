// Read-only comparison of public discovery APIs. No API keys or game writes.
import { writeFile } from 'node:fs/promises';
const cases = [
  ['Hey Jude', 'The Beatles'],
  ['Strange Fruit', 'Billie Holiday'],
  ['Robot Stop', 'King Gizzard'],
  ['New York Kiss', 'Spoon'],
  ['Avril 14th', 'Aphex Twin'],
  ['Sense', 'King Gizzard'],
  ['Selkies: The Endless Obsession', 'Between the Buried and Me'],
  ['Phantom Island', 'King Gizzard'],
  ['Vampire Empire', 'Big Thief'],
  ['Hey Jude (Live)', 'Paul McCartney'],
];
const normalized = (s) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
const results = [];
for (const [title, artist] of cases) {
  await Promise.all(
    ['itunes', 'deezer'].map(async (provider) => {
      const start = performance.now();
      const url =
        provider === 'itunes'
          ? 'https://itunes.apple.com/search?' +
            new URLSearchParams({
              term: title,
              entity: 'song',
              media: 'music',
              country: 'US',
              limit: '25',
            })
          : 'https://api.deezer.com/search?' +
            new URLSearchParams({ q: title, limit: '25' });
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(20000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.error) throw new Error(JSON.stringify(json.error));
        const hits = (provider === 'itunes' ? json.results : json.data).map(
          (x) => ({
            id: String(x.trackId ?? x.id),
            title: x.trackName ?? x.title,
            artist: x.artistName ?? x.artist?.name,
            album: x.collectionName ?? x.album?.title,
            durationMs: x.trackTimeMillis ?? x.duration * 1000,
          }),
        );
        const rank = hits.findIndex(
          (x) =>
            normalized(x.artist).includes(normalized(artist)) &&
            normalized(x.title) === normalized(title),
        );
        results.push({
          provider,
          title,
          expectedArtist: artist,
          rank: rank < 0 ? null : rank + 1,
          ms: Math.round(performance.now() - start),
          hits,
        });
        console.log(
          provider,
          title,
          rank < 0 ? 'missing' : `rank ${rank + 1}`,
          `${Math.round(performance.now() - start)}ms`,
        );
      } catch (e) {
        results.push({
          provider,
          title,
          error: e.message,
          ms: Math.round(performance.now() - start),
        });
        console.log(provider, title, e.message);
      }
    }),
  );
  await new Promise((r) => setTimeout(r, 3200));
}
await writeFile(
  process.argv[2] || '/private/tmp/chord-discovery-eval.json',
  JSON.stringify({ date: new Date().toISOString(), results }, null, 2),
);
