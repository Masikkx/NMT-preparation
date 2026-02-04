import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Реєстрація',
  description: 'Створення акаунту TO200ZNO.',
  openGraph: {
    title: 'Реєстрація | TO200ZNO',
    description: 'Створення акаунту TO200ZNO.',
    images: ['/og.svg'],
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
