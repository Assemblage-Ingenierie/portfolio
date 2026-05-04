'use client';

import { useMemo } from 'react';
import type { Projet } from '@/types/projet';
import { renderPdfHtml } from '@/lib/pdf/renderHtml';

/**
 * Aperçu fidèle du rendu PDF : iframe contenant exactement le même HTML
 * que celui consommé par la page /projet/[slug]/print + paged.js.
 *
 * L'iframe assure une isolation CSS naturelle (le reset global du template
 * ne pollue pas la toolbar parent).
 */
export default function TemplatePreview({ projet }: { projet: Projet }) {
  // Recalcule le HTML uniquement quand les données du projet changent
  const html = useMemo(() => renderPdfHtml(projet), [projet]);

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
