'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Projet, LayoutChoice } from '@/types/projet';
import { authHeaders } from '@/lib/supabase/authHeaders';
import { generateAndDownloadPdf } from '@/lib/pdf/client/generatePdf';

interface Props {
  projet: Projet;
  layout: LayoutChoice;
  onLayoutChange: (layout: LayoutChoice) => void;
}

export default function ProjetToolbar({ projet, layout, onLayoutChange }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; warning?: string } | null>(null);

  async function handlePublish() {
    if (!confirm('Publier cette fiche sur WordPress en brouillon ?')) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projet/${projet.slug}/publish`, {
        method: 'POST',
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setResult({ url: data.url, warning: data.warning });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPublishing(false);
    }
  }

  async function handleDownloadPdf() {
    setExporting(true);
    try {
      await generateAndDownloadPdf({ ...projet, layout });
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erreur export PDF');
    } finally {
      setExporting(false);
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
        onClick={() => onLayoutChange(layout === 'Magazine' ? 'Editorial' : 'Magazine')}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white' }}
        title={`Passer en layout ${layout === 'Magazine' ? 'Editorial' : 'Magazine'}`}
      >
        {layout === 'Magazine' ? 'Editorial' : 'Magazine'}
      </button>
      <Link
        href={`/projet/${projet.slug}/edit`}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white', textDecoration: 'none' }}
      >
        Modifier
      </Link>
      <button
        onClick={handleDownloadPdf}
        disabled={exporting}
        style={{ ...btn, background: 'var(--ai-rouge)', color: 'white', border: 'none', opacity: exporting ? 0.7 : 1 }}
      >
        {exporting ? 'Export…' : 'Télécharger PDF'}
      </button>
      <button
        style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
        onClick={handlePublish}
        disabled={publishing}
      >
        {publishing ? 'Publication…' : 'Publier sur WordPress'}
      </button>
      {projet.urlWordpress && (
        <a
          href={projet.urlWordpress}
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
