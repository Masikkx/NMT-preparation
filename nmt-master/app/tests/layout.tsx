import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Тести',
  description: 'Список тестів і незавершених спроб.',
  openGraph: {
    title: 'Тести | TO200ZNO',
    description: 'Список тестів і незавершених спроб.',
    images: ['/og.svg'],
  },
};

export default function TestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
