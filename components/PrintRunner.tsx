'use client';

import { useEffect, useState } from 'react';
import { measureOverflow, type OverflowMeasure } from '@/lib/utils/measureOverflow';

/**
 * Pagination native du navigateur via les règles CSS @page A4.
 * window.print() ouvre la boîte de dialogue système qui permet d'enregistrer
 * en PDF (option "Save as PDF" / "Microsoft Print to PDF").
 *
 * Pourquoi pas paged.js : trop fragile dans le contexte React/Next.js
 * (timing du polyfill, DOM cloning, race conditions sur PagedConfig).
 * Pour des fiches projet d'une page A4, le moteur d'impression natif
 * (Chromium/WebKit/Gecko) suffit largement et donne le même résultat.
 *
 * Garde-fou client-side : après que le navigateur ait peint la page, on
 * mesure les éventuelles photos conditionnelles (.tri-extra-photo) et on
 * les masque si elles débordent du cadre A4. Le serveur fait une estimation
 * mm mais ne peut pas connaître la vraie taille rendue (fonte, images,
 * justification). Ce check JS attrape les cas que l'estimation rate.
 */
export default function PrintRunner() {
  const [adjusted, setAdjusted] = useState(false);
  const [overflow, setOverflow] = useState<OverflowMeasure | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function adjust() {
      // Attendre fonts + images pour avoir des dimensions stables
      try { await document.fonts?.ready; } catch { /* noop */ }
      await waitForImages();
      // Donner une frame supplémentaire pour la mise en page finale
      await new Promise(r => requestAnimationFrame(() => r(undefined)));
      if (cancelled) return;

      hideOverflowingExtraPhotos();
      // B — filet de sécurité : on mesure le débordement résiduel après
      // les ajustements automatiques et on bloque l'export si besoin.
      setOverflow(measureOverflow(document));
      setAdjusted(true);
    }

    adjust();
    return () => { cancelled = true; };
  }, []);

  const overflowing = overflow !== null && overflow.overflowMm > 0;

  function handlePrint() {
    if (overflowing) {
      const edgesText = overflow!.edges && overflow!.edges.length > 0
        ? ` (bord${overflow!.edges.length > 1 ? 's' : ''} ${overflow!.edges.join(', ')})`
        : '';
      const ok = window.confirm(
        `Attention : le contenu dépasse la page A4 de ${overflow!.overflowMm} mm${edgesText}.\n\n` +
        `La portion masquée sera coupée à l'export PDF.\n\n` +
        `Continuer quand même ?`
      );
      if (!ok) return;
    }
    window.print();
  }

  return (
    <>
      {overflowing && (
        <div
          className="print-toolbar"
          role="alert"
          style={{
            position: 'fixed', top: 16, left: 16, right: 220, zIndex: 9998,
            padding: '12px 16px',
            background: '#E30513', color: 'white',
            fontFamily: 'sans-serif', fontSize: 13, fontWeight: 600,
            borderRadius: 2,
            boxShadow: '0 4px 14px rgba(227,5,19,0.35)',
            display: 'flex', gap: 12, alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>⚠</span>
          <span>
            Contenu hors page A4 : <strong>{overflow!.overflowMm}&nbsp;mm</strong>
            {overflow!.edges && overflow!.edges.length > 0 ? <> (bord{overflow!.edges.length > 1 ? 's' : ''} {overflow!.edges.join(', ')})</> : null}
            {' '}seront coupés à l&apos;impression. Revenir à l&apos;éditeur pour ajuster.
          </span>
        </div>
      )}
      <div className="print-toolbar" style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8, zIndex: 9999, fontFamily: 'sans-serif', alignItems: 'center' }}>
        {!adjusted && (
          <span style={{ padding: '6px 10px', background: '#30323E', color: 'white', fontSize: 12, borderRadius: 2, fontWeight: 600 }}>
            Mise en page…
          </span>
        )}
        <button
          onClick={handlePrint}
          style={{
            padding: '8px 14px',
            background: overflowing ? '#A8000A' : '#E30513',
            color: 'white', border: 'none', borderRadius: 2,
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
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
    </>
  );
}

/** Attend que toutes les <img> de la page aient fini de charger. */
function waitForImages(): Promise<void> {
  const imgs = Array.from(document.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(img =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>(resolve => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  ).then(() => undefined);
}

/**
 * Pour chaque .tri-extra-photo (3ᵉ photo conditionnelle des Triptyques),
 * tente de la rétrécir jusqu'à ce qu'elle tienne dans la page. Si même à
 * 30 mm elle déborde, on la masque complètement plutôt que de l'imprimer
 * tronquée à droite ou en bas.
 */
function hideOverflowingExtraPhotos() {
  const photos = document.querySelectorAll<HTMLElement>('.tri-extra-photo');
  photos.forEach(photo => {
    const page = photo.closest('.page') as HTMLElement | null;
    if (!page) return;

    const tolerance = 2; // px (sub-pixel rendering)

    // Boucle de rétrécissement : on baisse la hauteur jusqu'à ce que la photo
    // tienne dans la page. Pas de boucle infinie : on s'arrête à 30mm ou à 10
    // itérations max.
    const MIN_MM = 30;
    const STEP_MM = 8;
    let attempts = 0;

    while (attempts < 10) {
      const photoRect = photo.getBoundingClientRect();
      const pageRect = page.getBoundingClientRect();
      const overflowsX = photoRect.right > pageRect.right + tolerance;
      const overflowsY = photoRect.bottom > pageRect.bottom + tolerance;
      if (!overflowsX && !overflowsY) return; // OK, la photo tient

      // Lit la valeur courante de --extra-photo-max (string type "70mm")
      const current = photo.style.getPropertyValue('--extra-photo-max') || '70mm';
      const currentMm = parseInt(current.replace(/[^0-9]/g, ''), 10) || 70;
      const nextMm = currentMm - STEP_MM;
      if (nextMm < MIN_MM) break;
      photo.style.setProperty('--extra-photo-max', `${nextMm}mm`);
      // forcer un reflow pour que getBoundingClientRect renvoie la nouvelle pos
      void photo.offsetHeight;
      attempts++;
    }

    // Plus moyen de la faire tenir → on la masque
    photo.style.display = 'none';
  });
}
