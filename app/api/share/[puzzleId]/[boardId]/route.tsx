import { ImageResponse } from 'next/og';
import { finishedShare } from '@/lib/share';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ puzzleId: string; boardId: string }> },
) {
  const { puzzleId, boardId } = await params;
  const share = await finishedShare(puzzleId, boardId);
  if (!share)
    return new Response('Finished board not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  const image = new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#171318',
        color: '#f6f1df',
        padding: '48px 56px',
        fontFamily: 'sans-serif',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: 610 }}>
        <div
          style={{
            display: 'flex',
            color: '#fa83d0',
            fontSize: 22,
            letterSpacing: 5,
          }}
        >
          IMMACULATE CHORD
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 58,
            fontWeight: 700,
            marginTop: 28,
            lineHeight: 1.05,
          }}
        >
          {share.puzzle.title}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            width: 246,
            gap: 8,
            marginTop: 32,
          }}
        >
          {Array.from({ length: 9 }, (_, cell) => {
            const answer = share.answers.find((a) => a.cell === cell);
            return (
              <div
                key={cell}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 74,
                  height: 54,
                  background: answer ? '#d8ff00' : '#322832',
                  color: answer ? '#171318' : '#b8a8b9',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {answer ? answer.score : '—'}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 20,
            color: '#b8a8b9',
            marginTop: 'auto',
          }}
        >
          chord.irace.dev
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: 380,
          background: '#d8ff00',
          color: '#171318',
          padding: '36px 28px',
          transform: 'rotate(3deg)',
          boxShadow: '10px 10px 0 #000',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 3,
          }}
        >
          FINISHED
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 136,
            fontWeight: 700,
            lineHeight: 1.1,
            marginTop: 32,
          }}
        >
          {share.total}
        </div>
        <div style={{ display: 'flex', fontSize: 28 }}>OUT OF 900</div>
        <div style={{ display: 'flex', fontSize: 24, marginTop: 40 }}>
          {`${share.answers.length} / 9 squares filled`}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 24,
            marginTop: 'auto',
            fontWeight: 700,
          }}
        >
          Play this grid yourself →
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=300' },
    },
  );
  return new Response(await image.arrayBuffer(), { headers: image.headers });
}
