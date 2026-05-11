import type { Projet } from '@/types/projet';
import { renderMarkdown } from '@/lib/utils/markdown';
import {
  TemplateBundle,
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
   La quantité de texte affichée par colonne est contrôlée par les sliders
   col1Percent / col2Percent (% du texte total). Pas de hauteur explicite :
   la colonne s'adapte naturellement au contenu fourni. */
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
.man-text strong { font-weight: 700; }
.man-text em { font-style: italic; }
.man-text u { text-decoration: underline; }
.man-text a { color: var(--ai-rouge); text-decoration: underline; }
.man-text ul, .man-text ol { margin: 0 0 2.5mm 5mm; padding: 0; font-size: 9.5pt; line-height: 1.5; }
.man-text li { margin-bottom: 0.8mm; }
.man-text--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
}
.man-text--2col > .man-col-1 {
  padding-right: 6mm;
  border-right: 1px solid var(--ai-gris);
}
.man-text--2col > .man-col-2 {
  padding-left: 6mm;
}

/* ── Photos additionnelles : grille N colonnes ─────── */
.man-extra-grid {
  display: grid;
  gap: 3mm;
  width: 100%;
  /* Permet aux photos de remonter au-dessus du texte si offsetVerticalPercent < 50 */
  position: relative;
  z-index: 5;
}
.man-extra-grid .photo-frame {
  width: 100%;
  height: auto;
  /* Décalages slider 0..100 → -50%..+50% (horizontal) et 0%..+100% inversé pour vertical */
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0%)
  );
  /* Photo toujours au-dessus du texte de description en cas de chevauchement.
     L'utilisateur voit l'overlap et ajuste les sliders en conséquence. */
  position: relative;
  z-index: 10;
}
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

/**
 * Trouve l'index de coupure le plus proche d'une cible donnée, en se calant
 * sur un caractère "." pour finir proprement une phrase.
 *
 * Algorithme :
 * - Deux pointeurs partent de `target` (un vers la droite, un vers la gauche)
 * - Le premier qui tombe sur '.' gagne, on coupe à p + 2 (saute "." + espace)
 * - Fallback si aucun '.' : premier espace après target ; sinon `target`
 * - Index est clampé dans [0, text.length]
 */
function findSplitIndex(text: string, target: number): number {
  const T = text.length;
  const X = Math.max(0, Math.min(T, Math.floor(target)));
  if (T < 40 || X >= T) return T;
  let r = X;
  let l = X;
  while (r < T || l > 0) {
    if (r < T && text[r] === '.') return Math.min(T, r + 2);
    if (l > 0 && text[l] === '.') return Math.min(T, l + 2);
    r++;
    l--;
  }
  const sp = text.indexOf(' ', X);
  return sp >= 0 ? sp + 1 : X;
}

function paragraphsToHtml(text: string): string {
  if (!text) return '';
  // Rend le markdown (Airtable rich text). Le texte arrive ici après split
  // sur '.' donc il peut être tronqué au milieu d'un span gras / italique :
  // marked tolère les paires non-fermées en les laissant tel quel, ce qui
  // est acceptable pour le template Manuel (texte délibérément coupé).
  return renderMarkdown(text);
}

/**
 * Sépare la description en deux moitiés HTML pour col 1 et col 2.
 * - col 1 contient les `col1Percent`% premiers caractères, calés sur '.'
 * - col 2 démarre à la fin de col 1 et contient `col2Percent`% du texte total,
 *   également calé sur '.' à la fin (le reste après est masqué).
 */
function splitDescription(
  description: string,
  col1Percent: number,
  col2Percent: number
): [string, string] {
  const T = description.length;
  if (T === 0) return ['', ''];

  const target1 = (col1Percent / 100) * T;
  const splitStart = findSplitIndex(description, target1);

  const target2 = splitStart + (col2Percent / 100) * T;
  const splitEnd = findSplitIndex(description, target2);

  const leftRaw = description.slice(0, splitStart).trim();
  const rightRaw = description.slice(splitStart, splitEnd).trim();
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
  const col1Pct = clampPercent(cfg.textCol1Percent ?? 50);
  const col2Pct = clampPercent(cfg.textCol2Percent ?? 50);

  let textHtml = '';
  if (description.length > 0) {
    if (cfg.textColumns === 1) {
      // En 1-col, col1Percent contrôle la quantité de texte affiché.
      const target = (col1Pct / 100) * description.length;
      const cutoff = findSplitIndex(description, target);
      const ps = paragraphsToHtml(description.slice(0, cutoff).trim());
      textHtml = `<div class="man-text man-text--1col">${ps}</div>`;
    } else {
      const [leftHtml, rightHtml] = splitDescription(description, col1Pct, col2Pct);
      textHtml = `<div class="man-text man-text--2col">
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
      // offsetPercent horizontal (0..100) → translateX -50%..+50% de la cellule
      const xPct = clampPercent(e.offsetPercent ?? 50) - 50;
      // offsetVerticalPercent (0..100) → translateY -100%..+100%
      // 0   = photo remontée d'une hauteur (= entièrement dans le bloc texte au-dessus)
      // 50  = position neutre (sous le texte, comportement historique)
      // 100 = photo descendue d'une hauteur
      const yPct = (clampPercent(e.offsetVerticalPercent ?? 50) - 50) * 2;
      return `<div class="photo-frame" style="--extra-cell-max:${maxMm}mm; --photo-x-offset:${xPct}%; --photo-y-offset:${yPct}%">${photoImg(ph, projet.nom)}</div>`;
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
