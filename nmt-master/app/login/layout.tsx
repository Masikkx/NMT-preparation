import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вхід',
  description: 'Вхід у TO200ZNO.',
  openGraph: {
    title: 'Вхід | TO200ZNO',
    description: 'Вхід у TO200ZNO.',
    images: ['/og.svg'],
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
