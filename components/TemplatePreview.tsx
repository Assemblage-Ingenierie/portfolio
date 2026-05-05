'use client';

import { useMemo } from 'react';
import type { Projet } from '@/types/projet';
import { renderPdfHtml } from '@/lib/pdf/renderHtml';
import type { ManualConfig } from '@/lib/pdf/manualConfig';

/**
 * Aperçu fidèle du rendu PDF : iframe contenant exactement le même HTML
 * que celui consommé par la page /projet/[slug]/print.
 *
 * L'iframe assure une isolation CSS naturelle (le reset global du template
 * ne pollue pas la toolbar parent).
 */
export default function TemplatePreview({
  projet,
  manualConfig,
}: {
  projet: Projet;
  manualConfig?: ManualConfig;
}) {
  // Recalcule le HTML uniquement quand les données du projet ou la config changent
  const html = useMemo(
    () => renderPdfHtml(projet, manualConfig ? { manualConfig } : undefined),
    [projet, manualConfig]
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px 48px', background: '#ECECEC', minHeight: 'calc(100vh - 48px)' }}>
      <iframe
        title={`Aperçu — ${projet.nom}`}
        srcDoc={html}
        style={{
          width: '210mm',
          minHeight: '297mm',
          border: 'none',
          background: 'white',
          boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
}
