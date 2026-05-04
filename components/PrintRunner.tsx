'use client';

import { useEffect } from 'react';

/**
 * Pagination native du navigateur via les règles CSS @page A4.
 * window.print() ouvre la boîte de dialogue système qui permet d'enregistrer
 * en PDF (option "Save as PDF" / "Microsoft Print to PDF").
 *
 * Pourquoi pas paged.js : trop fragile dans le contexte React/Next.js
 * (timing du polyfill, DOM cloning, race conditions sur PagedConfig).
 * Pour des fiches projet d'une page A4, le moteur d'impression natif
 * (Chromium/WebKit/Gecko) suffit largement et donne le même résultat.
 */
export default function PrintRunner() {
  useEffect(() => {
    // Marquer le head pour que les polices Google Fonts soient prêtes
    // avant le print preview (sinon Chromium peut printer avec polices fallback).
    document.fonts?.ready?.then(() => {
      // pas de side-effect, juste assurer que les polices sont chargées
    });
  }, []);

  return (
    <div className="print-toolbar" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 9999, fontFamily: 'sans-serif', alignItems: 'center' }}>
      <button
        onClick={() => window.print()}
        style={{ padding: '8px 14px', background: '#E30513', color: 'white', border: 'none', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Imprimer / Enregistrer en PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{ padding: '8px 14px', background: 'white', color: '#30323E', border: '1px solid #DFE4E8', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
      >
        Fermer
      </button>
    </div>
  );
}
