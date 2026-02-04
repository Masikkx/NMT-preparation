import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Панель',
  description: 'Персональна панель прогресу та результатів.',
  openGraph: {
    title: 'Панель | TO200ZNO',
    description: 'Персональна панель прогресу та результатів.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Панель | TO200ZNO',
    description: 'Персональна панель прогресу та результатів.',
    images: ['/og-sticker.svg'],
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
