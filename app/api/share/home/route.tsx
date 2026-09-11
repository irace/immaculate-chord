import { ImageResponse } from 'next/og';
export async function GET() {
  const image = new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        background: '#171318',
        color: '#f6f1df',
        padding: 56,
        justifyContent: 'space-between',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          width: 690,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 78,
            lineHeight: 1,
          }}
        >
          IMMACULATE
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 112,
            color: '#d8ff00',
            lineHeight: 1,
          }}
        >
          CHORD
        </div>
        <div style={{ display: 'flex', fontSize: 30, marginTop: 36 }}>
          Nine songs. Make them count.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          width: 324,
          flexDirection: 'column',
          justifyContent: 'center',
          transform: 'rotate(4deg)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, width: 324 }}>
          {Array.from({ length: 9 }, (_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                width: 100,
                height: 100,
                background: i % 3 === 1 ? '#fa83d0' : '#d8ff00',
                color: '#171318',
                fontSize: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i === 4 ? '♪' : '+'}
            </div>
          ))}
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  );
  return new Response(await image.arrayBuffer(), { headers: image.headers });
}
