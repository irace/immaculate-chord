import { json, readBoard, publicBoard } from '@/lib/server';
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const b = await readBoard(id);
    if (!b) return json({ error: 'This board could not be found.' }, 404);
    return json(await publicBoard(req, b));
  } catch {
    return json({ error: 'Could not load this board. Please try again.' }, 503);
  }
}
