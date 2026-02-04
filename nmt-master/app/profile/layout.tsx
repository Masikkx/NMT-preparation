import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Профіль',
  description: 'Редагуй профіль та переглядай історію тестів.',
  openGraph: {
    title: 'Профіль | TO200ZNO',
    description: 'Редагуй профіль та переглядай історію тестів.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Профіль | TO200ZNO',
    description: 'Редагуй профіль та переглядай історію тестів.',
    images: ['/og-sticker.svg'],
  },
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
