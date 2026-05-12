'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Projet } from '@/types/projet';
import { renderPdfHtml } from '@/lib/pdf/renderHtml';
import type { ManualConfig } from '@/lib/pdf/manualConfig';
import type { CropData } from '@/lib/pdf/photoCrop';
import { measureOverflow, type OverflowMeasure } from '@/lib/utils/measureOverflow';
import PhotoCropOverlay from '@/components/projet/PhotoCropOverlay';

/**
 * Aperçu fidèle du rendu PDF : iframe contenant exactement le même HTML
 * que celui consommé par la page /projet/[slug]/print.
 *
 * L'iframe assure une isolation CSS naturelle (le reset global du template
 * ne pollue pas la toolbar parent).
 *
 * Détection de débordement A4 (A) : après le load de l'iframe, on mesure
 * le contenu de `.page` et on affiche une bannière rouge si du contenu
 * dépasse — il sera coupé à l'export PDF.
 *
 * Mode crop : si `cropEditMode` est actif, on superpose des sélecteurs
 * react-image-crop sur chaque `.photo-frame` de l'iframe (overlay positionné
 * en absolu dans le conteneur parent).
 */
export default function TemplatePreview({
  projet,
  manualConfig,
  measureTrigger = 0,
  cropEditMode = false,
  photoCrops,
  onPhotoCropsChange,
}: {
  projet: Projet;
  manualConfig?: ManualConfig;
  /** Incrémenter cette valeur force une re-mesure immédiate de l'overflow
   *  sur le contenu déjà chargé (ex : après "Sauvegarder la mise en page"). */
  measureTrigger?: number;
  cropEditMode?: boolean;
  photoCrops?: Record<string, CropData>;
  onPhotoCropsChange?: (next: Record<string, CropData>) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<OverflowMeasure | null>(null);

  const html = useMemo(
    () => renderPdfHtml(projet, manualConfig ? { manualConfig } : undefined),
    [projet, manualConfig]
  );

  // Mesure le débordement à chaque fois que le HTML change ou que l'iframe
  // charge. On laisse aux fonts/images le temps de se stabiliser.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let cancelled = false;
    let raf: number | undefined;

    async function measure() {
      try {
        const doc = iframe?.contentDocument;
        if (!doc) return;
        try { await doc.fonts?.ready; } catch { /* noop */ }
        const imgs = Array.from(doc.querySelectorAll('img'));
        await Promise.all(imgs.map(img =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(r => {
                img.addEventListener('load', () => r(), { once: true });
                img.addEventListener('error', () => r(), { once: true });
              })
        ));
        if (cancelled) return;
        raf = requestAnimationFrame(() => {
          if (cancelled) return;
          raf = requestAnimationFrame(() => {
            if (cancelled) return;
            setOverflow(measureOverflow(doc));
          });
        });
      } catch {
        /* noop */
      }
    }

    function onLoad() { measure(); }
    iframe.addEventListener('load', onLoad);
    measure();

    return () => {
      cancelled = true;
      if (raf !== undefined) cancelAnimationFrame(raf);
      iframe.removeEventListener('load', onLoad);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, measureTrigger]);

  const overflowing = overflow !== null && overflow.overflowMm > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 48px', background: '#ECECEC', minHeight: 'calc(100vh - 48px)' }}>
      {overflowing && (
        <div
          role="alert"
          style={{
            width: '210mm',
            marginBottom: '12px',
            padding: '10px 16px',
            background: 'var(--ai-rouge)',
            color: 'white',
            fontFamily: 'var(--sans)',
            fontSize: '9pt',
            fontWeight: 600,
            borderRadius: '2px',
            boxShadow: '0 2px 8px rgba(227,5,19,0.3)',
            display: 'flex',
            gap: '10px',
            alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: '11pt', lineHeight: 1 }}>⚠</span>
          <span>
            Le contenu dépasse la page A4 de <strong>{overflow!.overflowMm}&nbsp;mm</strong>
            {overflow!.edges && overflow!.edges.length > 0 ? <> (bord{overflow!.edges.length > 1 ? 's' : ''} {overflow!.edges.join(', ')})</> : null}.
            La portion masquée sera coupée à l&apos;export PDF — raccourcir la description,
            réduire la taille / repositionner les photos, ou changer de template.
          </span>
        </div>
      )}
      {cropEditMode && (
        <div
          role="status"
          style={{
            width: '210mm',
            marginBottom: '12px',
            padding: '8px 14px',
            background: 'var(--ai-violet)',
            color: 'white',
            fontFamily: 'var(--sans)',
            fontSize: '8.5pt',
            fontWeight: 600,
            borderRadius: '2px',
          }}
        >
          ✂ Mode recadrage actif — ajustez les sélections directement sur les photos pour aligner leurs bords. Cliquez à nouveau sur « Recadrer » dans la toolbar pour quitter.
        </div>
      )}
      <div ref={previewBoxRef} style={{ position: 'relative', width: '210mm' }}>
        <iframe
          ref={iframeRef}
          title={`Aperçu — ${projet.nom}`}
          srcDoc={html}
          style={{
            width: '210mm',
            minHeight: '297mm',
            border: 'none',
            background: 'white',
            display: 'block',
            // Pendant le crop mode, on désactive les interactions natives de
            // l'iframe (elles sont gérées par les overlays par-dessus).
            pointerEvents: cropEditMode ? 'none' : 'auto',
            boxShadow: overflowing
              ? '0 4px 24px rgba(227,5,19,0.35), 0 0 0 2px var(--ai-rouge)'
              : '0 4px 24px rgba(0,0,0,0.12)',
          }}
        />
        {cropEditMode && photoCrops && onPhotoCropsChange && (
          <PhotoCropOverlay
            iframeRef={iframeRef}
            containerRef={previewBoxRef}
            projet={projet}
            photoCrops={photoCrops}
            onChange={onPhotoCropsChange}
            measureKey={measureTrigger}
          />
        )}
      </div>
    </div>
  );
}
