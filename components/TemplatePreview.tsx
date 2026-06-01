'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Projet } from '@/types/projet';
import { renderPdfHtml } from '@/lib/pdf/renderHtml';
import type { ManualConfig } from '@/lib/pdf/manualConfig';
import { measureOverflow, type OverflowMeasure } from '@/lib/utils/measureOverflow';
import { ui } from '@/lib/ui/tokens';

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
 */
export default function TemplatePreview({
  projet,
  manualConfig,
  measureTrigger = 0,
}: {
  projet: Projet;
  manualConfig?: ManualConfig;
  /** Incrémenter cette valeur force une re-mesure immédiate de l'overflow
   *  sur le contenu déjà chargé (ex : après "Sauvegarder la mise en page"). */
  measureTrigger?: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [overflow, setOverflow] = useState<OverflowMeasure | null>(null);

  const html = useMemo(
    () => renderPdfHtml(projet, manualConfig ? { manualConfig } : undefined),
    [projet, manualConfig]
  );

  // Hash léger sur le html : utilisé en `key` sur l'<iframe>. Garantit le
  // remount de l'iframe quand le contenu change, contournement d'un cas
  // ou Chrome n'invalidait pas la doc malgré la mise à jour de l'attribut
  // `srcDoc` (reproduit sur l'annulation d'un saut de ligne dans le bandeau).
  const iframeKey = useMemo(() => {
    let h = 0;
    for (let i = 0; i < html.length; i++) h = ((h << 5) - h + html.charCodeAt(i)) | 0;
    return h;
  }, [html]);

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px 48px', background: ui.fondPage, minHeight: 'calc(100vh - 48px)' }}>
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
      <iframe
        key={iframeKey}
        ref={iframeRef}
        title={`Aperçu — ${projet.nom}`}
        srcDoc={html}
        style={{
          width: '210mm',
          minHeight: '297mm',
          border: 'none',
          background: 'white',
          boxShadow: overflowing
            ? '0 4px 24px rgba(227,5,19,0.35), 0 0 0 2px var(--ai-rouge)'
            : '0 4px 24px rgba(0,0,0,0.12)',
        }}
      />
    </div>
  );
}
