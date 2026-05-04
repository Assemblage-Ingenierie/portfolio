import type { Projet } from '@/types/projet';
import {
  TemplateBundle, esc,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml,
  photoImg, allPhotos,
} from './shared';
import { ManualConfig, DEFAULT_MANUAL_CONFIG } from '../manualConfig';

/**
 * Plafond par dimension (mm) — la valeur effective est ce plafond × sizePercent / 100.
 *
 * Paysage : photo unique pleine largeur, hauteur jusqu'à 130mm.
 * Portrait : 2 photos côte à côte, chacune jusqu'à 130mm de hauteur (boîte ~84mm × 130mm).
 * Extra (1 col) : photo libre à gauche, plafond 80mm.
 * Extra (2 col) : photo en bas de col 2, plafond 90mm.
 */
const PAYSAGE_MAX_MM = 130;
const PORTRAIT_MAX_MM = 130;
const EXTRA_LEFT_MAX_MM = 80;
const EXTRA_COL2_MAX_MM = 90;

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
.man-page > footer {
  flex: 0 0 auto;
}
.man-page > .man-text {
  flex: 1 1 0;
  min-height: 0;
}

/* Photo principale paysage : 1 frame pleine largeur */
.man-photos--paysage {
  width: 100%;
}
.man-photos--paysage .photo-frame {
  width: 100%;
  height: auto;
}
.man-photos--paysage .photo-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: var(--main-photo-max, 110mm);
  object-fit: contain;
}

/* Photo principale portrait : 2 frames côte à côte */
.man-photos--portrait {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
  width: 100%;
}
.man-photos--portrait .photo-frame {
  width: 100%;
  height: auto;
}
.man-photos--portrait .photo-frame:nth-child(1) .photo-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: var(--main-photo1-max, 100mm);
  object-fit: contain;
}
.man-photos--portrait .photo-frame:nth-child(2) .photo-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: var(--main-photo2-max, 100mm);
  object-fit: contain;
}

/* Bloc texte — 1 ou 2 colonnes */
.man-text {
  font-family: var(--sans);
}
.man-text--1col .man-text-p,
.man-text--2col .man-text-p {
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
}
.man-text--2col {
  column-count: 2;
  column-gap: 6mm;
  column-rule: 1px solid var(--ai-gris);
}
.man-text--2col .man-text-p {
  break-inside: avoid;
}

/* Photo additionnelle en mode 1 col : alignée à gauche, taille libre */
.man-extra-photo--left {
  margin-top: 4mm;
  display: block;
}
.man-extra-photo--left .photo-img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: var(--extra-photo-max, 70mm);
  object-fit: contain;
  display: block;
}

/* Photo additionnelle en mode 2 col : forcée en col 2, en bas */
.man-extra-photo--col2 {
  break-before: column;
  break-inside: avoid;
  margin-top: 4mm;
  width: 100%;
}
.man-extra-photo--col2 .photo-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: var(--extra-photo-max, 70mm);
  object-fit: contain;
}
`;

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function renderManuel(projet: Projet, configIn?: ManualConfig): TemplateBundle {
  const cfg: ManualConfig = configIn ?? DEFAULT_MANUAL_CONFIG;
  const photos = allPhotos(projet);

  // Photos sélectionnées (avec garde-fou index)
  const main1 = photos[cfg.mainPhoto?.index ?? 0];
  const main2Cfg = cfg.mainPhoto2 ?? { index: 1, sizePercent: 100 };
  const main2 = cfg.mainPhotoFormat === 'portrait' ? photos[main2Cfg.index] : undefined;
  const extraCfg = cfg.extraPhoto;
  const extra = extraCfg ? photos[extraCfg.index] : undefined;

  // Calcul des max-heights effectives à partir des sliders
  const main1Pct = clampPercent(cfg.mainPhoto?.sizePercent ?? 100);
  const main2Pct = clampPercent(main2Cfg.sizePercent);
  const extraPct = clampPercent(extraCfg?.sizePercent ?? 100);

  const main1MaxMm =
    (cfg.mainPhotoFormat === 'paysage' ? PAYSAGE_MAX_MM : PORTRAIT_MAX_MM) * main1Pct / 100;
  const main2MaxMm = PORTRAIT_MAX_MM * main2Pct / 100;
  const extraBase = cfg.textColumns === 1 ? EXTRA_LEFT_MAX_MM : EXTRA_COL2_MAX_MM;
  const extraMaxMm = extraBase * extraPct / 100;

  // Bloc photos haut
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

  // Bloc texte
  const description = (projet.description ?? '').trim();
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const textClass = cfg.textColumns === 1 ? 'man-text man-text--1col' : 'man-text man-text--2col';
  const extraClass = cfg.textColumns === 1 ? 'man-extra-photo man-extra-photo--left' : 'man-extra-photo man-extra-photo--col2';

  const textHtml = paragraphs.length > 0 || extra
    ? `<div class="${textClass}">
        ${paragraphs.map(p => `<p class="man-text-p">${esc(p)}</p>`).join('')}
        ${extra ? `<div class="${extraClass} photo-frame" style="--extra-photo-max:${extraMaxMm}mm">${photoImg(extra, projet.nom)}</div>` : ''}
      </div>`
    : '';

  const body = `<article class="page man-page">
    ${headerHtml(projet)}
    ${titleBlockHtml(projet, '26pt')}
    ${metaGridHtml(projet)}
    ${photosHtml}
    ${textHtml}
    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
