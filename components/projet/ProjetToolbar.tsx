'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Projet, TemplateChoice } from '@/types/projet';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { useAuth } from '@/lib/supabase/useAuth';
import { useViewMode } from '@/lib/auth/useViewMode';
import { encodeConfig, ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import { FICHE_STATUS_VALUES, FICHE_STATUS_COLOR, type FicheStatus } from '@/lib/pdf/projectConfig';
import { color, feedback } from '@/lib/ui/tokens';

interface Props {
  projet: Projet;
  template: TemplateChoice;
  manualConfig?: ManualConfig;
  bandeauConfig?: BandeauConfig;
  photoCrops?: Record<string, CropData>;
  cropEditMode?: boolean;
  onCropEditModeChange?: (next: boolean) => void;
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
  onSave,
  ficheStatus,
  onFicheStatusChange,
  readOnly,
  isDirty,
}: Props) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [statusSaveState, setStatusSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  // Modale de confirmation au clic sur "← Portfolio" si modifications non sauvegardées.
  const [showLeaveModal, setShowLeaveModal] = useState(false);

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

      {/* Statut fiche, juste à droite du retour Portfolio. Le sélecteur est
          surligné par la couleur du statut (cf. home / PortfolioGrid). */}
      <select
        value={ficheStatus}
        onChange={(e) => handleStatusChange(e.target.value as FicheStatus)}
        disabled={statusSaveState === 'saving'}
        title={!isAdmin ? 'Seul un administrateur peut sélectionner "Prête pour publication"' : 'Statut de la fiche'}
        style={{
          ...btn,
          background: statusSaveState === 'error' ? feedback.erreur : FICHE_STATUS_COLOR[ficheStatus],
          color: 'white',
          fontWeight: 700,
          border: 'none',
        }}
      >
        {FICHE_STATUS_VALUES.map((s) => (
          <option
            key={s}
            value={s}
            disabled={s === 'Prête pour publication' && !isAdmin && ficheStatus !== s}
            style={{ background: 'white', color: 'var(--ai-noir)' }}
          >
            {s}{s === 'Prête pour publication' && !isAdmin ? ' (admin uniquement)' : ''}
          </option>
        ))}
      </select>

      <div style={{ flex: 1 }} />

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

      {/* "Éditer les champs" + "Recadrer les photos" + sélecteur Template sont
          dans la sidebar gauche pour les templates Str-Env / Dev (qui affichent
          la LayoutSidebar). Pour les autres templates (Solo/Diptyque/Triptyque),
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
      {/* Tout l'export WordPress (Export WP / Mettre à jour la production / Voir
          sur le site) vit désormais dans la page d'édition WP. Ici, seul le lien
          d'accès. */}
      <Link
        href={`/projet/${projet.slug}/wordpress`}
        style={{ ...btn, background: 'transparent', border: '1px solid var(--ai-gris)', color: 'white', textDecoration: 'none' }}
        title="Éditer la fiche WordPress (stylisation + export) "
      >
        Edition WordPress
      </Link>

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
