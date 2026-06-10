'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Projet } from '@/types/projet';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { useViewMode } from '@/lib/auth/useViewMode';
import { DEFAULT_FICHE_STATUS, FICHE_STATUS_COLOR } from '@/lib/pdf/projectConfig';
import { DEFAULT_WP_CONFIG, wpTemplateFor, type WpConfig } from '@/lib/wordpress/wpConfig';
import { color, feedback, ui } from '@/lib/ui/tokens';
import WpLayoutSidebar, { type KnownPhoto } from './WpLayoutSidebar';
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
  const wpTemplate = wpTemplateFor(projet.vignettePoles);
  const { viewMode, setViewMode, canSwitch } = useViewMode();

  // Liste des photos disponibles (cover Airtable + photosProjet), exposée à
  // la sidebar pour les contrôles individuels (activation + cadrage + cover).
  const knownPhotos: KnownPhoto[] = [];
  if (projet.photoCouverture) {
    knownPhotos.push({ url: projet.photoCouverture.url, filename: projet.photoCouverture.filename, isCover: true });
  }
  for (const p of projet.photosProjet ?? []) {
    if (!knownPhotos.some((q) => q.filename === p.filename)) {
      knownPhotos.push({ url: p.url, filename: p.filename });
    }
  }
  const [wpConfig, setWpConfig] = useState<WpConfig>(projet.wpConfig ?? DEFAULT_WP_CONFIG);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; id?: number; categoryNames?: string[]; categoryCount?: number; hasMetaDescription?: boolean } | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ prodUrl?: string; prodId?: number; draftUrl?: string; error?: string } | null>(null);
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
    // Garde-fous SEO : on bloque l'export tant que les Tags export WP ou la
    // méta description SEO ne sont pas renseignés (champs édités dans
    // « Éditer les champs » → section Export Wordpress).
    const errors: string[] = [];
    if (!projet.tagsExportWp || projet.tagsExportWp.length === 0) {
      errors.push('Veuillez renseigner les tags-web afin de publier la fiche.');
    }
    if (!projet.metaDescription || !projet.metaDescription.trim()) {
      errors.push("La méta-description n'est pas remplie. C'est un champ IA généré par Airtable. Vérifiez que tous les champs nécessaires pour le faire tourner sont remplis.");
    }
    if (errors.length > 0) {
      alert(errors.join('\n\n'));
      return;
    }

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
      setResult({ url: data.url, id: data.id, categoryNames: data.categoryNames, categoryCount: data.categoryCount, hasMetaDescription: data.hasMetaDescription });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPublishing(false);
    }
  }

  async function handleUpdateProd() {
    if (!confirm('Cette action remplace immédiatement la version publiée sur assemblage.net par le contenu du dernier brouillon. Continuer ?')) return;
    setPromoting(true);
    setPromoteResult(null);
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/update-prod`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setPromoteResult({ prodUrl: data.prodUrl, prodId: data.prodId, draftUrl: data.draftUrl });
    } catch (e) {
      setPromoteResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPromoting(false);
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
        {/* Statut de la fiche (lecture seule), surligné par sa couleur (cf. home). */}
        <span
          title="Statut de la fiche (modifiable depuis la fiche)"
          style={{
            display: 'inline-flex', alignItems: 'center',
            background: FICHE_STATUS_COLOR[projet.ficheStatus ?? DEFAULT_FICHE_STATUS],
            color: 'white', fontWeight: 700, fontSize: '8pt',
            padding: '3px 10px', borderRadius: 6,
          }}
        >
          {projet.ficheStatus ?? DEFAULT_FICHE_STATUS}
        </span>
        <div style={{ flex: 1 }} />

        {canSwitch && (
          <>
            <label style={{ color: 'white', fontWeight: 600, marginRight: 4 }}>Vue :</label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'admin' | 'user')}
              title="Bascule entre la vue admin (tous les contrôles) et la vue user (Catégories / Espacements / Typographie générale masqués)"
              style={{ ...btn, background: 'white', color: 'var(--ai-violet)' }}
            >
              <option value="admin">Admin</option>
              <option value="user">User</option>
            </select>
          </>
        )}

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
          {publishing ? 'Publication…' : 'Export WP'}
        </button>

        {/* « Mettre à jour la production » : vue admin uniquement (pousse le
            dernier brouillon vers le post publié). */}
        {viewMode === 'admin' && (
          <button
            onClick={handleUpdateProd}
            disabled={promoting}
            title="Pousse le contenu du dernier brouillon vers le post WordPress publié existant (recherche par slug)"
            style={{ ...btn, background: 'white', color: 'var(--ai-violet)' }}
          >
            {promoting ? 'Mise à jour…' : 'Mettre à jour la production'}
          </button>
        )}

        {projet.urlWordpress && (
          <a href={projet.urlWordpress} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>
            Voir sur le site →
          </a>
        )}
        {result?.url && (
          <span style={{ color: feedback.succesClair, fontWeight: 600 }}>
            ✓ Publié #{result.id} —{' '}
            <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: feedback.succesClair }}>voir le brouillon</a>
            {result.categoryNames && result.categoryNames.length > 0 && (
              <span style={{ color: result.categoryCount ? feedback.succesClair : '#ffdd88', marginLeft: 8, fontWeight: 400 }}>
                · catégories : {result.categoryCount}/{result.categoryNames.length} assignées ({result.categoryNames.join(', ')})
              </span>
            )}
            <span style={{ color: result.hasMetaDescription ? feedback.succesClair : '#ffdd88', marginLeft: 8, fontWeight: 400 }}>
              · SEO : keyphrase ✓{result.hasMetaDescription ? ' · méta description ✓' : ' · méta description vide (champ Airtable non généré ?)'}
            </span>
          </span>
        )}
        {result?.error && <span style={{ color: feedback.erreurClair, fontWeight: 600 }}>✗ {result.error}</span>}
        {promoteResult?.prodUrl && (
          <span style={{ color: feedback.succesClair, fontWeight: 600 }}>
            ✓ Production mise à jour #{promoteResult.prodId} —{' '}
            <a href={promoteResult.prodUrl} target="_blank" rel="noopener noreferrer" style={{ color: feedback.succesClair }}>voir l&apos;article publié</a>
          </span>
        )}
        {promoteResult?.error && <span style={{ color: feedback.erreurClair, fontWeight: 600 }}>✗ {promoteResult.error}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', background: ui.fondPage, height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
        <WpLayoutSidebar config={wpConfig} onChange={setWpConfig} template={wpTemplate} slug={projet.slug} knownPhotos={knownPhotos} />
        <main style={{ flex: 1, display: 'flex', justifyContent: 'center', overflowY: 'auto', minWidth: 0 }}>
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
