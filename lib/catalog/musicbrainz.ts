import type { CatalogHit, CatalogProvider, CatalogRecording } from './types';
import { catalogJson } from './http';
const day = 86400000;
const idPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Credit = { name?: string; joinphrase?: string; artist?: { name: string } };
type Group = {
  id: string;
  title: string;
  'primary-type'?: string;
  'secondary-types'?: string[];
  'first-release-date'?: string;
};
type Release = {
  id: string;
  title: string;
  date?: string;
  status?: string;
  disambiguation?: string;
  'release-group'?: Group;
  media?: {
    position: number;
    'track-count'?: number;
    tracks?: {
      position: number;
      title: string;
      length?: number;
      recording?: { id: string };
    }[];
  }[];
};
type Recording = {
  id: string;
  title: string;
  disambiguation?: string;
  score?: number;
  length?: number;
  'first-release-date'?: string;
  'artist-credit'?: Credit[];
  releases?: Release[];
};
const artist = (r: Recording) =>
  (r['artist-credit'] || [])
    .map((c) => (c.name || c.artist?.name || '') + (c.joinphrase || ''))
    .join('');
const get = <T>(
  path: string,
  params: Record<string, string>,
  ttl = 7 * day,
) => {
  const query = new URLSearchParams({ ...params, fmt: 'json' });
  return catalogJson<T>(
    'musicbrainz',
    `https://musicbrainz.org/ws/2/${path}?${query}`,
    ttl,
  );
};
const standard = (r: Release) =>
  r.status === 'Official' &&
  /^\d{4}/.test(r.date || '') &&
  !/deluxe|bonus|remaster|anniversary|expanded|special edition|limited edition/i.test(
    `${r.title} ${r.disambiguation || ''}`,
  );
const album = (g?: Group) =>
  g?.['primary-type'] === 'Album' &&
  !(g['secondary-types'] || []).some((x) =>
    [
      'Compilation',
      'Remix',
      'Live',
      'DJ-mix',
      'Mixtape/Street',
      'Soundtrack',
    ].includes(x),
  );
function hit(r: Recording): CatalogHit {
  const releases = (r.releases || [])
    .filter(standard)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  return {
    provider: 'musicbrainz',
    id: r.id,
    title: r.title,
    artist: artist(r),
    version: r.disambiguation || undefined,
    album:
      releases.find((r) => album(r['release-group']))?.title ||
      releases[0]?.title,
    year: r['first-release-date']?.slice(0, 4),
  };
}
export const musicbrainz: CatalogProvider = {
  id: 'musicbrainz',
  async search(query) {
    // Escape Lucene operators: user input is text, never a search expression.
    const words = query
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim()
      .split(/\s+/)
      .slice(0, 12);
    if (!words.length) return [];
    let data: { recordings: Recording[] };
    try {
      data = await get<{ recordings: Recording[] }>(
        'recording/',
        {
          query:
            words
              .map((w, i) => (i === words.length - 1 ? `${w}*` : `"${w}"`))
              .join(' AND ') +
            (/\blive\b/i.test(query) ? '' : ' AND NOT comment:live'),
          limit: '40',
        },
        5 * 60000,
      );
    } catch {
      // Simpler exact-token search can succeed when the prefix query is unavailable.
      data = await get<{ recordings: Recording[] }>(
        'recording/',
        { query: words.map((w) => `"${w}"`).join(' AND '), limit: '40' },
        5 * 60000,
      );
    }
    return data.recordings
      .filter((r) => artist(r))
      .sort(
        (a, b) =>
          Number(b.score || 0) - Number(a.score || 0) ||
          Number(!!a.disambiguation) - Number(!!b.disambiguation) ||
          Number(
            (b.releases || []).some(
              (r) => standard(r) && album(r['release-group']),
            ),
          ) -
            Number(
              (a.releases || []).some(
                (r) => standard(r) && album(r['release-group']),
              ),
            ) ||
          (a['first-release-date'] || '9999').localeCompare(
            b['first-release-date'] || '9999',
          ),
      )
      .slice(0, 12)
      .map(hit);
  },
  async resolve(id, options) {
    if (!idPattern.test(id))
      throw new Error('Choose a recording from the catalog.');
    const r = await get<Recording>(`recording/${id}`, {
      inc: 'artists+releases+release-groups',
    });
    const result: CatalogRecording = {
      ...hit(r),
      durationMs: r.length || undefined,
      firstReleaseDate: r['first-release-date'] || undefined,
      albums: [],
      source: `https://musicbrainz.org/recording/${id}`,
    };
    if (!options?.albums) return result;
    // Browse coverage is required to reject an album-position claim. If browsing
    // is unavailable, included releases can still prove a positive match.
    let page = { releases: r.releases || [], 'release-count': Infinity };
    try {
      page = await get<{ releases: Release[]; 'release-count': number }>(
        'release/',
        { recording: id, inc: 'release-groups', limit: '100' },
      );
    } catch {
      /* positive evidence only */
    }
    const groups = [
      ...new Map(
        page.releases
          .filter((r) => album(r['release-group']))
          .map((r) => [r['release-group']!.id, r['release-group']!]),
      ).values(),
    ];
    result.albumCoverageComplete =
      page['release-count'] <= 100 && groups.length <= 3;
    // Bounded work. If no album position can be established, grading asks for a retry instead of guessing.
    for (const group of groups.slice(0, 3)) {
      const editions = await get<{
        releases: Release[];
        'release-count': number;
      }>('release/', { 'release-group': group.id, inc: 'media', limit: '100' });
      if (editions['release-count'] > 100) {
        result.albumCoverageComplete = false;
        continue;
      }
      const originals = editions.releases
        .filter(standard)
        .sort(
          (a, b) =>
            a.date!.localeCompare(b.date!) ||
            (a.media?.length || 1) - (b.media?.length || 1),
        );
      const earliest = originals[0];
      if (!earliest) {
        result.albumCoverageComplete = false;
        continue;
      }
      // Prefer a single-disc standard edition in the earliest year over vinyl+CD bundles.
      const chosen = originals
        .filter((x) => x.date!.slice(0, 4) === earliest.date!.slice(0, 4))
        .sort(
          (a, b) =>
            (a.media?.length || 1) - (b.media?.length || 1) ||
            a.date!.localeCompare(b.date!),
        )[0];
      const release = await get<Release>(`release/${chosen.id}`, {
        inc: 'recordings',
      });
      const tracks = (release.media || [])
        .sort((a, b) => a.position - b.position)
        .flatMap((m) =>
          (m.tracks || []).sort((a, b) => a.position - b.position),
        );
      if (
        !tracks.length ||
        tracks.length !==
          (release.media || []).reduce((n, m) => n + (m['track-count'] || 0), 0)
      ) {
        result.albumCoverageComplete = false;
        continue;
      }
      const position = tracks.findIndex((t) => t.recording?.id === id);
      if (position < 0) continue; // e.g. a bonus-only recording absent from the original edition
      result.albums.push({
        title: release.title,
        date: chosen.date!,
        position: position + 1,
        trackCount: tracks.length,
        source: `https://musicbrainz.org/release/${chosen.id}`,
      });
    }
    return result;
  },
};
