'use client';

import { useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import LayoutSidebar from '@/components/projet/LayoutSidebar';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { DEFAULT_MANUAL_CONFIG, ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import ProjetToolbar from './ProjetToolbar';

interface Props {
  projet: Projet;
  isPrint: boolean;
}

export default function ProjetView({ projet, isPrint }: Props) {
  const [template, setTemplate] = useState<TemplateChoice>(projet.template);
  const [manualConfig, setManualConfig] = useState<ManualConfig>(
    projet.savedManualConfig ?? DEFAULT_MANUAL_CONFIG
  );
  const [bandeauConfig, setBandeauConfig] = useState<BandeauConfig>(
    projet.bandeauConfig ?? {}
  );
  const [photoCrops, setPhotoCrops] = useState<Record<string, CropData>>(
    projet.photoCrops ?? {}
  );
  const [cropEditMode, setCropEditMode] = useState(false);
  const [measureTrigger, setMeasureTrigger] = useState(0);

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

  // Le projet visualisé inclut les crops courants — l'iframe les applique
  // automatiquement (CSS). En mode crop, les overlays se superposent à ces
  // photos déjà recadrées pour permettre l'ajustement.
  const previewProjet = { ...projet, template, bandeauConfig, photoCrops };

  return (
    <>
      {!isPrint && (
        <ProjetToolbar
          projet={projet}
          template={template}
          manualConfig={manualConfig}
          bandeauConfig={bandeauConfig}
          photoCrops={photoCrops}
          cropEditMode={cropEditMode}
          onCropEditModeChange={setCropEditMode}
          onTemplateChange={handleTemplateChange}
          onSave={() => setMeasureTrigger(t => t + 1)}
        />
      )}
      {isManualLayout ? (
        <div style={{ display: 'flex', alignItems: 'stretch', background: '#ECECEC', minHeight: 'calc(100vh - 48px)' }}>
          <LayoutSidebar
            projet={projet}
            config={manualConfig}
            onChange={setManualConfig}
            bandeauConfig={bandeauConfig}
            onBandeauChange={setBandeauConfig}
            isDev={template === 'Dev'}
          />
          <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: 16 }}>
            <TemplatePreview
              projet={previewProjet}
              manualConfig={manualConfig}
              measureTrigger={measureTrigger}
              cropEditMode={cropEditMode}
              photoCrops={photoCrops}
              onPhotoCropsChange={setPhotoCrops}
            />
          </main>
        </div>
      ) : (
        <TemplatePreview
          projet={previewProjet}
          manualConfig={undefined}
          cropEditMode={cropEditMode}
          photoCrops={photoCrops}
          onPhotoCropsChange={setPhotoCrops}
        />
      )}
    </>
  );
}
