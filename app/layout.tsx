import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@fontsource/newsreader/index.css';
import '@fontsource/open-sans/index.css';
import './globals.css';
import AuthGate from '@/app/components/AuthGate';

export const metadata: Metadata = {
  title: 'Portfolio — Assemblage ingénierie',
  description: 'Références projets Assemblage ingénierie',
  // App interne (auth-gatée) : aucune raison d'être indexée/crawlée. Le
  // `noindex, nofollow` évite que les moteurs (Google/Bing) et bots polis
  // balaient les pages — chaque hit sur une entrée de cache froide génère
  // un ISR write. Complété par app/robots.ts (Disallow). Voir CLAUDE.md.
  robots: { index: false, follow: false },
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
