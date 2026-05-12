'use client';

import { useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import LayoutSidebar from '@/components/projet/LayoutSidebar';
import { authedFetch } from '@/lib/supabase/authHeaders';
import { DEFAULT_MANUAL_CONFIG, ManualConfig } from '@/lib/pdf/manualConfig';
import type { BandeauConfig } from '@/lib/pdf/bandeauConfig';
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

  return (
    <>
      {!isPrint && (
        <ProjetToolbar
          projet={projet}
          template={template}
          manualConfig={manualConfig}
          bandeauConfig={bandeauConfig}
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
              projet={{ ...projet, template, bandeauConfig }}
              manualConfig={manualConfig}
              measureTrigger={measureTrigger}
            />
          </main>
        </div>
      ) : (
        <TemplatePreview
          projet={{ ...projet, template, bandeauConfig }}
          manualConfig={undefined}
        />
      )}
    </>
  );
}
