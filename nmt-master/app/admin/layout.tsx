import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Адмін',
  description: 'Адмін-панель керування платформою.',
  openGraph: {
    title: 'Адмін | TO200ZNO',
    description: 'Адмін-панель керування платформою.',
    images: ['/og.svg'],
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
