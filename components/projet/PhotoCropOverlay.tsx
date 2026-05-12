'use client';

import { useEffect, useMemo } from 'react';
import ReactCrop, { type PercentCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import type { Projet } from '@/types/projet';
import { allPhotos, type PhotoRef } from '@/lib/pdf/templates/shared';
import { photoCropKey, type CropData } from '@/lib/pdf/photoCrop';

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

  // ESC pour fermer
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11pt', fontWeight: 700, color: 'var(--ai-violet)' }}>
              ✂ Recadrer les photos
            </div>
            <div style={{ fontSize: '8.5pt', color: 'var(--ai-noir70)', marginTop: 2 }}>
              Glissez les poignées (coins ou milieux des côtés) pour ajuster. L&apos;aperçu A4 se met à jour en direct.
            </div>
          </div>
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

        {/* Grille de photos */}
        <div
          style={{
            overflow: 'auto',
            padding: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 20,
            background: '#F7F8FA',
          }}
        >
          {photos.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ai-noir70)' }}>
              Aucune photo dans ce projet.
            </div>
          )}
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
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderBottom: '1px solid var(--ai-gris)',
                    background: 'var(--ai-gris-tres-clair, #F2F2F2)',
                  }}
                >
                  <span style={{ fontSize: '8.5pt', fontWeight: 700, color: 'var(--ai-violet)' }}>
                    Photo {idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '8pt',
                      color: 'var(--ai-noir70)',
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
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
                        padding: '3px 8px',
                        borderRadius: 2,
                        border: '1px solid var(--ai-rouge)',
                        background: 'white',
                        color: 'var(--ai-rouge)',
                        fontFamily: 'var(--sans)',
                        fontSize: '7.5pt',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
                <div
                  style={{
                    padding: 12,
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
                    // Pas d'aspect lock → 8 poignées (4 coins + 4 milieux des côtés)
                    // permettant des crops uniquement horizontaux ou verticaux.
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.filename}
                      draggable={false}
                      style={{
                        display: 'block',
                        maxWidth: '100%',
                        maxHeight: '50vh',
                        userSelect: 'none',
                      }}
                    />
                  </ReactCrop>
                </div>
                <div
                  style={{
                    padding: '8px 12px',
                    fontSize: '7.5pt',
                    color: 'var(--ai-noir70)',
                    fontFamily: 'monospace',
                    borderTop: '1px solid var(--ai-gris)',
                  }}
                >
                  {cropped
                    ? `x: ${crop.x.toFixed(1)}%  ·  y: ${crop.y.toFixed(1)}%  ·  ${crop.width.toFixed(1)} × ${crop.height.toFixed(1)} %`
                    : 'Aucun recadrage'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
