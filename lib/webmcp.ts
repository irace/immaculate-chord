import type { Board } from './game';
import type { Puzzle } from './puzzles';
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: Record<string, unknown>) => unknown;
};
export function registerGameTools(
  read: () => { puzzle: Puzzle; board: Board | null },
  submit: (title: string, artist: string, cell: number) => Promise<unknown>,
  open: (cell: number) => void,
) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: Tool,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context) return;
  const controller = new AbortController();
  const tools: Tool[] = [
    {
      name: 'read_music_grid',
      description:
        'Read the current puzzle, saved songs, and whether the board is editable.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => read(),
    },
    {
      name: 'stage_music_pick',
      description:
        'Open a square for composing a song. Does not submit or lock an answer.',
      inputSchema: {
        type: 'object',
        properties: { cell: { type: 'integer', minimum: 0, maximum: 8 } },
        required: ['cell'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (
          !Number.isInteger(input.cell) ||
          Number(input.cell) < 0 ||
          Number(input.cell) > 8
        )
          throw new Error('Cell must be an integer from 0 to 8.');
        open(Number(input.cell));
        return { openedCell: input.cell };
      },
    },
    {
      name: 'submit_music_pick',
      description:
        'Grade and permanently lock a song in a square. Requires an editable board and connected judge.',
      inputSchema: {
        type: 'object',
        properties: {
          cell: { type: 'integer', minimum: 0, maximum: 8 },
          title: { type: 'string', minLength: 1, maxLength: 160 },
          artist: { type: 'string', minLength: 1, maxLength: 160 },
        },
        required: ['cell', 'title', 'artist'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        if (
          typeof input.title !== 'string' ||
          typeof input.artist !== 'string' ||
          input.title.length > 160 ||
          input.artist.length > 160
        )
          throw new Error('Invalid song.');
        return submit(input.title, input.artist, Number(input.cell));
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: controller.signal }),
      ).catch(() => {});
    } catch {
      /* Unsupported experimental API. */
    }
  }
  return () => controller.abort();
}
