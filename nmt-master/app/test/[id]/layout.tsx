import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Тестування',
  description: 'Проходження тесту з таймером та перевіркою відповідей.',
  openGraph: {
    title: 'Тестування | TO200ZNO',
    description: 'Проходження тесту з таймером та перевіркою відповідей.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Тестування | TO200ZNO',
    description: 'Проходження тесту з таймером та перевіркою відповідей.',
    images: ['/og-sticker.svg'],
  },
};

export default function TestLayout({ children }: { children: React.ReactNode }) {
  return children;
}
