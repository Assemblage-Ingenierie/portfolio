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
 * Sépare les paragraphes en deux moitiés à peu près équilibrées en
 * caractères, pour le mode 2-col qui rend chaque moitié dans une colonne
 * indépendante (au lieu de column-count qui ne supporte pas les hauteurs
 * indépendantes par colonne).
 */
function splitParagraphs(paragraphs: string[]): [string[], string[]] {
  if (paragraphs.length === 0) return [[], []];
  if (paragraphs.length === 1) return [paragraphs, []];
  const total = paragraphs.reduce((s, p) => s + p.length, 0);
  const half = total / 2;
  let acc = 0;
  for (let i = 0; i < paragraphs.length; i++) {
    const next = acc + paragraphs[i].length;
    if (next >= half) {
      const splitIdx = Math.abs(next - half) < Math.abs(acc - half) ? i + 1 : i;
      return [
        paragraphs.slice(0, Math.max(1, splitIdx)),
        paragraphs.slice(Math.max(1, splitIdx)),
      ];
    }
    acc = next;
  }
  return [paragraphs, []];
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
  const paragraphs = description.split(/\n\n+/).filter(Boolean);
  const col1H = clampMm(cfg.textCol1HeightMm ?? 80);
  const col2H = clampMm(cfg.textCol2HeightMm ?? 80);

  let textHtml = '';
  if (paragraphs.length > 0) {
    if (cfg.textColumns === 1) {
      const ps = paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
      textHtml = `<div class="man-text man-text--1col" style="--col1-h:${col1H}mm">${ps}</div>`;
    } else {
      const [left, right] = splitParagraphs(paragraphs);
      const leftPs = left.map(p => `<p>${esc(p)}</p>`).join('');
      const rightPs = right.map(p => `<p>${esc(p)}</p>`).join('');
      textHtml = `<div class="man-text man-text--2col" style="--col1-h:${col1H}mm; --col2-h:${col2H}mm">
        <div class="man-col-1">${leftPs}</div>
        <div class="man-col-2">${rightPs}</div>
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
