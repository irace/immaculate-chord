import type { Metadata } from 'next';
import Game from './game';
export default function Home() {
  return <Game />;
}

const title = 'Immaculate Chord — The music grid';
const description =
  'Nine songs. Make them count. Match music facts with feelings and find your perfect deep cut.';
const images = [
  {
    url: 'https://chord.irace.dev/api/share/home?v=2',
    width: 1200,
    height: 630,
    alt: 'Immaculate Chord. Nine songs. Make them count.',
  },
];
export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    url: 'https://chord.irace.dev',
    siteName: 'Immaculate Chord',
    images,
  },
  twitter: { card: 'summary_large_image', title, description, images },
};
