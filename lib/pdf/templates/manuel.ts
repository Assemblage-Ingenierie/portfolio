import type { Projet } from '@/types/projet';
import { renderMarkdown, injectSoftHyphensFr } from '@/lib/utils/markdown';
import { styleToCss, photoTextGapCss, bandeauPhotoGapCss } from '@/lib/pdf/bandeauConfig';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml,
  photoImg, allPhotos, findSplitIndex, nudgeWordBoundary,
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
.man-page > .man-extra-anchor,
.man-page > footer {
  flex: 0 0 auto;
}

/* ── Photos haut de page ─────────────────────────────── */
/* Cadre photo principale : décalages X/Y identiques aux photos additionnelles.
   - X en % (relatif à la largeur du cadre)
   - Y en mm absolus (relatif à la page A4 — indépendant de la taille
     de la photo, pour que le slider couvre toute la hauteur utile)
   z-index élevé pour passer au premier plan si chevauchement avec le texte. */
.man-photos { position: relative; z-index: 5; }
.man-photos .photo-frame {
  position: relative;
  z-index: 10;
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0mm)
  );
}

.man-photos--paysage { width: 100%; }
.man-photos--paysage .photo-frame { width: 100%; height: auto; }
.man-photos--paysage .photo-img {
  width: 100%; height: auto;
  max-width: 100%; max-height: var(--main-photo-max, 110mm);
  object-fit: contain;
}

.man-photos--portrait {
  display: grid;
  /* grid-template-columns set inline en fonction du nombre de photos */
  gap: 3mm;
  width: 100%;
}
.man-photos--portrait .photo-frame { width: 100%; height: auto; }
.man-photos--portrait .photo-img {
  width: 100%; height: auto;
  max-width: 100%;
  /* --cell-max est défini par cellule (inline) ; fallback 100mm. */
  max-height: var(--cell-max, 100mm);
  object-fit: contain;
}

/* ── Texte ────────────────────────────────────────────
   La quantité de texte affichée par colonne est contrôlée par les sliders
   col1Percent / col2Percent (% du texte total). Pas de hauteur explicite :
   la colonne s'adapte naturellement au contenu fourni. */
/* Propriétés héritables (font-family, font-size, color, line-height) sur le
   wrapper .man-text — permet à un style inline (bandeauConfig.description)
   appliqué sur ce wrapper d'être hérité par les <p>/<li>/<a> enfants sans
   se faire écraser par une règle plus spécifique. */
.man-text {
  width: 100%;
  font-family: var(--sans);
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
}
.man-text p {
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
}
.man-text strong { font-weight: 700; }
.man-text em { font-style: italic; }
.man-text u { text-decoration: underline; }
.man-text a { color: var(--ai-rouge); text-decoration: underline; }
.man-text ul, .man-text ol { list-style: none; margin: 0 0 2.5mm; padding-left: 0; }
.man-text li { position: relative; padding-left: 5mm; margin-bottom: 0.8mm; }
.man-text ul > li::before { content: "•"; position: absolute; left: 1.5mm; }
.man-text ol { counter-reset: mtext-li; }
.man-text ol > li { counter-increment: mtext-li; }
.man-text ol > li::before { content: counter(mtext-li) "."; position: absolute; left: 0; }
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

/* ── Photos additionnelles : grille N colonnes ───────
   FLOTTANTES — hors-flux : la grille est ancrée par un placeholder de
   hauteur 0 (.man-extra-anchor) placé après le texte. Elle se superpose
   au contenu sans réserver d'espace vertical → le footer n'est pas décalé
   par la taille/position des photos additionnelles. Le neutre
   (offsetVerticalPercent = 50) reste ancré juste sous le texte. */
.man-extra-anchor {
  position: relative;
  height: 0;
}
.man-extra-grid {
  display: grid;
  gap: 3mm;
  /* Ancrée au placeholder (top du flux, juste après le texte). */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
}
.man-extra-grid .photo-frame {
  width: 100%;
  height: auto;
  /* Décalages slider 0..100 → -50%..+50% horizontal (largeur du cadre)
     et -250mm..+250mm vertical (distance absolue sur la page A4 utile,
     calculée côté render pour couvrir toute la hauteur quelle que soit
     la taille de la photo). */
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0mm)
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

/* ── Liste flottante de mots-clés ──────────────────────
   Position absolue ancrée à droite, haut de la zone utile (sous le bandeau).
   Sliders X/Y déplacent depuis cet ancrage. z-index très élevé : passe
   au-dessus de tout autre contenu (photos, texte, bandeau). */
.man-keywords {
  position: absolute;
  top: 80mm;
  right: 12mm;
  margin: 0;
  padding: 0;
  list-style: none;
  z-index: 100;
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0mm)
  );
}
.man-keywords > li {
  display: block;
  margin: 0;
  list-style: none;
}
/* Chaque "tag" : inline-block pour que le surlignage (background) reste
   collé au texte, ne s'étende pas sur toute la largeur du <li>. */
.man-kw-item {
  display: inline-block;
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.4;
  color: var(--ai-noir);
  padding: 0.5mm 2mm;
}

/* ── Liste flottante de certifications ─────────────────
   Comportement identique à .man-keywords mais positionnée plus bas
   (top: 95mm) pour ne pas se superposer par défaut. L'utilisateur ajuste
   ensuite via les sliders X/Y. */
.man-certifications {
  position: absolute;
  top: 95mm;
  right: 12mm;
  margin: 0;
  padding: 0;
  list-style: none;
  z-index: 100;
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0mm)
  );
}
.man-certifications > li {
  display: block;
  margin: 0;
  list-style: none;
}
.man-cert-item {
  display: inline-block;
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.4;
  color: var(--ai-noir);
  padding: 0.5mm 2mm;
}
`;

function clampPercent(v: number): number {
  if (Number.isNaN(v)) return 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

// `findSplitIndex` + `nudgeWordBoundary` (méthode de coupure partagée avec
// le template Dev / la Prestation Assemblage) sont importés depuis shared.ts.

function paragraphsToHtml(text: string): string {
  if (!text) return '';
  // Rend le markdown (Airtable rich text). Le texte arrive ici après split
  // sur '.' donc il peut être tronqué au milieu d'un span gras / italique :
  // marked tolère les paires non-fermées en les laissant tel quel, ce qui
  // est acceptable pour le template Manuel (texte délibérément coupé).
  return injectSoftHyphensFr(renderMarkdown(text));
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
  col2Percent: number,
  col1Nudge = 0,
  col2Nudge = 0
): [string, string] {
  const T = description.length;
  if (T === 0) return ['', ''];

  const target1 = (col1Percent / 100) * T;
  const splitStart = nudgeWordBoundary(description, findSplitIndex(description, target1), col1Nudge);

  const target2 = splitStart + (col2Percent / 100) * T;
  // Le réglage fin de col 2 ne peut pas faire repasser la coupure avant le
  // début de col 2 (sinon col 2 deviendrait négative).
  const splitEnd = Math.max(
    splitStart,
    nudgeWordBoundary(description, findSplitIndex(description, target2), col2Nudge)
  );

  const leftRaw = description.slice(0, splitStart).trim();
  const rightRaw = description.slice(splitStart, splitEnd).trim();
  return [paragraphsToHtml(leftRaw), paragraphsToHtml(rightRaw)];
}

export function renderManuel(projet: Projet, configIn?: ManualConfig): TemplateBundle {
  const cfg: ManualConfig = configIn ?? DEFAULT_MANUAL_CONFIG;
  const photos = allPhotos(projet);

  // ── Photos principales ──
  // Conventions sliders 0..100, 50 = neutre. V_RANGE_MM couvre toute la
  // hauteur utile (la page A4 fait 297mm ; ±250mm = bord à bord).
  const V_RANGE_MM = 250;
  const main1 = photos[cfg.mainPhoto?.index ?? 0];
  const main1Pct = clampPercent(cfg.mainPhoto?.sizePercent ?? 100);
  const main1MaxMm =
    (cfg.mainPhotoFormat === 'paysage' ? PAYSAGE_MAX_MM : PORTRAIT_MAX_MM) * main1Pct / 100;
  const main1XPct = clampPercent(cfg.mainPhoto?.offsetPercent ?? 50) - 50;
  const main1YMm = ((clampPercent(cfg.mainPhoto?.offsetVerticalPercent ?? 50) - 50) / 50) * V_RANGE_MM;
  const main1FrameStyle = `--photo-x-offset:${main1XPct}%; --photo-y-offset:${main1YMm}mm; --cell-max:${main1MaxMm}mm`;

  // Photos portrait additionnelles (au-delà de la première) : on combine
  // mainPhoto2 (legacy) puis mainPhotosExtra[]. Permet 1..MAX photos en
  // mode portrait avec compteur côté UI.
  const portraitExtras: PhotoConfig[] = cfg.mainPhotoFormat === 'portrait'
    ? [
        ...(cfg.mainPhoto2 ? [cfg.mainPhoto2] : []),
        ...(cfg.mainPhotosExtra ?? []),
      ]
    : [];

  function frameForCfg(pc: PhotoConfig, fallbackName: string): string | null {
    const ph = photos[pc.index];
    if (!ph) return null;
    const pct = clampPercent(pc.sizePercent ?? 100);
    const maxMm = PORTRAIT_MAX_MM * pct / 100;
    const xPct = clampPercent(pc.offsetPercent ?? 50) - 50;
    const yMm = ((clampPercent(pc.offsetVerticalPercent ?? 50) - 50) / 50) * V_RANGE_MM;
    const style = `--photo-x-offset:${xPct}%; --photo-y-offset:${yMm}mm; --cell-max:${maxMm}mm`;
    return `<div class="photo-frame" style="${style}">${photoImg(ph, fallbackName, projet)}</div>`;
  }

  let photosHtml = '';
  if (cfg.mainPhotoFormat === 'paysage' && main1) {
    photosHtml = `<div class="man-photos man-photos--paysage" style="--main-photo-max:${main1MaxMm}mm">
      <div class="photo-frame" style="${main1FrameStyle}">${photoImg(main1, projet.nom, projet)}</div>
    </div>`;
  } else if (cfg.mainPhotoFormat === 'portrait') {
    const frames: string[] = [];
    if (main1) frames.push(`<div class="photo-frame" style="${main1FrameStyle}">${photoImg(main1, projet.nom, projet)}</div>`);
    else if (portraitExtras.length > 0) frames.push('<div></div>');
    for (const pc of portraitExtras) {
      const html = frameForCfg(pc, projet.nom);
      if (html) frames.push(html);
    }
    if (frames.length > 0) {
      const cols = frames.length;
      photosHtml = `<div class="man-photos man-photos--portrait" style="grid-template-columns:repeat(${cols},1fr)">${frames.join('')}</div>`;
    }
  }

  // ── Texte ──
  const description = (projet.description ?? '').trim();
  const col1Pct = clampPercent(cfg.textCol1Percent ?? 50);
  const col2Pct = clampPercent(cfg.textCol2Percent ?? 50);

  const descStyle = styleToCss(projet.bandeauConfig?.description);
  // Espacement photo principale ↔ description (slider BandeauConfig.photoTextGap).
  // Combiné avec le style typo de la description dans un seul attribut style.
  const photoTextGap = photoTextGapCss(projet.bandeauConfig);
  const mergedDescStyle = [descStyle, photoTextGap].filter(Boolean).join(';');
  const descAttr = mergedDescStyle ? ` style="${mergedDescStyle}"` : '';

  let textHtml = '';
  if (description.length > 0) {
    if (cfg.textColumns === 1) {
      // En 1-col, col1Percent contrôle la quantité de texte affiché.
      const target = (col1Pct / 100) * description.length;
      const cutoff = nudgeWordBoundary(description, findSplitIndex(description, target), cfg.textCol1Nudge ?? 0);
      const ps = paragraphsToHtml(description.slice(0, cutoff).trim());
      textHtml = `<div class="man-text man-text--1col"${descAttr}>${ps}</div>`;
    } else {
      const [leftHtml, rightHtml] = splitDescription(description, col1Pct, col2Pct, cfg.textCol1Nudge ?? 0, cfg.textCol2Nudge ?? 0);
      textHtml = `<div class="man-text man-text--2col"${descAttr}>
        <div class="man-col-1">${leftHtml}</div>
        <div class="man-col-2">${rightHtml}</div>
      </div>`;
    }
  }

  // ── Photos additionnelles : grille N colonnes (identique en 1-col et 2-col) ──
  // On filtre les entrées invalides (photo absente) ET celles désactivées
  // explicitement par l'utilisateur via la checkbox (enabled === false).
  const extraPhotos = (cfg.extraPhotos ?? []).filter(
    (e): e is PhotoConfig =>
      Boolean(e) && photos[e.index] !== undefined && e.enabled !== false
  );

  let extraHtml = '';
  if (extraPhotos.length > 0) {
    const cells = extraPhotos.map(e => {
      const ph = photos[e.index]!;
      const pct = clampPercent(e.sizePercent);
      const maxMm = EXTRA_GRID_MAX_MM * pct / 100;
      // offsetPercent horizontal (0..100) → translateX -50%..+50% de la cellule
      const xPct = clampPercent(e.offsetPercent ?? 50) - 50;
      // offsetVerticalPercent (0..100) → translateY en mm absolus (page A4).
      // 0   = photo remontée de V_RANGE_MM (haut de la page utile)
      // 50  = position neutre (sous le texte, comportement historique)
      // 100 = photo descendue de V_RANGE_MM (bas de la page utile)
      const yMm = ((clampPercent(e.offsetVerticalPercent ?? 50) - 50) / 50) * V_RANGE_MM;
      return `<div class="photo-frame" style="--extra-cell-max:${maxMm}mm; --photo-x-offset:${xPct}%; --photo-y-offset:${yMm}mm">${photoImg(ph, projet.nom, projet)}</div>`;
    }).join('');
    extraHtml = `<div class="man-extra-anchor"><div class="man-extra-grid" style="grid-template-columns:repeat(${extraPhotos.length},1fr);">${cells}</div></div>`;
  }

  // ── Mots-clés : position figée sous le statut (cf. headerHtml). ──
  // L'overlay flottant historique est désactivé : les mots-clés sont rendus
  // directement dans le bandeau d'en-tête, en couleur #30323E. La config
  // `keywords` reste lue côté UI (rétro-compat) mais ignorée au rendu.
  const keywordsHtml = '';

  // ── Liste flottante de certifications (même mécanique que les mots-clés) ──
  let certificationsHtml = '';
  const cert = cfg.certifications;
  if (cert?.show && projet.certifications && projet.certifications.length > 0) {
    const H_RANGE_MM = 200;
    const cxMm = ((clampPercent(cert.offsetPercent ?? 50) - 50) / 50) * H_RANGE_MM;
    const cyMm = ((clampPercent(cert.offsetVerticalPercent ?? 50) - 50) / 50) * V_RANGE_MM;
    const lineSpacingMm = Math.max(0, Math.min(20, cert.lineSpacing ?? 1));
    const cStyle = styleToCss(cert.style);
    const items = projet.certifications
      .map((m) => `<li style="margin-bottom:${lineSpacingMm}mm"><span class="man-cert-item"${cStyle ? ` style="${cStyle}"` : ''}>${m}</span></li>`)
      .join('');
    certificationsHtml = `<ul class="man-certifications" style="--photo-x-offset:${cxMm}mm; --photo-y-offset:${cyMm}mm">${items}</ul>`;
  }

  // L'espacement titre ↔ bandeau est désormais géré par `BandeauConfig.titleMetaGap`
  // (cf. shared.ts → metaGridHtml). Champ `bandeauVerticalOffset` obsolète.
  const bandeauWrapGap = bandeauPhotoGapCss(projet.bandeauConfig);
  const body = `<article class="page man-page">
    <div class="t-bandeau-wrap"${bandeauWrapGap ? ` style="${bandeauWrapGap}"` : ''}>
      ${headerHtml(projet)}
      ${titleBlockHtml(projet, '26pt', { showMissionAi: true })}
      ${metaGridHtml(projet, { hideMissionAi: true })}
    </div>
    ${photosHtml}
    ${textHtml}
    ${extraHtml}
    ${keywordsHtml}
    ${certificationsHtml}
    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
