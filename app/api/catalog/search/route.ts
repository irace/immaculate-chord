import { catalogProvider } from '@/lib/catalog';
import { json } from '@/lib/server';
export async function GET(req: Request) {
  const query = new URL(req.url).searchParams.get('q')?.trim() || '';
  if (query.length < 3 || query.length > 120) return json({ results: [] });
  try {
    return json({ results: await catalogProvider().search(query) });
  } catch {
    return json(
      { error: 'Song search is busy. Please try again in a moment.' },
      503,
    );
  }
}
