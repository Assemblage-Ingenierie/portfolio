'use client';

import { useEffect, useMemo, useState } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { Projet } from '@/types/projet';
import { allPhotos, type PhotoRef } from '@/lib/pdf/templates/shared';
import { photoCropKey, type CropData } from '@/lib/pdf/photoCrop';

/** Hauteur display commune à toutes les photos dans la modale.
 *  Toutes les photos sont rendues à exactement cette hauteur en pixels →
 *  les bords des sélections crop à la même valeur Y % sont au même pixel
 *  vertical, ce qui permet un alignement visuel direct entre photos.
 *  Modifiable via le slider en haut de la modale. */
const DEFAULT_DISPLAY_HEIGHT = 240;
const MIN_DISPLAY_HEIGHT = 140;
const MAX_DISPLAY_HEIGHT = 480;

/**
 * Modale de recadrage non-destructif des photos.
 *
 * Ouverte depuis la toolbar (« ✂ Recadrer les photos »). Affiche toutes les
 * photos du projet dans une grille, avec un ReactCrop sur chacune. Les
 * sélections sont libres (8 poignées : 4 coins + 4 côtés), ce qui permet
 * des crops uniquement horizontaux ou verticaux pour aligner les bords des
 * photos côte à côte dans la fiche A4.
 *
 * L'aperçu A4 en arrière-plan est mis à jour en temps réel à chaque drag.
 */

interface Props {
  /** L'overlay ne s'affiche que si open est true. */
  open: boolean;
  onClose: () => void;
  projet: Projet;
  photoCrops: Record<string, CropData>;
  onChange: (next: Record<string, CropData>) => void;
}

const FULL_CROP: CropData = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

export default function PhotoCropOverlay({
  open,
  onClose,
  projet,
  photoCrops,
  onChange,
}: Props) {
  const photos = useMemo(() => allPhotos(projet), [projet]);
  const [displayHeight, setDisplayHeight] = useState(DEFAULT_DISPLAY_HEIGHT);
  const [showGuide, setShowGuide] = useState(false);
  const [guideY, setGuideY] = useState(0.5); // 0..1 fraction of displayHeight
  /** Shift maintenu → verrouille le ratio actuel sur tous les ReactCrop. */
  const [shiftHeld, setShiftHeld] = useState(false);

  // ESC pour fermer + tracking Shift
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Shift') setShiftHeld(true);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'Shift') setShiftHeld(false);
    }
    function onBlur() {
      // Si la fenêtre perd le focus pendant que Shift est tenu, on reset
      // pour éviter d'être bloqué en mode aspect-lock.
      setShiftHeld(false);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleCropChange(photo: PhotoRef, percent: PercentCrop) {
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
    onChange({ ...photoCrops, [photoCropKey(photo)]: next });
  }

  function handleReset(photo: PhotoRef) {
    const next = { ...photoCrops };
    delete next[photoCropKey(photo)];
    onChange(next);
  }

  function handleResetAll() {
    onChange({});
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recadrer les photos"
      onClick={(e) => {
        // Clic sur le backdrop = fermer
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(20, 22, 30, 0.72)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 4,
          boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
          width: 'min(1100px, 100%)',
          maxHeight: 'calc(100vh - 48px)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'var(--sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 20px',
            borderBottom: '1px solid var(--ai-gris)',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: '11pt', fontWeight: 700, color: 'var(--ai-violet)' }}>
              ✂ Recadrer les photos
            </div>
            <div style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginTop: 2 }}>
              Toutes les photos sont affichées à la même hauteur — glissez les sélections pour aligner visuellement leurs bords. Utilisez la règle rouge comme repère. Maintenez <kbd style={{ background: 'var(--ai-gris)', padding: '0 4px', borderRadius: 2, fontFamily: 'monospace', fontSize: '8pt' }}>Shift</kbd> pendant le drag d&apos;un coin pour verrouiller le format actuel.
            </div>
          </div>

          {/* Indicateur Shift maintenu */}
          {shiftHeld && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 2,
                background: 'var(--ai-rouge)',
                color: 'white',
                fontFamily: 'var(--sans)',
                fontSize: '8pt',
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            >
              🔒 Format verrouillé
            </span>
          )}

          {/* Slider hauteur display */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '8pt', color: 'var(--ai-noir70)' }}>
            Zoom
            <input
              type="range"
              min={MIN_DISPLAY_HEIGHT}
              max={MAX_DISPLAY_HEIGHT}
              step={10}
              value={displayHeight}
              onChange={(e) => setDisplayHeight(Number(e.target.value))}
              style={{ width: 140 }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: '7.5pt', width: 36, textAlign: 'right' }}>
              {displayHeight}px
            </span>
          </label>

          {/* Guide horizontal d'alignement */}
          <button
            type="button"
            onClick={() => setShowGuide((v) => !v)}
            style={{
              padding: '6px 12px',
              borderRadius: 2,
              border: '1px solid var(--ai-gris)',
              background: showGuide ? 'var(--ai-violet)' : 'white',
              color: showGuide ? 'white' : 'var(--ai-violet)',
              fontFamily: 'var(--sans)',
              fontSize: '8.5pt',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Affiche une règle horizontale traversant toutes les photos"
          >
            {showGuide ? '✓ Règle' : 'Règle'}
          </button>

          <button
            type="button"
            onClick={handleResetAll}
            style={{
              padding: '6px 12px',
              borderRadius: 2,
              border: '1px solid var(--ai-gris)',
              background: 'white',
              color: 'var(--ai-violet)',
              fontFamily: 'var(--sans)',
              fontSize: '8.5pt',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tout réinitialiser
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 2,
              border: 'none',
              background: 'var(--ai-violet)',
              color: 'white',
              fontFamily: 'var(--sans)',
              fontSize: '8.5pt',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>

        {/* Rangée horizontale — toutes les photos à la même hauteur display
            pour permettre l'alignement visuel des bords entre photos. */}
        <div
          style={{
            overflow: 'auto',
            padding: '24px 20px',
            background: '#F7F8FA',
            position: 'relative',
          }}
        >
          {photos.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>
              Aucune photo dans ce projet.
            </div>
          )}
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              // Largeur naturelle (somme des photos) → scroll horizontal si dépassement
              minWidth: 'min-content',
              position: 'relative',
            }}
          >
            {photos.map((photo, idx) => {
              const key = photoCropKey(photo);
              const crop = photoCrops[key] ?? FULL_CROP;
              const cropped = !!photoCrops[key];
              return (
                <div
                  key={key}
                  style={{
                    background: 'white',
                    borderRadius: 4,
                    border: '1px solid var(--ai-gris)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    flex: '0 0 auto',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 10px',
                      borderBottom: '1px solid var(--ai-gris)',
                      background: 'var(--ai-gris-tres-clair, #F2F2F2)',
                      minHeight: 28,
                    }}
                  >
                    <span style={{ fontSize: '8pt', fontWeight: 700, color: 'var(--ai-violet)' }}>
                      Photo {idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: '7.5pt',
                        color: 'var(--ai-noir70)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 220,
                      }}
                      title={photo.filename}
                    >
                      {photo.filename}
                    </span>
                    {cropped && (
                      <button
                        type="button"
                        onClick={() => handleReset(photo)}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 2,
                          border: '1px solid var(--ai-rouge)',
                          background: 'white',
                          color: 'var(--ai-rouge)',
                          fontFamily: 'var(--sans)',
                          fontSize: '7pt',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        'repeating-conic-gradient(#eee 0% 25%, #f7f7f7 0% 50%) 50% / 14px 14px',
                    }}
                  >
                    <ReactCrop
                      crop={crop}
                      onChange={(_, p) => handleCropChange(photo, p)}
                      keepSelection
                      ruleOfThirds
                      // Shift maintenu → on locke l'aspect ratio actuel du
                      // crop (en tenant compte des dims natives de la photo
                      // pour que le ratio soit le ratio VISUEL, pas le ratio
                      // en % d'image). Sinon : pas de lock, 8 poignées
                      // (4 coins + 4 milieux) pour crops H/V libres.
                      aspect={
                        shiftHeld
                          ? ((photo.width ?? 1) * crop.width) /
                            ((photo.height ?? 1) * crop.height || 1)
                          : undefined
                      }
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.filename}
                        draggable={false}
                        style={{
                          display: 'block',
                          height: displayHeight,
                          width: 'auto',
                          maxWidth: 'none',
                          userSelect: 'none',
                        }}
                      />
                    </ReactCrop>
                  </div>
                  <div
                    style={{
                      padding: '4px 10px',
                      fontSize: '7pt',
                      color: 'var(--ai-noir70)',
                      fontFamily: 'monospace',
                      borderTop: '1px solid var(--ai-gris)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cropped
                      ? `y:${crop.y.toFixed(0)}  h:${crop.height.toFixed(0)}  x:${crop.x.toFixed(0)}  w:${crop.width.toFixed(0)} (%)`
                      : 'non recadré'}
                  </div>
                </div>
              );
            })}
            {/* Règle horizontale d'alignement — barre rouge fine traversant
                toutes les photos. La position Y est en fraction (0..1) de la
                hauteur display, donc cohérente entre photos. */}
            {showGuide && (
              <div
                onMouseDown={(e) => {
                  // Drag handler pour repositionner la règle
                  const startY = e.clientY;
                  const startGuide = guideY;
                  function onMove(ev: MouseEvent) {
                    const dy = ev.clientY - startY;
                    setGuideY(Math.max(0, Math.min(1, startGuide + dy / displayHeight)));
                  }
                  function onUp() {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  }
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  // Position relative au début de la zone photo (header ~28px + border)
                  top: 28 + 1 + guideY * displayHeight - 1,
                  height: 2,
                  background: 'var(--ai-rouge)',
                  cursor: 'ns-resize',
                  zIndex: 10,
                  boxShadow: '0 0 0 1px white, 0 0 4px rgba(0,0,0,0.3)',
                  pointerEvents: 'auto',
                }}
                title="Glissez pour déplacer la règle"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
