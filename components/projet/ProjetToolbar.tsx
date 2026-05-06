'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Projet, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import { authHeaders } from '@/lib/supabase/authHeaders';
import { encodeConfig, ManualConfig } from '@/lib/pdf/manualConfig';

interface Props {
  projet: Projet;
  template: TemplateChoice;
  manualConfig?: ManualConfig;
  onTemplateChange: (template: TemplateChoice) => void;
}

export default function ProjetToolbar({ projet, template, manualConfig, onTemplateChange }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; warning?: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  async function handlePublish(variant: 'v1' | 'v2') {
    const label = variant === 'v2' ? 'Export WP 2' : 'Export WP 1';
    if (!confirm(`Publier cette fiche sur WordPress (${label}) en brouillon ?`)) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projet/${projet.slug}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ variant }),
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

  async function handleSaveLayout() {
    if (!manualConfig) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ savedManualConfig: manualConfig }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
    }
  }

  async function handleDownloadPdf() {
    const params = new URLSearchParams({ template });
    if (template === 'Manuel' && manualConfig) {
      params.set('config', encodeConfig(manualConfig));
    }
    window.open(`/projet/${projet.slug}/print?${params.toString()}`, '_blank');
  }

  const btn: React.CSSProperties = {
    padding: '5px 12px', borderRadius: '2px', fontWeight: 600,
    fontFamily: 'var(--sans)', fontSize: '8pt', cursor: 'pointer',
  };

  return (
    <div style={{ background: 'var(--ai-violet)', padding: '10px 24px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontFamily: 'var(--sans)', fontSize: '8pt' }}>
      <Link href="/" style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>← Portfolio</Link>
      <div style={{ flex: 1 }} />

      <label style={{ color: 'white', fontWeight: 600, marginRight: 4 }}>Template :</label>
      <select
        value={template}
        onChange={(e) => onTemplateChange(e.target.value as TemplateChoice)}
        style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
      >
        {TEMPLATE_OPTIONS.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <Link
        href={`/projet/${projet.slug}/edit`}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white', textDecoration: 'none' }}
      >
        Modifier
      </Link>
      {template === 'Manuel' && (
        <button
          onClick={handleSaveLayout}
          disabled={saveState === 'saving' || !manualConfig}
          style={{ ...btn, background: saveState === 'saved' ? '#4caf50' : saveState === 'error' ? '#e53935' : 'white', color: saveState === 'idle' ? 'var(--ai-violet)' : 'white', border: 'none' }}
        >
          {saveState === 'saving' ? 'Sauvegarde…' : saveState === 'saved' ? '✓ Mise en page sauvegardée' : saveState === 'error' ? '✗ Erreur' : 'Sauvegarder la mise en page'}
        </button>
      )}
      <button
        onClick={handleDownloadPdf}
        style={{ ...btn, background: 'var(--ai-rouge)', color: 'white', border: 'none' }}
      >
        Télécharger PDF
      </button>
      <button
        style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
        onClick={() => handlePublish('v1')}
        disabled={publishing}
      >
        {publishing ? 'Publication…' : 'Export WP 1'}
      </button>
      <button
        style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
        onClick={() => handlePublish('v2')}
        disabled={publishing}
      >
        {publishing ? 'Publication…' : 'Export WP 2'}
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
