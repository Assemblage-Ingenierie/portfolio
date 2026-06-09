import type { Projet } from '@/types/projet';
import { renderMarkdown, injectSoftHyphensFr } from '@/lib/utils/markdown';
import { styleToCss, photoTextGapCss, bandeauPhotoGapCss } from '@/lib/pdf/bandeauConfig';
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
.dev-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}
.dev-page > header,
.dev-page > .t-title-block,
.dev-page > .t-meta-grid,
.dev-page > .dev-photos,
.dev-page > .dev-text,
.dev-page > .dev-extra-anchor,
.dev-page > .dev-presta,
.dev-page > footer {
  flex: 0 0 auto;
}

/* ── Photos haut de page ─────────────────────────────── */
/* Cadre photo principale : décalages X/Y identiques aux photos additionnelles.
   - X en % (relatif à la largeur du cadre)
   - Y en mm absolus (relatif à la page A4 — indépendant de la taille
     de la photo, pour que le slider couvre toute la hauteur utile)
   z-index élevé pour passer au premier plan si chevauchement avec le texte. */
.dev-photos { position: relative; z-index: 5; }
.dev-photos .photo-frame {
  position: relative;
  z-index: 10;
  transform: translate(
    var(--photo-x-offset, 0%),
    var(--photo-y-offset, 0mm)
  );
}

.dev-photos--paysage { width: 100%; }
.dev-photos--paysage .photo-frame { width: 100%; height: auto; }
.dev-photos--paysage .photo-img {
  width: 100%; height: auto;
  max-width: 100%; max-height: var(--main-photo-max, 110mm);
  object-fit: contain;
}

.dev-photos--portrait {
  display: grid;
  /* grid-template-columns set inline en fonction du nombre de photos */
  gap: 3mm;
  width: 100%;
}
.dev-photos--portrait .photo-frame { width: 100%; height: auto; }
.dev-photos--portrait .photo-img {
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
   wrapper .dev-text — permet à un style inline (bandeauConfig.description)
   appliqué sur ce wrapper d'être hérité par les <p>/<li>/<a> enfants. */
.dev-text {
  width: 100%;
  font-family: var(--sans);
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
}
.dev-text p {
  margin-bottom: 2.5mm;
  text-align: justify;
  hyphens: auto;
}
.dev-text strong { font-weight: 700; }
.dev-text em { font-style: italic; }
.dev-text u { text-decoration: underline; }
.dev-text a { color: var(--ai-rouge); text-decoration: underline; }
.dev-text ul, .dev-text ol { margin: 0 0 2.5mm; padding-left: 5mm; }
.dev-text li { margin-bottom: 0.8mm; }
.dev-text--2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
}
.dev-text--2col > .dev-col-1 {
  padding-right: 6mm;
  border-right: 1px solid var(--ai-gris);
}
.dev-text--2col > .dev-col-2 {
  padding-left: 6mm;
}

/* ── Photos additionnelles : grille N colonnes ───────
   FLOTTANTES — hors-flux : la grille est ancrée par un placeholder de
   hauteur 0 (.dev-extra-anchor) placé après le texte. Elle se superpose
   au contenu sans réserver d'espace vertical → ni le bloc "Prestation
   Assemblage", ni le footer ne sont décalés par la taille/position des
   photos additionnelles. Le neutre (offsetVerticalPercent = 50) reste
   ancré juste sous le texte (comportement historique). */
.dev-extra-anchor {
  position: relative;
  height: 0;
}
.dev-extra-grid {
  display: grid;
  gap: 3mm;
  /* Ancrée au placeholder (top du flux, juste après le texte). */
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 5;
}
.dev-extra-grid .photo-frame {
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
.dev-extra-grid .photo-img {
  width: 100%; height: auto;
  max-width: 100%;
  max-height: var(--extra-cell-max, 60mm);
  object-fit: contain;
}

/* ── Liste flottante de mots-clés ──────────────────────
   Position absolue ancrée à droite, haut de la zone utile (sous le bandeau).
   Sliders X/Y déplacent depuis cet ancrage. z-index très élevé : passe
   au-dessus de tout autre contenu (photos, texte, bandeau). */
.dev-keywords {
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
.dev-keywords > li {
  display: block;
  margin: 0;
  list-style: none;
}
/* Chaque "tag" : inline-block pour que le surlignage (background) reste
   collé au texte, ne s'étende pas sur toute la largeur du <li>. */
.dev-kw-item {
  display: inline-block;
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.4;
  color: var(--ai-noir);
  padding: 0.5mm 2mm;
}

/* ── Liste flottante de certifications ─────────────────
   Comportement identique à .dev-keywords ; ancre légèrement plus basse
   pour éviter le chevauchement par défaut. Sliders X/Y depuis cette ancre. */
.dev-certifications {
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
.dev-certifications > li {
  display: block;
  margin: 0;
  list-style: none;
}
.dev-cert-item {
  display: inline-block;
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.4;
  color: var(--ai-noir);
  padding: 0.5mm 2mm;
}

/* ── Bloc Prestation Assemblage ────────────────────────
   IN-FLOW (flex item de .dev-page) — apparaît systématiquement après le
   bloc texte / photos additionnelles, jamais de superposition avec la
   description, quelles que soient les métriques de wrap (fonts, hyphens,
   justification...). Les sliders X/Y restent fonctionnels via
   transform:translate qui déplace visuellement sans casser le flux. */
.dev-presta {
  width: 100%;
  flex: 0 0 auto;
  font-family: var(--sans);
  font-size: 9pt;
  line-height: 1.5;
  color: var(--ai-noir);
  transform: translate(
    var(--photo-x-offset, 0mm),
    var(--photo-y-offset, 0mm)
  );
}
.dev-presta .dev-presta-title {
  font-family: var(--sans);
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ai-rouge);
  margin: 0 0 1.5mm;
}
.dev-presta .dev-presta-body p { margin: 0 0 2mm; text-align: justify; hyphens: auto; }
.dev-presta .dev-presta-body strong { font-weight: 700; }
.dev-presta .dev-presta-body em { font-style: italic; }
.dev-presta .dev-presta-body u { text-decoration: underline; }
.dev-presta .dev-presta-body a { color: var(--ai-rouge); text-decoration: underline; }
.dev-presta .dev-presta-body ul, .dev-presta .dev-presta-body ol { margin: 0 0 2mm; padding-left: 5mm; }
.dev-presta--2col .dev-presta-body {
  column-count: 2;
  column-gap: 6mm;
  column-rule: 1px solid var(--ai-gris);
}
.dev-presta--2col .dev-presta-body p { break-inside: avoid; }
/* 2-colonnes piloté par sliders col1Percent / col2Percent : grille manuelle
   (chaque colonne occupe une demi-page, col 2 peut être vide si col2=0). */
.dev-presta--2col-split .dev-presta-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
}
.dev-presta--2col-split .dev-presta-col-1 {
  padding-right: 6mm;
}
.dev-presta--2col-split .dev-presta-col-2 {
  padding-left: 6mm;
}
.dev-presta--2col-split .dev-presta-body p { margin: 0 0 2mm; text-align: justify; hyphens: auto; }
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

export function renderDev(projet: Projet, configIn?: ManualConfig): TemplateBundle {
  const cfg: ManualConfig = configIn ?? DEFAULT_MANUAL_CONFIG;
  const photos = allPhotos(projet);

  // ── Photos principales ──
  // Conventions sliders 0..100, 50 = neutre. ±V_RANGE_MM couvre toute la
  // hauteur utile de la page A4.
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
    photosHtml = `<div class="dev-photos dev-photos--paysage" style="--main-photo-max:${main1MaxMm}mm">
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
      photosHtml = `<div class="dev-photos dev-photos--portrait" style="grid-template-columns:repeat(${cols},1fr)">${frames.join('')}</div>`;
    }
  }

  // ── Texte ──
  const description = (projet.description ?? '').trim();
  const col1Pct = clampPercent(cfg.textCol1Percent ?? 50);
  const col2Pct = clampPercent(cfg.textCol2Percent ?? 50);

  const descStyle = styleToCss(projet.bandeauConfig?.description);
  // Espacement photo principale ↔ description (slider BandeauConfig.photoTextGap).
  const photoTextGap = photoTextGapCss(projet.bandeauConfig);
  const mergedDescStyle = [descStyle, photoTextGap].filter(Boolean).join(';');
  const descAttr = mergedDescStyle ? ` style="${mergedDescStyle}"` : '';

  let textHtml = '';
  if (description.length > 0) {
    if (cfg.textColumns === 1) {
      // En 1-col, col1Percent contrôle la quantité de texte affiché.
      const target = (col1Pct / 100) * description.length;
      const cutoff = findSplitIndex(description, target);
      const ps = paragraphsToHtml(description.slice(0, cutoff).trim());
      textHtml = `<div class="dev-text dev-text--1col"${descAttr}>${ps}</div>`;
    } else {
      const [leftHtml, rightHtml] = splitDescription(description, col1Pct, col2Pct);
      textHtml = `<div class="dev-text dev-text--2col"${descAttr}>
        <div class="dev-col-1">${leftHtml}</div>
        <div class="dev-col-2">${rightHtml}</div>
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
    extraHtml = `<div class="dev-extra-anchor"><div class="dev-extra-grid" style="grid-template-columns:repeat(${extraPhotos.length},1fr);">${cells}</div></div>`;
  }

  // ── Mots-clés : position figée sous le statut (cf. headerHtml). ──
  // L'overlay flottant historique est désactivé : les mots-clés sont rendus
  // directement dans le bandeau d'en-tête, en couleur #30323E.
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
      .map((m) => `<li style="margin-bottom:${lineSpacingMm}mm"><span class="dev-cert-item"${cStyle ? ` style="${cStyle}"` : ''}>${m}</span></li>`)
      .join('');
    certificationsHtml = `<ul class="dev-certifications" style="--photo-x-offset:${cxMm}mm; --photo-y-offset:${cyMm}mm">${items}</ul>`;
  }

  // ── Bloc "Prestation Assemblage" (superposition optionnelle) ──
  // Affiche le titre + la valeur Markdown du champ Airtable
  // "Prestation Assemblage" (lu par field ID). Position absolue,
  // ancrée haut-gauche ; sliders X/Y déplacent en mm absolus.
  let prestaHtml = '';
  const presta = cfg.prestationAssemblage;
  const prestaText = (projet.prestationAssemblage ?? '').trim();
  // Default = activé sur Dev : `show` undefined → considéré comme `true`.
  // Pour masquer, l'utilisateur doit explicitement passer `show: false` via
  // le panneau de config (le toggle écrit show=false dans le payload).
  const prestaShow = presta?.show !== false;
  if (prestaShow && prestaText.length > 0) {
    const H_RANGE_MM = 200;
    const prXMm = ((clampPercent(presta?.offsetPercent ?? 50) - 50) / 50) * H_RANGE_MM;
    const prYMm = ((clampPercent(presta?.offsetVerticalPercent ?? 50) - 50) / 50) * V_RANGE_MM;
    // Style typo : BandeauConfig.prestationAssemblage (défaut design system)
    // surchargé par ManualConfig.prestationAssemblage.style (override fiche).
    const mergedPrestaStyle = { ...projet.bandeauConfig?.prestationAssemblage, ...presta?.style };
    const prStyle = styleToCss(mergedPrestaStyle);
    const styleAttr = `--photo-x-offset:${prXMm}mm; --photo-y-offset:${prYMm}mm${prStyle ? `;${prStyle}` : ''}`;

    if (presta?.columns === 2) {
      // Mode 2 colonnes piloté par sliders col1/col2 (par défaut 50/50).
      // col1=100 + col2=0 → tout le texte en col 1 (largeur = moitié de page,
      // col 2 vide). Même mécanique que la description (cf. splitDescription).
      const c1 = clampPercent(presta.col1Percent ?? 50);
      const c2 = clampPercent(presta.col2Percent ?? 50);
      const [leftHtml, rightHtml] = splitDescription(prestaText, c1, c2);
      prestaHtml = `<section class="dev-presta dev-presta--2col-split" style="${styleAttr}">
        <div class="dev-presta-title">Prestation Assemblage</div>
        <div class="dev-presta-body">
          <div class="dev-presta-col-1">${leftHtml}</div>
          <div class="dev-presta-col-2">${rightHtml}</div>
        </div>
      </section>`;
    } else {
      prestaHtml = `<section class="dev-presta" style="${styleAttr}">
        <div class="dev-presta-title">Prestation Assemblage</div>
        <div class="dev-presta-body">${renderMarkdown(prestaText)}</div>
      </section>`;
    }
  }

  // L'espacement titre ↔ bandeau est désormais géré par `BandeauConfig.titleMetaGap`
  // (cf. shared.ts → metaGridHtml). Champ `bandeauVerticalOffset` obsolète.
  const bandeauWrapGap = bandeauPhotoGapCss(projet.bandeauConfig);
  const body = `<article class="page dev-page">
    <div class="t-bandeau-wrap"${bandeauWrapGap ? ` style="${bandeauWrapGap}"` : ''}>
      ${headerHtml(projet, { isDev: true })}
      ${titleBlockHtml(projet, '26pt', { showMissionAi: true })}
      ${metaGridHtml(projet, { isDev: true, hideMissionAi: true })}
    </div>
    ${photosHtml}
    ${textHtml}
    ${extraHtml}
    ${keywordsHtml}
    ${certificationsHtml}
    ${prestaHtml}
    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
