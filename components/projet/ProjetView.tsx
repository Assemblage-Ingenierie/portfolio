'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import LayoutSidebar from '@/components/projet/LayoutSidebar';
import PhotoCropOverlay from '@/components/projet/PhotoCropOverlay';
import FicheStatusPopup from '@/components/projet/FicheStatusPopup';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { DEFAULT_MANUAL_CONFIG, ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import { DEFAULT_FICHE_STATUS, type FicheStatus } from '@/lib/pdf/projectConfig';
import { ASSEMBLAGE_DEFAULT_BANDEAU, ASSEMBLAGE_DEFAULT_MANUAL } from '@/lib/pdf/assemblageDefaults';
import ProjetToolbar from './ProjetToolbar';
import { ui } from '@/lib/ui/tokens';

interface Props {
  projet: Projet;
  isPrint: boolean;
}

export default function ProjetView({ projet, isPrint }: Props) {
  const [template, setTemplate] = useState<TemplateChoice>(projet.template);

  // Application automatique des préréglages Assemblage pour les fiches non
  // travaillées : si la fiche est en statut "Pas faite" ET qu'aucune config
  // de mise en page n'a jamais été sauvegardée (pas de savedManualConfig,
  // pas de bandeauConfig), on charge les défauts Assemblage en aperçu.
  // Tant que l'utilisateur ne clique pas sur "Sauvegarder la mise en page",
  // rien n'est écrit en base — `isDirty` reste false grâce au snapshot
  // initialisé avec ces mêmes valeurs (cf. plus bas).
  const initialStatus = projet.ficheStatus ?? DEFAULT_FICHE_STATUS;
  const useAssemblageDefaults =
    initialStatus === 'Pas faite' &&
    !projet.savedManualConfig &&
    (!projet.bandeauConfig || Object.keys(projet.bandeauConfig).length === 0);

  const [manualConfig, setManualConfig] = useState<ManualConfig>(
    projet.savedManualConfig ?? (useAssemblageDefaults ? ASSEMBLAGE_DEFAULT_MANUAL : DEFAULT_MANUAL_CONFIG)
  );
  const [bandeauConfig, setBandeauConfig] = useState<BandeauConfig>(
    projet.bandeauConfig ?? (useAssemblageDefaults ? ASSEMBLAGE_DEFAULT_BANDEAU : {})
  );
  const [photoCrops, setPhotoCrops] = useState<Record<string, CropData>>(
    projet.photoCrops ?? {}
  );
  const [cropEditMode, setCropEditMode] = useState(false);
  const [measureTrigger, setMeasureTrigger] = useState(0);
  const [ficheStatus, setFicheStatus] = useState<FicheStatus>(initialStatus);

  // Popup visible à l'ouverture de la fiche (sauf en mode print).
  const [showPopup, setShowPopup] = useState(!isPrint);
  // Verrouillage de la mise en page : actif quand la fiche est "Prête pour
  // publication" ET que l'utilisateur n'a pas cliqué "Editer tout de même".
  // Re-verrouille automatiquement si le statut change vers "Prête pour
  // publication" via le sélecteur (et rouvre le popup).
  const [forceEdit, setForceEdit] = useState(false);
  useEffect(() => {
    if (ficheStatus === 'Prête pour publication') {
      setForceEdit(false);
      if (!isPrint) setShowPopup(true);
    }
  }, [ficheStatus, isPrint]);

  const readOnly = ficheStatus === 'Prête pour publication' && !forceEdit;

  // Snapshot des valeurs initiales (à l'ouverture de la fiche) pour détecter
  // si la mise en page a été modifiée sans être sauvegardée. Le snapshot
  // utilise les mêmes valeurs que les state initiaux (y compris les
  // préréglages Assemblage pour les fiches "Pas faite") → `isDirty` est
  // false à l'ouverture, même si les défauts sont injectés. Mis à jour
  // après chaque save réussi via `onSave` (cf. ProjetToolbar).
  const initialSnapshotRef = useRef<string>(
    JSON.stringify({
      manualConfig: projet.savedManualConfig ?? (useAssemblageDefaults ? ASSEMBLAGE_DEFAULT_MANUAL : DEFAULT_MANUAL_CONFIG),
      bandeauConfig: projet.bandeauConfig ?? (useAssemblageDefaults ? ASSEMBLAGE_DEFAULT_BANDEAU : {}),
      photoCrops: projet.photoCrops ?? {},
    }),
  );
  const currentSnapshot = useMemo(
    () => JSON.stringify({ manualConfig, bandeauConfig, photoCrops }),
    [manualConfig, bandeauConfig, photoCrops],
  );
  const isDirty = currentSnapshot !== initialSnapshotRef.current;

  async function handleTemplateChange(newTemplate: TemplateChoice) {
    setTemplate(newTemplate);
    // Dev est une variante UI de Manuel, non persistée dans Airtable.
    if (newTemplate === 'Dev') return;
    try {
      await authedFetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: newTemplate }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  const isManualLayout = !isPrint && (template === 'Str-Env' || template === 'Dev');

  // Le projet visualisé inclut les crops courants — l'iframe applique
  // automatiquement les recadrages via CSS. Pendant que la modale est
  // ouverte, l'aperçu A4 se met à jour à chaque drag (live preview).
  const previewProjet = { ...projet, template, bandeauConfig, photoCrops };

  return (
    <>
      {!isPrint && showPopup && (
        <FicheStatusPopup
          status={ficheStatus}
          onClose={() => setShowPopup(false)}
          onForceEdit={() => setForceEdit(true)}
        />
      )}
      {!isPrint && (
        <ProjetToolbar
          projet={projet}
          template={template}
          manualConfig={manualConfig}
          bandeauConfig={bandeauConfig}
          photoCrops={photoCrops}
          cropEditMode={cropEditMode}
          onCropEditModeChange={setCropEditMode}
          onSave={() => {
            setMeasureTrigger(t => t + 1);
            // Save réussi → la mise en page actuelle devient la nouvelle
            // référence (plus de "dirty" tant qu'on ne re-modifie pas).
            initialSnapshotRef.current = currentSnapshot;
          }}
          ficheStatus={ficheStatus}
          onFicheStatusChange={setFicheStatus}
          readOnly={readOnly}
          isDirty={isDirty}
        />
      )}
      {isManualLayout ? (
        <div style={{ display: 'flex', alignItems: 'stretch', background: ui.fondPage, minHeight: 'calc(100vh - 48px)' }}>
          <LayoutSidebar
            projet={projet}
            config={manualConfig}
            onChange={setManualConfig}
            bandeauConfig={bandeauConfig}
            onBandeauChange={setBandeauConfig}
            isDev={template === 'Dev'}
            template={template}
            onTemplateChange={handleTemplateChange}
            cropEditMode={cropEditMode}
            onCropEditModeChange={setCropEditMode}
          />
          <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 16 }}>
            <TemplatePreview
              projet={previewProjet}
              manualConfig={manualConfig}
              measureTrigger={measureTrigger}
            />
          </main>
        </div>
      ) : (
        <TemplatePreview
          projet={previewProjet}
          manualConfig={undefined}
        />
      )}
      {!isPrint && (
        <PhotoCropOverlay
          open={cropEditMode}
          onClose={() => setCropEditMode(false)}
          projet={projet}
          photoCrops={photoCrops}
          onChange={setPhotoCrops}
        />
      )}
    </>
  );
}
