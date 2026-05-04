import type { Projet } from '@/types/projet';
import {
  TemplateBundle, esc,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml,
  photoImg, allPhotos,
} from './shared';
import { ManualConfig, DEFAULT_MANUAL_CONFIG, PhotoConfig } from '../manualConfig';

/** Plafond par dimension (mm) — la valeur effective = ce plafond × sizePercent / 100. */
const PAYSAGE_MAX_MM = 130;
const PORTRAIT_MAX_MM = 130;
const EXTRA_GRID_MAX_MM = 80;   // photos en grille sous texte 1-col
const EXTRA_COL2_MAX_MM = 90;   // photo en bas de col 2 (mode 2-col)

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
  display: flex;
  flex-direction: column;
  gap: 4mm;
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

/* ── Texte 1 colonne ─────────────────────────────── */
.man-text--1col {
  font-family: var(--sans);
}
.man-text--1col .man-text-content > p {
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
}

/* Photos additionnelles en mode 1-col : grille N colonnes */
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

/* ── Texte 2 colonnes (grid au lieu de column-count) ──
   Permet d'ancrer la photo additionnelle au bas de la col 2 sans
   débordement vers une "col 3" inexistante. */
.man-text--2col {
  font-family: var(--sans);
  display: grid;
  grid-template-columns: 1fr 1fr;
}
.man-text--2col > .man-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.man-text--2col > .man-col-1 {
  padding-right: 6mm;
  border-right: 1px solid var(--ai-gris);
}
.man-text--2col > .man-col-2 {
  padding-left: 6mm;
}
.man-text--2col p {
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
}
.man-text--2col .man-extra-bottom {
  margin-top: auto;        /* ancre au bas de la col 2 */
  width: 100%;
}
.man-text--2col .man-extra-bottom .photo-img {
  width: 100%; height: auto;
  max-width: 100%;
  max-height: var(--extra-photo-max, 70mm);
  object-fit: contain;
}
`;

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Sépare la liste de paragraphes en deux moitiés à peu près équilibrées en
 * nombre de caractères (pour le mode 2-col qui rend chaque moitié dans une
 * colonne distincte au lieu de column-count).
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
      // choisit le point de coupure le plus proche de la moitié
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

  // ── Photos principales (haut de page) ──
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
  const extraPhotos = (cfg.extraPhotos ?? []).filter(
    (e): e is PhotoConfig => Boolean(e) && photos[e.index] !== undefined
  );

  let textHtml = '';

  if (cfg.textColumns === 1) {
    // Mode paragraphe — texte plein largeur + grille de N photos en bas
    const paragraphsHtml = paragraphs.map(p => `<p>${esc(p)}</p>`).join('');

    let extraGridHtml = '';
    if (extraPhotos.length > 0) {
      // Chaque photo a sa propre max-height calculée depuis son slider
      const cells = extraPhotos.map(e => {
        const ph = photos[e.index]!;
        const pct = clampPercent(e.sizePercent);
        const maxMm = EXTRA_GRID_MAX_MM * pct / 100;
        return `<div class="photo-frame" style="--extra-cell-max:${maxMm}mm">${photoImg(ph, projet.nom)}</div>`;
      }).join('');
      extraGridHtml = `<div class="man-extra-grid" style="grid-template-columns:repeat(${extraPhotos.length},1fr);">${cells}</div>`;
    }

    if (paragraphs.length > 0 || extraGridHtml) {
      textHtml = `<div class="man-text man-text--1col">
        <div class="man-text-content">${paragraphsHtml}</div>
        ${extraGridHtml}
      </div>`;
    }
  } else {
    // Mode 2 colonnes : split paragraphes au milieu, chaque côté = flex column.
    // Photo additionnelle (max 1) ancrée en bas de col 2 via margin-top: auto.
    const [left, right] = splitParagraphs(paragraphs);
    const extra = extraPhotos[0]; // une seule photo en mode 2-col
    const extraHtml = extra
      ? (() => {
          const ph = photos[extra.index]!;
          const pct = clampPercent(extra.sizePercent);
          const maxMm = EXTRA_COL2_MAX_MM * pct / 100;
          return `<div class="man-extra-bottom photo-frame" style="--extra-photo-max:${maxMm}mm">${photoImg(ph, projet.nom)}</div>`;
        })()
      : '';

    if (paragraphs.length > 0 || extraHtml) {
      textHtml = `<div class="man-text man-text--2col">
        <div class="man-col man-col-1">
          ${left.map(p => `<p>${esc(p)}</p>`).join('')}
        </div>
        <div class="man-col man-col-2">
          ${right.map(p => `<p>${esc(p)}</p>`).join('')}
          ${extraHtml}
        </div>
      </div>`;
    }
  }

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
