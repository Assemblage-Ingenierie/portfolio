'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Projet, TemplateChoice } from '@/types/projet';
import { TEMPLATE_OPTIONS } from '@/types/projet';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { useAuth } from '@/lib/supabase/useAuth';
import { useViewMode } from '@/lib/auth/useViewMode';
import { encodeConfig, ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import { FICHE_STATUS_VALUES, type FicheStatus } from '@/lib/pdf/projectConfig';
import { color, feedback } from '@/lib/ui/tokens';

interface Props {
  projet: Projet;
  template: TemplateChoice;
  manualConfig?: ManualConfig;
  bandeauConfig?: BandeauConfig;
  photoCrops?: Record<string, CropData>;
  cropEditMode?: boolean;
  onCropEditModeChange?: (next: boolean) => void;
  onTemplateChange: (template: TemplateChoice) => void;
  onSave?: () => void;
  ficheStatus: FicheStatus;
  onFicheStatusChange: (next: FicheStatus) => void;
  /** Si vrai : sauvegarde mise en page désactivée (fiche verrouillée et user
   *  n'a pas cliqué "Editer tout de même"). */
  readOnly?: boolean;
  /** Si vrai : modifications non sauvegardées (manualConfig/bandeauConfig/
   *  photoCrops divergent des valeurs initiales). Affiche une modale au
   *  clic sur "← Portfolio". */
  isDirty?: boolean;
}

export default function ProjetToolbar({
  projet,
  template,
  manualConfig,
  bandeauConfig,
  photoCrops,
  cropEditMode,
  onCropEditModeChange,
  onTemplateChange,
  onSave,
  ficheStatus,
  onFicheStatusChange,
  readOnly,
  isDirty,
}: Props) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{ url?: string; error?: string; warning?: string; status?: string; type?: string; author?: number; id?: number; previousUrl?: string } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusSaveState, setStatusSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  // Modale de confirmation au clic sur "← Portfolio" si modifications non sauvegardées.
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  // Promotion du dernier draft vers la prod (route /update-prod).
  const [promoting, setPromoting] = useState(false);
  const [promoteResult, setPromoteResult] = useState<{ prodUrl?: string; prodId?: number; draftUrl?: string; error?: string } | null>(null);

  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { viewMode, setViewMode, canSwitch } = useViewMode();

  async function handleStatusChange(next: FicheStatus) {
    const previous = ficheStatus;
    onFicheStatusChange(next); // optimiste
    setStatusSaveState('saving');
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ficheStatus: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Erreur serveur');
      }
      setStatusSaveState('idle');
    } catch (err) {
      console.error('[ficheStatus]', err);
      onFicheStatusChange(previous); // rollback
      setStatusSaveState('error');
      setTimeout(() => setStatusSaveState('idle'), 4000);
    }
  }

  async function handlePublish(variant: 'v1' | 'v2') {
    const label = variant === 'v2' ? 'Export WP 2' : 'Export WP 1';
    if (!confirm(`Publier cette fiche sur WordPress (${label}) en brouillon ?`)) return;
    setPublishing(true);
    setResult(null);
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur inconnue');
      setResult({ url: data.url, warning: data.warning, status: data.status, type: data.type, author: data.author, id: data.id, previousUrl: data.previousUrl });
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : 'Erreur' });
    } finally {
      setPublishing(false);
    }
  }

  async function handleUpdateProd() {
    if (!confirm(
      'Cette action remplace immédiatement la version publiée sur assemblage.net par le contenu du dernier brouillon. Continuer ?'
    )) return;
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

  async function handleSaveLayout(): Promise<boolean> {
    setSaveState('saving');
    try {
      const res = await authedFetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(manualConfig ? { savedManualConfig: manualConfig } : {}),
          ...(bandeauConfig ? { bandeauConfig } : {}),
          ...(photoCrops !== undefined ? { photoCrops } : {}),
        }),
      });
      if (!res.ok) throw new Error('Erreur serveur');
      setSaveState('saved');
      onSave?.();
      setTimeout(() => setSaveState('idle'), 3000);
      return true;
    } catch (err) {
      console.error('[saveLayout]', err);
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 4000);
      return false;
    }
  }

  function handlePortfolioClick(e: React.MouseEvent) {
    if (!isDirty) return; // pas modifié → navigation normale via <Link>
    e.preventDefault();
    setShowLeaveModal(true);
  }

  async function handleSaveAndLeave() {
    const ok = await handleSaveLayout();
    if (ok) {
      setShowLeaveModal(false);
      router.push('/');
    }
  }

  function handleLeaveWithoutSaving() {
    setShowLeaveModal(false);
    router.push('/');
  }

  async function handleDownloadPdf() {
    const params = new URLSearchParams({ template });
    if ((template === 'Str-Env' || template === 'Dev') && manualConfig) {
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
      <Link href="/" onClick={handlePortfolioClick} style={{ color: 'var(--ai-gris)', textDecoration: 'none', fontWeight: 600 }}>← Portfolio</Link>
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

      <label style={{ color: 'white', fontWeight: 600, marginLeft: 4, marginRight: 4 }}>Statut fiche :</label>
      <select
        value={ficheStatus}
        onChange={(e) => handleStatusChange(e.target.value as FicheStatus)}
        disabled={statusSaveState === 'saving'}
        title={!isAdmin ? 'Seul un administrateur peut sélectionner "Prête pour publication"' : undefined}
        style={{
          ...btn,
          background: statusSaveState === 'error' ? feedback.erreurClair : 'white',
          color: 'var(--ai-violet)',
          border: 'none',
        }}
      >
        {FICHE_STATUS_VALUES.map((s) => (
          <option
            key={s}
            value={s}
            disabled={s === 'Prête pour publication' && !isAdmin && ficheStatus !== s}
          >
            {s}{s === 'Prête pour publication' && !isAdmin ? ' (admin uniquement)' : ''}
          </option>
        ))}
      </select>

      {canSwitch && (
        <>
          <label style={{ color: 'white', fontWeight: 600, marginLeft: 4, marginRight: 4 }}>Vue :</label>
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as 'admin' | 'user')}
            title="Bascule entre la vue admin (tous les contrôles) et la vue user (UI restreinte)"
            style={{ ...btn, background: 'white', color: 'var(--ai-violet)', border: 'none' }}
          >
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </>
      )}

      {/* "Éditer les champs" + "Recadrer les photos" sont déplacés dans la
          sidebar gauche pour les templates Str-Env / Dev (qui affichent la
          LayoutSidebar). Pour les autres templates (Solo/Diptyque/Triptyque),
          on garde "Éditer les champs" ici puisqu'il n'y a pas de sidebar. */}
      {template !== 'Str-Env' && template !== 'Dev' && (
        <Link
          href={`/projet/${projet.slug}/edit`}
          style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white', textDecoration: 'none' }}
        >
          Editer les champs
        </Link>
      )}

      {(template === 'Str-Env' || template === 'Dev') && (
        <button
          onClick={handleSaveLayout}
          disabled={saveState === 'saving' || readOnly}
          title={readOnly ? 'Fiche verrouillée — passez en mode édition pour modifier la mise en page' : undefined}
          style={{
            ...btn,
            background: saveState === 'saved' ? '#4caf50' : saveState === 'error' ? feedback.erreur : 'white',
            color: saveState === 'idle' ? 'var(--ai-violet)' : 'white',
            border: 'none',
            opacity: readOnly ? 0.5 : 1,
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
        >
          {readOnly ? '🔒 Mise en page verrouillée'
            : saveState === 'saving' ? 'Sauvegarde…'
            : saveState === 'saved' ? '✓ Mise en page sauvegardée'
            : saveState === 'error' ? '✗ Erreur'
            : 'Sauvegarder la mise en page'}
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
      {/* Bouton Export WP 2 masqué dans l'UI mais le code de génération
          (variant: 'v2' / buildWpContentV2) reste en place côté serveur
          pour pouvoir le ré-activer rapidement si besoin. */}
      <button
        style={{ ...btn, background: color.rouge, color: 'white', border: 'none' }}
        onClick={handleUpdateProd}
        disabled={promoting}
        title="Pousse le contenu du dernier brouillon créé vers le post WordPress publié existant (recherche par slug)"
      >
        {promoting ? 'Mise à jour…' : 'Mettre à jour la production'}
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
        <span style={{ color: feedback.succesClair, fontWeight: 600 }}>
          ✓ Publié #{result.id} [{result.type}/{result.status}, author {result.author}] —{' '}
          <a href={result.url} target="_blank" rel="noopener noreferrer" style={{ color: feedback.succesClair }}>voir le brouillon</a>
          {result.previousUrl && (
            <span style={{ color: '#ffdd88', marginLeft: 8, fontWeight: 400 }}>
              · ancien brouillon : <a href={result.previousUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#ffdd88' }}>{result.previousUrl}</a> (à supprimer manuellement après validation)
            </span>
          )}
          {result.warning && <span style={{ color: '#ffdd88', marginLeft: 8 }}>({result.warning})</span>}
        </span>
      )}
      {result?.error && (
        <span style={{ color: feedback.erreurClair, fontWeight: 600 }}>✗ {result.error}</span>
      )}
      {promoteResult?.prodUrl && (
        <span style={{ color: feedback.succesClair, fontWeight: 600 }}>
          ✓ Production mise à jour #{promoteResult.prodId} —{' '}
          <a href={promoteResult.prodUrl} target="_blank" rel="noopener noreferrer" style={{ color: feedback.succesClair }}>voir l&apos;article publié</a>
        </span>
      )}
      {promoteResult?.error && (
        <span style={{ color: feedback.erreurClair, fontWeight: 600 }}>✗ {promoteResult.error}</span>
      )}

      {showLeaveModal && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowLeaveModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white', padding: '24px 28px', borderRadius: 4,
              maxWidth: 480, width: '90%',
              fontFamily: 'var(--sans)', color: 'var(--ai-noir)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--serif)', fontSize: '14pt', fontWeight: 500, margin: '0 0 12px', color: 'var(--ai-violet)' }}>
              Vous n&apos;avez pas sauvegardé la mise en page
            </h2>
            <p style={{ fontSize: '10pt', lineHeight: 1.5, margin: '0 0 20px', color: 'var(--ai-noir70)' }}>
              Des modifications de mise en page typographique, photo principale, texte, photos additionnelles ou certifications n&apos;ont pas été enregistrées. Que voulez-vous faire ?
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={handleLeaveWithoutSaving}
                style={{ ...btn, background: 'white', color: 'var(--ai-noir70)', border: `1px solid ${color.gris}` }}
              >
                Quitter sans sauvegarder
              </button>
              <button
                onClick={handleSaveAndLeave}
                disabled={saveState === 'saving'}
                style={{ ...btn, background: 'var(--ai-rouge)', color: 'white', border: 'none' }}
              >
                {saveState === 'saving' ? 'Sauvegarde…' : 'Sauvegarder la mise en page'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
