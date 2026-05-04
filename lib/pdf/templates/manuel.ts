import type { Projet } from '@/types/projet';
import {
  TemplateBundle, esc,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml,
  photoImg, allPhotos,
} from './shared';
import { ManualConfig, DEFAULT_MANUAL_CONFIG, PhotoConfig } from '../manualConfig';

/** Plafonds par dimension (mm) — la valeur effective = ce plafond × sizePercent / 100. */
const PAYSAGE_MAX_MM = 130;
const PORTRAIT_MAX_MM = 130;
const EXTRA_GRID_MAX_MM = 80;

const CSS = `
.man-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}
.man-page > header,
.man-page > .t-title-block,
.man-page > .t-meta-grid,
.man-page > .man-photos,
.man-page > .man-text,
.man-page > .man-extra-grid,
.man-page > footer {
  flex: 0 0 auto;
}

/* ── Photos haut de page ─────────────────────────────── */
.man-photos--paysage { width: 100%; }
.man-photos--paysage .photo-frame { width: 100%; height: auto; }
.man-photos--paysage .photo-img {
  width: 100%; height: auto;
  max-width: 100%; max-height: var(--main-photo-max, 110mm);
  object-fit: contain;
}

.man-photos--portrait {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
  width: 100%;
}
.man-photos--portrait .photo-frame { width: 100%; height: auto; }
.man-photos--portrait .photo-frame:nth-child(1) .photo-img {
  width: 100%; height: auto;
  max-width: 100%; max-height: var(--main-photo1-max, 100mm);
  object-fit: contain;
}
.man-photos--portrait .photo-frame:nth-child(2) .photo-img {
  width: 100%; height: auto;
  max-width: 100%; max-height: var(--main-photo2-max, 100mm);
  object-fit: contain;
}

/* ── Texte ────────────────────────────────────────────
   Hauteurs contrôlées par sliders. overflow: hidden coupe net
   le surplus — l'utilisateur voit la coupure et augmente la hauteur.   font-family appliqué à chaque colonne pour cohérence. */
.man-text {
  width: 100%;
}
.man-text p {
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
  font-family: var(--sans);
}
.man-text--1col {
  height: var(--col1-h, 80mm);
  overflow: hidden;
}
.man-text--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.man-text--2col > .man-col-1 {
  height: var(--col1-h, 80mm);
  overflow: hidden;
  padding-right: 6mm;
  border-right: 1px solid var(--ai-gris);
}
.man-text--2col > .man-col-2 {
  height: var(--col2-h, 80mm);
  overflow: hidden;
  padding-left: 6mm;
}

/* ── Photos additionnelles : grille N colonnes ─────── */
.man-extra-grid {
  display: grid;
  gap: 3mm;
  width: 100%;
}
.man-extra-grid .photo-frame { width: 100%; height: auto; }
.man-extra-grid .photo-img {
  width: 100%; height: auto;
  max-width: 100%;
  max-height: var(--extra-cell-max, 60mm);
  object-fit: contain;
}
`;

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function clampMm(v: number, min = 30, max = 250): number {
  if (Number.isNaN(v)) return 80;
  return Math.max(min, Math.min(max, Math.round(v)));
}

/**
 * Trouve l'index du début de la 2ᵉ colonne dans une description complète.
 *
 * Algorithme :
 * - X = floor(length/2)
 * - Deux pointeurs partent de X : un vers la droite, un vers la gauche
 * - Le premier qui tombe sur '.' gagne, on coupe à p + 2 (saute "." + espace)
 * - Fallback si aucun '.' : coupe au premier espace après X
 * - Texte court (<40 chars) : pas de coupure, tout reste en col 1
 */
function findSplitIndex(text: string): number {
  const T = text.length;
  if (T < 40) return T;
  const X = Math.floor(T / 2);
  let r = X;
  let l = X;
  while (r < T || l > 0) {
    if (r < T && text[r] === '.') return r + 2;
    if (l > 0 && text[l] === '.') return l + 2;
    r++;
    l--;
  }
  const sp = text.indexOf(' ', X);
  return sp >= 0 ? sp + 1 : X;
}

function paragraphsToHtml(text: string): string {
  if (!text) return '';
  return text.split(/\n\n+/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
}

/**
 * Sépare la description en deux moitiés HTML pour les colonnes 1 et 2.
 * Utilise findSplitIndex pour couper proprement à la fin d'une phrase.
 */
function splitDescription(description: string): [string, string] {
  const T = description.length;
  if (T === 0) return ['', ''];
  const idx = findSplitIndex(description);
  // Garde-fous : indice hors borne ou trop proche du bord → coupe brute au milieu
  const safeIdx = idx <= 0 || idx >= T - 1 ? Math.floor(T / 2) : idx;
  const leftRaw = description.slice(0, safeIdx).trim();
  const rightRaw = description.slice(safeIdx).trim();
  return [paragraphsToHtml(leftRaw), paragraphsToHtml(rightRaw)];
}

export function renderManuel(projet: Projet, configIn?: ManualConfig): TemplateBundle {
  const cfg: ManualConfig = configIn ?? DEFAULT_MANUAL_CONFIG;
  const photos = allPhotos(projet);

  // ── Photos principales ──
  const main1 = photos[cfg.mainPhoto?.index ?? 0];
  const main2Cfg = cfg.mainPhoto2 ?? { index: 1, sizePercent: 100 };
  const main2 = cfg.mainPhotoFormat === 'portrait' ? photos[main2Cfg.index] : undefined;

  const main1Pct = clampPercent(cfg.mainPhoto?.sizePercent ?? 100);
  const main2Pct = clampPercent(main2Cfg.sizePercent);
  const main1MaxMm =
    (cfg.mainPhotoFormat === 'paysage' ? PAYSAGE_MAX_MM : PORTRAIT_MAX_MM) * main1Pct / 100;
  const main2MaxMm = PORTRAIT_MAX_MM * main2Pct / 100;

  let photosHtml = '';
  if (cfg.mainPhotoFormat === 'paysage' && main1) {
    photosHtml = `<div class="man-photos man-photos--paysage" style="--main-photo-max:${main1MaxMm}mm">
      <div class="photo-frame">${photoImg(main1, projet.nom)}</div>
    </div>`;
  } else if (cfg.mainPhotoFormat === 'portrait' && (main1 || main2)) {
    photosHtml = `<div class="man-photos man-photos--portrait" style="--main-photo1-max:${main1MaxMm}mm; --main-photo2-max:${main2MaxMm}mm">
      ${main1 ? `<div class="photo-frame">${photoImg(main1, projet.nom)}</div>` : '<div></div>'}
      ${main2 ? `<div class="photo-frame">${photoImg(main2, projet.nom)}</div>` : '<div></div>'}
    </div>`;
  }

  // ── Texte ──
  const description = (projet.description ?? '').trim();
  const col1H = clampMm(cfg.textCol1HeightMm ?? 80);
  const col2H = clampMm(cfg.textCol2HeightMm ?? 80);

  let textHtml = '';
  if (description.length > 0) {
    if (cfg.textColumns === 1) {
      const ps = paragraphsToHtml(description);
      textHtml = `<div class="man-text man-text--1col" style="--col1-h:${col1H}mm">${ps}</div>`;
    } else {
      const [leftHtml, rightHtml] = splitDescription(description);
      textHtml = `<div class="man-text man-text--2col" style="--col1-h:${col1H}mm; --col2-h:${col2H}mm">
        <div class="man-col-1">${leftHtml}</div>
        <div class="man-col-2">${rightHtml}</div>
      </div>`;
    }
  }

  // ── Photos additionnelles : grille N colonnes (identique en 1-col et 2-col) ──
  const extraPhotos = (cfg.extraPhotos ?? []).filter(
    (e): e is PhotoConfig => Boolean(e) && photos[e.index] !== undefined
  );

  let extraHtml = '';
  if (extraPhotos.length > 0) {
    const cells = extraPhotos.map(e => {
      const ph = photos[e.index]!;
      const pct = clampPercent(e.sizePercent);
      const maxMm = EXTRA_GRID_MAX_MM * pct / 100;
      return `<div class="photo-frame" style="--extra-cell-max:${maxMm}mm">${photoImg(ph, projet.nom)}</div>`;
    }).join('');
    extraHtml = `<div class="man-extra-grid" style="grid-template-columns:repeat(${extraPhotos.length},1fr);">${cells}</div>`;
  }

  const body = `<article class="page man-page">
    ${headerHtml(projet)}
    ${titleBlockHtml(projet, '26pt')}
    ${metaGridHtml(projet)}
    ${photosHtml}
    ${textHtml}
    ${extraHtml}
    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
