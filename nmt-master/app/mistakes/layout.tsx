import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Помилки',
  description: 'Бібліотека помилок та швидке виправлення.',
  openGraph: {
    title: 'Помилки | TO200ZNO',
    description: 'Бібліотека помилок та швидке виправлення.',
    images: ['/og.svg'],
  },
};

export default function MistakesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
