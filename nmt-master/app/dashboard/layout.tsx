import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Панель',
  description: 'Персональна панель навчання з результатами та прогресом.',
  openGraph: {
    title: 'Панель | TO200ZNO',
    description: 'Персональна панель навчання з результатами та прогресом.',
    images: ['/og.svg'],
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
