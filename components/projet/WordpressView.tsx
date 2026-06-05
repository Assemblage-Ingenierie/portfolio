'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Projet } from '@/types/projet';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { DEFAULT_WP_CONFIG, type WpConfig } from '@/lib/wordpress/wpConfig';
import { color, feedback, ui } from '@/lib/ui/tokens';
import WpLayoutSidebar from './WpLayoutSidebar';
import WordpressPreview from './WordpressPreview';

/**
 * Éditeur / aperçu de l'export WordPress (Export WP 1). Calqué sur `ProjetView` :
 * toolbar haut (violet) + sidebar de contrôles à gauche + aperçu live à droite.
 *
 * - Le state `wpConfig` pilote la typo + la disposition des photos de l'aperçu.
 * - « Sauvegarder le style WP » persiste `wpConfig` dans Airtable (route /fields).
 * - « Export WP 1 » lance la publication réelle (route /publish), qui relit la
 *   config persistée — donc sauvegarder AVANT d'exporter.
 */
export default function WordpressView({ projet }: { projet: Projet }) {
  const router = useRouter();
  const [wpConfig, setWpConfig] = useState<WpConfig>(projet.wpConfig ?? DEFAULT_WP_CONFIG);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; id?: number } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  const initialSnapshotRef = useRef<string>(
    JSON.stringify(projet.wpConfig ?? DEFAULT_WP_CONFIG),
  );
  const currentSnapshot = useMemo(() => JSON.stringify(wpConfig), [wpConfig]);
  const isDirty = currentSnapshot !== initialSnapshotRef.current;

  async function handleSave(): Promise<boolean> {
    setSaveState('saving');
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpConfig }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setSaveState('saved');
      initialSnapshotRef.current = currentSnapshot;
      setTimeout(() => setSaveState('idle'), 3000);
      return true;
    } catch (err) {
      console.error('[wp-save]', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
      return false;
    }
  }

  async function handlePublish() {
    if (isDirty && !confirm('Le style n’est pas sauvegardé : l’export utilisera la dernière version enregistrée. Continuer ?')) return;
    if (!confirm('Publier cette fiche sur WordPress (Export WP 1) en brouillon ?')) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant: 'v1' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setResult({ url: data.url, id: data.id });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPublishing(false);
    }
  }

  function handlePortfolioClick(e: React.MouseEvent) {
    if (!isDirty) return;
    e.preventDefault();
    setShowLeaveModal(true);
  }

  const btn: React.CSSProperties = {
    padding: '5px 12px',
    borderRadius: 2,
    fontWeight: 600,
    fontFamily: 'var(--sans)',
    fontSize: '8pt',
    cursor: 'pointer',
    border: 'none',
  };

  return (
    <>
      <div
        style={{
          background: 'var(--ai-violet)',
          padding: '10px 24px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          fontFamily: 'var(--sans)',
          fontSize: '8pt',
        }}
      >
        <Link href="/" onClick={handlePortfolioClick} style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>
          ← Portfolio
        </Link>
        <Link href={`/projet/${projet.slug}`} style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>
          Fiche PDF
        </Link>
        <span style={{ color: 'white', fontWeight: 700 }}>Aperçu WordPress — {projet.nom}</span>
        <div style={{ flex: 1 }} />

        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          style={{
            ...btn,
            background: saveState === 'saved' ? '#4caf50' : saveState === 'error' ? feedback.erreur : 'white',
            color: saveState === 'idle' ? 'var(--ai-violet)' : 'white',
          }}
        >
          {saveState === 'saving' ? 'Sauvegarde…'
            : saveState === 'saved' ? '✓ Style sauvegardé'
            : saveState === 'error' ? '✗ Erreur'
            : 'Sauvegarder le style WP'}
        </button>

        <button
          onClick={handlePublish}
          disabled={publishing}
          style={{ ...btn, background: 'var(--ai-rouge)', color: 'white' }}
        >
          {publishing ? 'Publication…' : 'Export WP 1'}
        </button>

        {projet.urlWordpress && (
          <a href={projet.urlWordpress} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>
            Voir sur le site →
          </a>
        )}
        {result?.url && (
          <span style={{ color: feedback.succesClair, fontWeight: 600 }}>
            ✓ Publié #{result.id} —{' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: feedback.succesClair }}>voir le brouillon</a>
          </span>
        )}
        {result?.error && <span style={{ color: feedback.erreurClair, fontWeight: 600 }}>✗ {result.error}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', background: ui.fondPage, minHeight: 'calc(100vh - 48px)' }}>
        <WpLayoutSidebar config={wpConfig} onChange={setWpConfig} />
        <main style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <WordpressPreview projet={projet} wpConfig={wpConfig} />
        </main>
      </div>

      {showLeaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'white', padding: '24px 28px', borderRadius: 4, maxWidth: 480, width: '90%', fontFamily: 'var(--sans)', color: 'var(--ai-noir)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
          >
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '14pt', fontWeight: 500, margin: '0 0 12px', color: 'var(--ai-violet)' }}>
              Style WordPress non sauvegardé
            </h2>
            <p style={{ fontSize: '10pt', lineHeight: 1.5, margin: '0 0 20px', color: 'var(--ai-noir70)' }}>
              Vos réglages de typographie / photos n&apos;ont pas été enregistrés. Que voulez-vous faire ?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => { setShowLeaveModal(false); router.push('/'); }}
                style={{ ...btn, background: 'white', color: 'var(--ai-noir70)', border: `1px solid ${color.gris}` }}
              >
                Quitter sans sauvegarder
              </button>
              <button
                onClick={async () => { const ok = await handleSave(); if (ok) { setShowLeaveModal(false); router.push('/'); } }}
                disabled={saveState === 'saving'}
                style={{ ...btn, background: 'var(--ai-rouge)', color: 'white' }}
              >
                {saveState === 'saving' ? 'Sauvegarde…' : 'Sauvegarder le style WP'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
