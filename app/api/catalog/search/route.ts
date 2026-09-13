import { catalogProvider } from '@/lib/catalog';
import { json } from '@/lib/server';
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim() || '';
  const artist = new URL(req.url).searchParams.get('artist')?.trim() || '';
  if (artist.length > 120) return json({ results: [] });
  if (query.length < 3 || query.length > 120) return json({ results: [] });
  try {
    const seen = new Set<string>();
    return json({
      results: (await catalogProvider().search(query, artist))
        .map(({ provider, id, title, artist, version }) => ({
          provider,
          id,
          title,
          artist,
          // Only recording-type labels are public before grading; provider
          // disambiguation can contain album names, dates, and other spoilers.
          version:
            [
              'live',
              'demo',
              'instrumental',
              'acoustic',
              'remix',
              'mono',
              'stereo',
              'radio edit',
            ]
              .filter((label) =>
                new RegExp(`\\b${label}\\b`, 'i').test(version || ''),
              )
              .join(' · ') || undefined,
        }))
        .filter((hit) => {
          const key =
            `${hit.title}|${hit.artist}|${hit.version || ''}`.toLocaleLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }),
    });
  } catch {
    return json(
      { error: 'Song search is busy. Please try again in a moment.' },
      503,
    );
  }
}
