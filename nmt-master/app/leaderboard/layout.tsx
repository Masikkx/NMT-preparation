import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Рейтинг',
  description: 'Топ-результати користувачів платформи.',
  openGraph: {
    title: 'Рейтинг | TO200ZNO',
    description: 'Топ-результати користувачів платформи.',
    images: ['/og-sticker.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Рейтинг | TO200ZNO',
    description: 'Топ-результати користувачів платформи.',
    images: ['/og-sticker.svg'],
  },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
