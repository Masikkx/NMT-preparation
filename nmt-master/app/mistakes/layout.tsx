import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Помилки',
  description: 'Бібліотека помилок і швидке виправлення.',
  openGraph: {
    title: 'Помилки | TO200ZNO',
    description: 'Бібліотека помилок і швидке виправлення.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Помилки | TO200ZNO',
    description: 'Бібліотека помилок і швидке виправлення.',
    images: ['/og-sticker.svg'],
  },
};

export default function MistakesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
