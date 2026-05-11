'use client';

import { useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import ManualConfigPanel from '@/components/ManualConfigPanel';
import { authHeaders } from '@/lib/supabase/authHeaders';
import { DEFAULT_MANUAL_CONFIG, ManualConfig } from '@/lib/pdf/manualConfig';
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

  async function handleTemplateChange(newTemplate: TemplateChoice) {
    setTemplate(newTemplate);
    // 'Manuel' n'est pas persisté en Airtable (pas dans les options du champ Template).
    if (newTemplate === 'Manuel') return;
    try {
      await fetch(`/api/projet/${projet.slug}/fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ template: newTemplate }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  // En template Manuel (hors print), on bascule sur un layout 3 colonnes :
  // panneau gauche (Photos additionnelles + Mots-clés) | aperçu | panneau
  // droit (Photo principale + Texte description).
  const isManualLayout = !isPrint && template === 'Manuel';

  return (
    <>
      {!isPrint && (
        <ProjetToolbar
          projet={projet}
          template={template}
          manualConfig={manualConfig}
          onTemplateChange={handleTemplateChange}
        />
      )}
      {isManualLayout ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '16px', background: '#ECECEC', minHeight: 'calc(100vh - 48px)' }}>
          <aside style={{ width: 280, flex: '0 0 280px' }}>
            <ManualConfigPanel
              projet={projet}
              config={manualConfig}
              onChange={setManualConfig}
              side="left"
            />
          </aside>
          <main style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <TemplatePreview
              projet={{ ...projet, template }}
              manualConfig={manualConfig}
            />
          </main>
          <aside style={{ width: 280, flex: '0 0 280px' }}>
            <ManualConfigPanel
              projet={projet}
              config={manualConfig}
              onChange={setManualConfig}
              side="right"
            />
          </aside>
        </div>
      ) : (
        <TemplatePreview
          projet={{ ...projet, template }}
          manualConfig={undefined}
        />
      )}
    </>
  );
}
