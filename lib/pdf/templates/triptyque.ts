import type { Projet } from '@/types/projet';
import {
  TemplateBundle, PhotoRef, esc,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml,
  photoImg, allPhotos,
} from './shared';

/**
 * Triptyque : layout adaptatif selon le ratio de la 1ʳᵉ photo.
 *
 * - Photo 1 PAYSAGE (h/w < 0.5) : photo seule pleine largeur en haut.
 * - Photo 1 PORTRAIT (h/w >= 0.5) : photos 1 et 2 côte à côte, 50/50.
 *
 * Dans les deux cas le texte est en 2 colonnes en dessous, et si la
 * description est courte, une 3ᵉ photo s'insère en bas de la 2ᵉ colonne.
 *
 * Toute la fiche tient sur 1 page A4 (footer compris) : `.tri-photos` est
 * shrinkable (flex: 0 1 auto) et `.tri-text` occupe le reste (flex: 1 1 0).
 */

/** Hypothèses dimensionnelles (en mm) pour estimer l'espace disponible.
 *  La page A4 fait 297 × 210, padding interne 14/12 + 18/18 → 271 × 174 utiles.
 *
 *  Éléments fixes en hauteur (header / titre / bandeau / footer + 5 gaps de 4mm) :
 *  ≈ 88 mm. Le reste (183 mm) est partagé entre la zone photos du haut et la
 *  zone texte 2 colonnes. La zone photos varie selon le layout :
 *
 *    - Paysage : 1 photo pleine largeur, hauteur = min(110, 174 × ratio_h/w)
 *    - Portrait : 2 photos côte à côte dans une grille 84mm × 80mm fixe
 *
 *  La hauteur de chaque colonne de texte = 271 - 88 - hauteur_photos_haut. */
const PAGE_INNER_HEIGHT_MM = 271;
const STATIC_HEIGHT_MM = 88;
const FULL_WIDTH_MM = 174;
const PORTRAIT_PHOTOS_HEIGHT_MM = 80;
const PAYSAGE_PHOTO_MAX_MM = 110;

/** Caractères par ligne et hauteur de ligne dans la zone texte (Open Sans 9.5pt, line-height 1.5). */
const CHARS_PER_LINE = 50;
const LINE_HEIGHT_MM = 5;
const PHOTO_MARGINS_MM = 9; // margin-top + safety
const MIN_PHOTO_HEIGHT_MM = 30;

/** Seuil de ratio h/w en dessous duquel on considère la photo 1 comme paysage. */
const PAYSAGE_RATIO_MAX = 0.5;

/**
 * Estime la hauteur disponible pour les colonnes de texte selon le layout
 * et la photo 1 (en mode paysage, sa hauteur dépend de son ratio intrinsèque).
 */
function computeColumnHeight(isPaysage: boolean, photo1?: PhotoRef): number {
  if (!isPaysage) {
    return PAGE_INNER_HEIGHT_MM - STATIC_HEIGHT_MM - PORTRAIT_PHOTOS_HEIGHT_MM;
  }
  // Paysage : hauteur photo = min(plafond, largeur × ratio_h/w naturel)
  const ratio = photo1?.height && photo1?.width
    ? photo1.height / photo1.width
    : 0.55; // ratio par défaut raisonnable si dimensions absentes
  const photoH = Math.min(PAYSAGE_PHOTO_MAX_MM, FULL_WIDTH_MM * ratio);
  return PAGE_INNER_HEIGHT_MM - STATIC_HEIGHT_MM - photoH;
}

/**
 * Estime l'espace restant en bas de la 2ᵉ colonne pour y insérer la 3ᵉ photo,
 * connaissant la longueur totale du texte et la hauteur d'une colonne.
 *
 * Retourne 0 si l'espace est insuffisant (< MIN_PHOTO_HEIGHT_MM) :
 * la photo ne sera alors pas rendue, plutôt que de déborder.
 */
function computeExtraPhotoMaxHeight(descriptionLength: number, colHeightMm: number): number {
  const colCharsFull = (colHeightMm / LINE_HEIGHT_MM) * CHARS_PER_LINE;
  const charsCol2 = Math.max(0, descriptionLength - colCharsFull);
  const textHeightCol2 = (charsCol2 / CHARS_PER_LINE) * LINE_HEIGHT_MM;
  const remaining = colHeightMm - textHeightCol2 - PHOTO_MARGINS_MM;
  return remaining >= MIN_PHOTO_HEIGHT_MM ? remaining : 0;
}

const CSS = `
.tri-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}
.tri-page > header,
.tri-page > .t-title-block,
.tri-page > .t-meta-grid,
.tri-page > footer {
  flex: 0 0 auto;
}

/* Zone photos du haut — peut shrinker pour faire tenir la fiche sur A4. */
.tri-photos {
  flex: 0 1 auto;
  width: 100%;
}
.tri-photos--single {
  /* Layout paysage : photo seule, hauteur naturelle limitée à 110mm. */
  height: auto;
  max-height: 110mm;
}
.tri-photos--single .photo-frame {
  width: 100%;
  height: 100%;
  max-height: 110mm;
}
.tri-photos--duo {
  /* Layout portrait : 2 photos côte à côte, 50/50, hauteur fixe alignée
     sur PORTRAIT_PHOTOS_HEIGHT_MM (80mm). */
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
  height: 80mm;
}
.tri-photos--duo .photo-frame {
  width: 100%;
  height: 100%;
}

/* Zone texte 2 colonnes — prend l'espace restant. */
.tri-text {
  flex: 1 1 0;
  min-height: 0;
  column-count: 2;
  column-gap: 6mm;
  column-rule: 1px solid var(--ai-gris);
  font-family: var(--sans);
}
.tri-text-p {
  break-inside: avoid;
  margin-bottom: 2.5mm;
  font-size: 9.5pt;
  line-height: 1.5;
  color: var(--ai-noir);
  text-align: justify;
  hyphens: auto;
}

/* 3ᵉ photo conditionnelle — forcée en colonne 2, en bas.
   Taille adaptative : la photo grandit jusqu'à atteindre la largeur de
   colonne (84 mm) OU la hauteur restante de la colonne (passée en var),
   selon la première limite atteinte. Ratio préservé via object-fit: contain. */
.tri-extra-photo {
  break-before: column;
  break-inside: avoid;
  margin-top: 4mm;
  width: 100%;
}
.tri-extra-photo .photo-frame {
  width: 100%;
  height: auto;
}
/* Override de la règle globale .photo-img (qui empêche l'agrandissement) :
   pour la photo conditionnelle, on autorise l'agrandissement jusqu'à la
   largeur de la colonne. La hauteur max est passée via une CSS var calculée
   par template selon le volume de texte déjà présent en col 2. */
.tri-extra-photo .photo-img {
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: var(--extra-photo-max, 70mm);
  object-fit: contain;
}
`;

export function renderTriptyque(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet);
  const [p1, p2, p3] = photos;

  // Décision layout : ratio h/w de la photo 1
  const ratio = p1?.height && p1?.width ? p1.height / p1.width : 1;
  const isPaysage = ratio < PAYSAGE_RATIO_MAX;

  // Bloc photos en haut
  let photosHtml = '';
  if (isPaysage && p1) {
    photosHtml = `<div class="tri-photos tri-photos--single">
      <div class="photo-frame">${photoImg(p1, projet.nom)}</div>
    </div>`;
  } else if (p1 || p2) {
    photosHtml = `<div class="tri-photos tri-photos--duo">
      ${p1 ? `<div class="photo-frame">${photoImg(p1, projet.nom)}</div>` : '<div></div>'}
      ${p2 ? `<div class="photo-frame">${photoImg(p2, projet.nom)}</div>` : '<div></div>'}
    </div>`;
  }

  // Bloc texte 2 colonnes
  const description = (projet.description ?? '').trim();
  const paragraphs = description.split(/\n\n+/).filter(Boolean);

  // Hauteur réelle des colonnes de texte = espace disponible après header,
  // titre, bandeau, footer et la zone photos du haut. La zone photos varie
  // selon le layout (paysage = dépend du ratio, portrait = fixe).
  const colHeight = computeColumnHeight(isPaysage, p1);

  // Calcul de l'espace disponible pour la 3ᵉ photo en bas de colonne 2,
  // en tenant compte du texte qui déborde déjà en col 2.
  // Si remainingHeight < MIN_PHOTO_HEIGHT_MM → 0 → pas de photo.
  const extraPhotoMaxHeight = computeExtraPhotoMaxHeight(description.length, colHeight);

  // 3ᵉ photo candidate : photo disponible selon le layout
  // - en mode paysage on prend p2 (p1 est déjà utilisée comme hero)
  // - en mode portrait on prend p3 (p1 et p2 sont déjà utilisées en duo)
  const extraPhotoCandidate = isPaysage ? p2 : p3;
  const extraPhoto = extraPhotoMaxHeight > 0 ? extraPhotoCandidate : undefined;

  const textHtml = paragraphs.length > 0 || extraPhoto
    ? `<div class="tri-text">
        ${paragraphs.map(p => `<p class="tri-text-p">${esc(p)}</p>`).join('')}
        ${extraPhoto ? `<div class="tri-extra-photo photo-frame" style="--extra-photo-max:${extraPhotoMaxHeight}mm">${photoImg(extraPhoto, projet.nom)}</div>` : ''}
      </div>`
    : '';

  const body = `<article class="page tri-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '26pt')}

    ${metaGridHtml(projet)}

    ${photosHtml}

    ${textHtml}

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
