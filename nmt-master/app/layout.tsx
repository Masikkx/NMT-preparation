import type { Metadata, Viewport } from 'next';
import './globals.css';
import { RootLayoutClient } from '@/components/RootLayoutClient';

export const metadata: Metadata = {
  title: 'TO200ZNO',
  description: 'Comprehensive NMT exam preparation platform',
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
