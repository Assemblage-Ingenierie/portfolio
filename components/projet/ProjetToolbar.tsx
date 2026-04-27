'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LayoutChoice } from '@/types/projet';

interface Props {
  slug: string;
  urlWordpress?: string;
  layout: LayoutChoice;
  onLayoutChange: (layout: LayoutChoice) => void;
}

export default function ProjetToolbar({ slug, urlWordpress, layout, onLayoutChange }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; warning?: string } | null>(null);

  async function handlePublish() {
    if (!confirm('Publier cette fiche sur WordPress en brouillon ?')) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projet/${slug}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setResult({ url: data.url, warning: data.warning });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPublishing(false);
    }
  }

  const btn: React.CSSProperties = {
    padding: '5px 12px', borderRadius: '2px', fontWeight: 600,
    fontFamily: 'var(--sans)', fontSize: '8pt', cursor: 'pointer',
  };

  return (
    <div style={{ background: 'var(--ai-violet)', padding: '10px 24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontFamily: 'var(--sans)', fontSize: '8pt' }}>
      <Link href="/" style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>← Portfolio</Link>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => onLayoutChange(layout === 'Magazine' ? 'Éditorial' : 'Magazine')}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white' }}
        title={`Passer en layout ${layout === 'Magazine' ? 'Éditorial' : 'Magazine'}`}
      >
        {layout === 'Magazine' ? 'Éditorial' : 'Magazine'}
      </button>
      <Link
        href={`/projet/${slug}/edit`}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white', textDecoration: 'none' }}
      >
        Modifier
      </Link>
      <a
        href={`/api/projet/${slug}/pdf`}
        style={{ ...btn, background: 'var(--ai-rouge)', color: 'white', textDecoration: 'none', border: 'none' }}
      >
        Télécharger PDF
      </a>
      <button
        style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
        onClick={handlePublish}
        disabled={publishing}
      >
        {publishing ? 'Publication…' : 'Publier sur WordPress'}
      </button>
      {urlWordpress && (
        <a
          href={urlWordpress}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}
        >
          Voir sur le site →
        </a>
      )}
      {result?.url && (
        <span style={{ color: '#90EE90', fontWeight: 600 }}>
          ✓ Publié — <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: '#90EE90' }}>voir le brouillon</a>
          {result.warning && <span style={{ color: '#ffdd88', marginLeft: 8 }}>({result.warning})</span>}
        </span>
      )}
      {result?.error && (
        <span style={{ color: '#ffaaaa', fontWeight: 600 }}>✗ {result.error}</span>
      )}
    </div>
  );
}
