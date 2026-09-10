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
export type Attempt = Answer & { accepted: boolean };
export const acceptsAnswer = (answer: Answer) =>
  answer.rowFit > 0 && answer.colFit > 0;
export type Board = {
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
export function scoreAnswer(rowFit: number, colFit: number, obscurity: number) {
  const fit = Math.min(rowFit, colFit) / 100;
  return Math.max(1, Math.round(100 * fit * (0.8 + (0.2 * obscurity) / 100)));
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
