import { getCatalogProviderName } from '@/db';
import type {
  CatalogHit,
  CatalogProvider,
  CatalogRecording,
  CatalogSelection,
} from './types';
import { musicbrainz } from './musicbrainz';
import type { Prompt, Puzzle } from '../puzzles';
import { normalizeSong } from '../game';
// Provider adapters own upstream IDs and response formats. The grader and UI use only these shared types.
const providers: Record<string, CatalogProvider> = { musicbrainz };
export function catalogProvider(name = getCatalogProviderName()) {
  const provider = providers[name];
  if (!provider)
    throw new Error('Catalog provider is unavailable. No guess was used.');
  return provider;
}
export function validSelection(value: unknown): value is CatalogSelection {
  return (
    !!value &&
    typeof value === 'object' &&
    'provider' in value &&
    'id' in value &&
    typeof value.provider === 'string' &&
    typeof value.id === 'string' &&
    value.id.length <= 100
  );
}
export { supportsFact, verifyFact } from './facts';
import { verifyFact, type CatalogContext } from './facts';
export type { CatalogContext } from './facts';
export async function prepareCatalog(
  p: Puzzle,
  cell: number,
  title: string,
  artist: string,
  selection?: CatalogSelection,
): Promise<CatalogContext> {
  const row = p.rows[Math.floor(cell / 3)],
    column = p.cols[cell % 3];
  const provider = catalogProvider(selection?.provider);
  let chosen = selection;
  if (!chosen) {
    // Old clients and re-grades can resolve an unambiguous exact match. Never silently choose a fuzzy match.
    const hits = await provider.search(title);
    const exact = hits.filter(
      (h: CatalogHit) =>
        normalizeSong(h.title, h.artist) === normalizeSong(title, artist) &&
        !h.version,
    );
    if (exact.length !== 1)
      throw new Error(
        'Choose a recording from the song search before grading. No guess was used.',
      );
    chosen = exact[0];
  }
  const recording = await provider.resolve(chosen.id, {
    albums: [row, column].some((x) =>
      ['Album opener', 'Album closer', 'Somewhere in between'].includes(
        x.label,
      ),
    ),
  });
  return {
    recording,
    row: verifyFact(row, recording),
    column: verifyFact(column, recording),
  };
}
