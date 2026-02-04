import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Тести',
  description: 'Список тестів, тем і незавершених спроб.',
  openGraph: {
    title: 'Тести | TO200ZNO',
    description: 'Список тестів, тем і незавершених спроб.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Тести | TO200ZNO',
    description: 'Список тестів, тем і незавершених спроб.',
    images: ['/og-sticker.svg'],
  },
};

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
