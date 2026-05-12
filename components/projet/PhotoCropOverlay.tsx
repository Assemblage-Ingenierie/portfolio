'use client';

import { useEffect, useRef, useState } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { Projet } from '@/types/projet';
import { allPhotos } from '@/lib/pdf/templates/shared';
import { photoCropKey, type CropData } from '@/lib/pdf/photoCrop';

/**
 * Overlay de recadrage in-place sur l'aperçu A4.
 *
 * Objectif : permettre à l'utilisateur d'aligner les bords horizontaux de
 * photos placées côte à côte dans la fiche, en voyant le résultat dans le
 * contexte exact de la mise en page A4.
 *
 * Principe :
 * 1. L'iframe rend toujours les photos avec leurs crops actuels (live).
 * 2. Pour chaque `.photo-frame` détecté dans l'iframe, on calcule sa
 *    position (translatée dans les coords du conteneur parent).
 * 3. On affiche par-dessus un composant <ReactCrop> qui montre l'image
 *    originale ; la sélection initiale = le crop sauvegardé ; l'image
 *    affichée est scalée de sorte que la sélection occupe exactement la
 *    taille du slot dans l'iframe.
 * 4. À chaque drag, on appelle `onChange(filename, percentCrop)`.
 * 5. L'aspect ratio de la sélection est verrouillé à celui du slot, pour
 *    que ce qui est recadré remplisse exactement le cadre de la fiche.
 */

interface FrameSlot {
  key: string;
  url: string;
  left: number;
  top: number;
  width: number;
  height: number;
  /** Aspect ratio du slot (width / height). Utilisé pour locker la sélection. */
  aspect: number;
}

interface Props {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Conteneur parent dans lequel positionner les overlays (coords relatives). */
  containerRef: React.RefObject<HTMLDivElement | null>;
  projet: Projet;
  photoCrops: Record<string, CropData>;
  onChange: (next: Record<string, CropData>) => void;
  /** Re-mesure forcée (incrémenter pour déclencher) — utile après une
   *  re-render d'iframe due à un changement de config layout. */
  measureKey: number;
}

const FULL_CROP: CropData = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

export default function PhotoCropOverlay({
  iframeRef,
  containerRef,
  projet,
  photoCrops,
  onChange,
  measureKey,
}: Props) {
  const [slots, setSlots] = useState<FrameSlot[]>([]);
  const measureRafRef = useRef<number | undefined>(undefined);

  // (Re)mesure les positions des photo-frames dans l'iframe.
  useEffect(() => {
    const iframe = iframeRef.current;
    const container = containerRef.current;
    if (!iframe || !container) return;

    const photos = allPhotos(projet);

    function measure() {
      const doc = iframe?.contentDocument;
      if (!doc || !container) return;
      const frames = Array.from(
        doc.querySelectorAll<HTMLElement>('.photo-frame, .photo-cropped')
      );
      const containerRect = container.getBoundingClientRect();
      const next: FrameSlot[] = [];

      for (const frame of frames) {
        const img = frame.querySelector('img');
        if (!img) continue;
        const src = img.getAttribute('src') ?? '';
        const photo = photos.find((p) => p.url === src);
        if (!photo) continue;
        const r = frame.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        next.push({
          key: photoCropKey(photo),
          url: photo.url,
          left: r.left - containerRect.left,
          top: r.top - containerRect.top,
          width: r.width,
          height: r.height,
          aspect: r.width / Math.max(1, r.height),
        });
      }
      setSlots(next);
    }

    function scheduleMeasure() {
      if (measureRafRef.current !== undefined) {
        cancelAnimationFrame(measureRafRef.current);
      }
      // Double rAF pour laisser le layout se stabiliser après load/changement.
      measureRafRef.current = requestAnimationFrame(() => {
        measureRafRef.current = requestAnimationFrame(measure);
      });
    }

    function onLoad() {
      scheduleMeasure();
    }

    iframe.addEventListener('load', onLoad);
    scheduleMeasure();

    // Surveiller les redimensionnements de la fenêtre (zoom navigateur,
    // resize) — les slots bougent quand la taille du container change.
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(iframe);
    ro.observe(container);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);

    return () => {
      iframe.removeEventListener('load', onLoad);
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      if (measureRafRef.current !== undefined) {
        cancelAnimationFrame(measureRafRef.current);
      }
    };
  }, [iframeRef, containerRef, projet, measureKey, photoCrops]);

  function handleChange(slotKey: string, percent: PercentCrop) {
    // PercentCrop : { unit:'%', x, y, width, height }
    // On filtre les valeurs invalides (NaN) et on clampe à [0, 100].
    if (
      !isFinite(percent.x) ||
      !isFinite(percent.y) ||
      !isFinite(percent.width) ||
      !isFinite(percent.height) ||
      percent.width <= 0.5 ||
      percent.height <= 0.5
    ) return;

    const next: CropData = {
      unit: '%',
      x: Math.max(0, Math.min(100, percent.x)),
      y: Math.max(0, Math.min(100, percent.y)),
      width: Math.max(0.5, Math.min(100, percent.width)),
      height: Math.max(0.5, Math.min(100, percent.height)),
    };
    onChange({ ...photoCrops, [slotKey]: next });
  }

  function handleReset(slotKey: string) {
    const next = { ...photoCrops };
    delete next[slotKey];
    onChange(next);
  }

  return (
    <>
      {slots.map((slot) => {
        const crop = photoCrops[slot.key] ?? FULL_CROP;
        // Scale : afficher l'image originale de sorte que la zone du crop
        // occupe exactement la taille du slot. Si crop = 100% → image
        // displayée à la taille du slot. Si crop = 50% → image displayée
        // 2× la taille du slot.
        const cw = Math.max(0.01, crop.width);
        const ch = Math.max(0.01, crop.height);
        const imgWidth = slot.width * (100 / cw);
        const imgHeight = slot.height * (100 / ch);
        // Position de l'image affichée pour que la zone du crop coïncide
        // avec le slot dans l'iframe.
        const imgLeft = slot.left - (crop.x / 100) * imgWidth;
        const imgTop = slot.top - (crop.y / 100) * imgHeight;

        return (
          <div
            key={slot.key}
            style={{
              position: 'absolute',
              left: imgLeft,
              top: imgTop,
              width: imgWidth,
              height: imgHeight,
              zIndex: 50,
              // L'image dépasse le slot — masquer les zones hors écran A4
              // n'est pas nécessaire car ReactCrop affiche le fond original
              // (utile pour aligner par référence au-delà du cadre).
            }}
          >
            <ReactCrop
              crop={crop}
              onChange={(_, p) => handleChange(slot.key, p)}
              aspect={slot.aspect}
              keepSelection
              ruleOfThirds
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slot.url}
                alt=""
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                } as React.CSSProperties}
              />
            </ReactCrop>
            {/* Mini-bouton reset si crop actif */}
            {photoCrops[slot.key] && (
              <button
                type="button"
                onClick={() => handleReset(slot.key)}
                style={{
                  position: 'absolute',
                  top: (crop.y / 100) * imgHeight + 4,
                  left: (crop.x / 100) * imgWidth + (crop.width / 100) * imgWidth - 28,
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  cursor: 'pointer',
                  fontFamily: 'var(--sans)',
                  fontSize: '11pt',
                  lineHeight: 1,
                  zIndex: 51,
                }}
                title="Réinitialiser le recadrage"
              >
                ×
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}
