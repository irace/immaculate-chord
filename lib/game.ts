export type Answer = {
  cell: number;
  title: string;
  artist: string;
  canonicalKey: string;
  rowFit: number;
  colFit: number;
  obscurity: number;
  score: number;
  explanation: string;
  model: string;
};
export type Attempt = Answer & { accepted: boolean; regraded?: boolean };
export const acceptsAnswer = (answer: Answer) =>
  answer.rowFit > 0 && answer.colFit > 0;
export type Board = {
  player?: { username: string; profileId: string | null };
  canClearBoard?: boolean;
  resumeWithAccount?: boolean;
  id: string;
  puzzleId: string;
  answers: Answer[];
  attempts: Attempt[];
  guessesUsed: number;
  guessesLeft: number;
  locked: boolean;
  isOwner: boolean;
  editable: boolean;
  gradingReady: boolean;
};
export const FIT_POINTS = 60;
export const OBSCURITY_POINTS = 40;
export function scoreAnswer(rowFit: number, colFit: number, obscurity: number) {
  return Math.max(
    1,
    Math.round(
      (Math.min(rowFit, colFit) *
        (FIT_POINTS * 100 + OBSCURITY_POINTS * obscurity)) /
        10000,
    ),
  );
}
export function normalizeSong(title: string, artist: string) {
  return `${title}|${artist}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}|]/gu, '');
}
export function validText(value: unknown, max = 160): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  );
}
