import { Suspense } from 'react';
import { connection } from 'next/server';
import { getProjets } from '@/lib/airtable';
import PortfolioGrid from '@/components/portfolio/PortfolioGrid';

export default function HomePage() {
  // Frontière de streaming : la transition vers la home s'affiche
  // immédiatement (fallback) au lieu d'attendre le rendu serveur complet
  // + le transfert du payload RSC (~950 fiches). Le clic « ← Portfolio »
  // ne « gèle » plus. Purement runtime : aucun impact sur l'ISR (la page
  // reste dynamique via connection(), cf. HomeContent).
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  // Page DYNAMIQUE (hors ISR) — même traitement que /portfolio/builder et
  // /portfolio/tableau. En page ISR/statique, la home embarquait tout le
  // dataset (getProjets) et le PPR la découpait en segments (_full, __PAGE__…)
  // réécrits à chaque sauvegarde liste (revalidateTag(PROJETS_LIST_TAG)) →
  // ~956 write units + segments par fenêtre d'édition. En dynamique, la page
  // n'écrit plus dans l'ISR ; les données viennent de getProjets() (caché,
  // 1 entrée invalidée à la demande). Cf. CLAUDE.md (quota ISR).
  await connection();
  const projets = await getProjets();
  return <PortfolioGrid projets={projets} />;
}

function HomeFallback() {
  const tile: React.CSSProperties = {
    background: 'var(--ai-gris)',
    borderRadius: 12,
    aspectRatio: '16 / 10',
    opacity: 0.5,
  };
  return (
    <div style={{ padding: '24px', fontFamily: 'var(--sans)' }}>
      <p style={{ fontSize: '10pt', color: 'var(--ai-noir70)', margin: '0 0 16px' }}>
        Chargement du portfolio…
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '16px',
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={tile} />
        ))}
      </div>
    </div>
  );
}
