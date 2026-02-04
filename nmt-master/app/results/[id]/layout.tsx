import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Результат',
  description: 'Підсумок тесту з балами та правильними відповідями.',
  openGraph: {
    title: 'Результат | TO200ZNO',
    description: 'Підсумок тесту з балами та правильними відповідями.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Результат | TO200ZNO',
    description: 'Підсумок тесту з балами та правильними відповідями.',
    images: ['/og-sticker.svg'],
  },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
