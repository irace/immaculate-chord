import type { Prompt } from '../puzzles';
import type { CatalogRecording } from './types';
export function supportsFact(p: Prompt) {
  return (
    p.kind === 'fact' &&
    (/^Released in the \d{4}s$/.test(p.label) ||
      [
        'Under 3 minutes',
        '3 to 5 minutes',
        'Over 5 minutes',
        'Over 6 minutes',
        'Album opener',
        'Album closer',
        'Somewhere in between',
      ].includes(p.label))
  );
}
export type FactCheck = { fit: number; explanation: string; source: string };
export function verifyFact(
  p: Prompt,
  r: CatalogRecording,
): FactCheck | undefined {
  if (!supportsFact(p)) return undefined;
  const unknown = () => {
    throw new Error(
      `Catalog data could not verify “${p.label}” for this recording. No guess was used.`,
    );
  };
  const era = p.label.match(/^Released in the (\d{4})s$/);
  if (era) {
    if (!r.firstReleaseDate || !/^\d{4}/.test(r.firstReleaseDate))
      return unknown();
    const year = Number(r.firstReleaseDate.slice(0, 4));
    return {
      fit: year >= Number(era[1]) && year < Number(era[1]) + 10 ? 100 : 0,
      explanation: `The catalog lists this recording’s earliest release as ${r.firstReleaseDate}.`,
      source: r.source,
    };
  }
  if (p.label.includes('minutes')) {
    if (!r.durationMs || r.durationMs <= 0) return unknown();
    const t = r.durationMs;
    const fits =
      p.label === 'Under 3 minutes'
        ? t < 180000
        : p.label === '3 to 5 minutes'
          ? t >= 180000 && t <= 300000
          : p.label === 'Over 5 minutes'
            ? t > 300000
            : t > 360000;
    const seconds = Math.floor(t / 1000);
    return {
      fit: fits ? 100 : 0,
      explanation: `This recording runs ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}.`,
      source: r.source,
    };
  }
  if (!r.albums.length) return unknown();
  const qualifies = (a: CatalogRecording['albums'][number]) =>
    p.label === 'Album opener'
      ? a.position === 1
      : p.label === 'Album closer'
        ? a.position === a.trackCount
        : a.position > 1 && a.position < a.trackCount;
  const chosen = r.albums.find(qualifies);
  // A verified album position can establish a match. Missing coverage cannot establish that no other album qualifies.
  if (!chosen) {
    if (!r.albumCoverageComplete) return unknown();
    return {
      fit: 0,
      explanation: `The catalog’s standard album tracklists place “${r.title}” at ${r.albums.map((a) => `track ${a.position} of ${a.trackCount} on ${a.title}`).join('; ')}, which does not match “${p.label}”.`,
      source: r.albums[0].source,
    };
  }
  return {
    fit: 100,
    explanation: `“${r.title}” is track ${chosen.position} of ${chosen.trackCount} on ${chosen.title} (${chosen.date.slice(0, 4)}), using an early standard album edition.`,
    source: chosen.source,
  };
}
export type CatalogContext = {
  recording: CatalogRecording;
  row?: FactCheck;
  column?: FactCheck;
};
