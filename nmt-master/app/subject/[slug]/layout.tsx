import type { Metadata } from 'next';

export const generateMetadata = ({ params }: { params: { slug: string } }): Metadata => {
  const name = params.slug?.replace(/-/g, ' ') || 'Subject';
  return {
    title: name.charAt(0).toUpperCase() + name.slice(1),
    description: 'Сторінка предмету з тестами за темами, НМТ та незавершеними спробами.',
    openGraph: {
      title: `${name} | TO200ZNO`,
      description: 'Сторінка предмету з тестами за темами, НМТ та незавершеними спробами.',
      images: ['/og-sticker.svg'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | TO200ZNO`,
      description: 'Сторінка предмету з тестами за темами, НМТ та незавершеними спробами.',
      images: ['/og-sticker.svg'],
    },
  };
};

export default function SubjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
