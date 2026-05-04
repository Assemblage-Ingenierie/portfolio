'use client';

import { useState } from 'react';
import type { Projet, TemplateChoice } from '@/types/projet';
import LayoutEditorial from '@/components/layouts/LayoutEditorial';
import LayoutMagazine from '@/components/layouts/LayoutMagazine';
import { templateToLegacyLayout } from '@/lib/pdf/templateLayout';
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

  const legacyLayout = templateToLegacyLayout(template);

  return (
    <>
      {!isPrint && (
        <ProjetToolbar
          projet={projet}
          template={template}
          onTemplateChange={handleTemplateChange}
        />
      )}
      {legacyLayout === 'Magazine'
        ? <LayoutMagazine projet={{ ...projet, template }} />
        : <LayoutEditorial projet={{ ...projet, template }} />
      }
    </>
  );
}
