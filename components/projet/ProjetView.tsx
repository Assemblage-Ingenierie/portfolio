'use client';

import { useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import TemplatePreview from '@/components/TemplatePreview';
import { authHeaders } from '@/lib/supabase/authHeaders';
import ProjetToolbar from './ProjetToolbar';

interface Props {
  projet: Projet;
  isPrint: boolean;
}

export default function ProjetView({ projet, isPrint }: Props) {
  const [template, setTemplate] = useState<TemplateChoice>(projet.template);

  async function handleTemplateChange(newTemplate: TemplateChoice) {
    setTemplate(newTemplate);
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
          onTemplateChange={handleTemplateChange}
        />
      )}
      <TemplatePreview projet={{ ...projet, template }} />
    </>
  );
}
