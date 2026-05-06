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
      {!isPrint && template === 'Manuel' && (
        <ManualConfigPanel projet={projet} config={manualConfig} onChange={setManualConfig} />
      )}
      <TemplatePreview
        projet={{ ...projet, template }}
        manualConfig={template === 'Manuel' ? manualConfig : undefined}
      />
    </>
  );
}
