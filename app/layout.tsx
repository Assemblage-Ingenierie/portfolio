import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@fontsource/newsreader/index.css';
import '@fontsource/open-sans/index.css';
import './globals.css';
import AuthGate from '@/app/components/AuthGate';

export const metadata: Metadata = {
  title: 'Portfolio — Assemblage ingénierie',
  description: 'Références projets Assemblage ingénierie',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Suspense fallback={null}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </body>
    </html>
  );
}
