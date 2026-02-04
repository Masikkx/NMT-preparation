import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RootLayoutClient } from '@/components/RootLayoutClient';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: {
    default: 'TO200ZNO',
    template: '%s | TO200ZNO',
  },
  description: 'Підготовка до НМТ з тестами, аналітикою та розумною практикою.',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: 'TO200ZNO',
    description: 'Платформа підготовки до НМТ: тести, аналітика, серії та помилки.',
    images: ['/og.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TO200ZNO',
    description: 'Платформа підготовки до НМТ: тести, аналітика, серії та помилки.',
    images: ['/og.svg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
