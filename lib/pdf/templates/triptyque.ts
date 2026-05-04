import type { Projet } from '@/types/projet';
import {
  TemplateBundle, esc,
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

/** Seuil de longueur de description en dessous duquel on insère la 3ᵉ photo
 *  dans la 2ᵉ colonne (à ce volume, la 2ᵉ colonne est moins qu'à moitié remplie). */
const SHORT_TEXT_THRESHOLD = 1500;

/** Seuil de ratio h/w en dessous duquel on considère la photo comme paysage. */
const PAYSAGE_RATIO_MAX = 0.5;

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
  /* Layout portrait : 2 photos côte à côte, 50/50, hauteur ~90mm. */
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
  height: 90mm;
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
}

/* 3ᵉ photo conditionnelle — forcée en colonne 2, en bas. */
.tri-extra-photo {
  break-before: column;
  break-inside: avoid;
  margin-top: 4mm;
  height: 50mm;
  width: 100%;
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
  const isShortText = description.length < SHORT_TEXT_THRESHOLD;

  // 3ᵉ photo : si texte court ET il existe une photo disponible
  // - en mode paysage on prend p2 (p1 est déjà utilisée comme hero)
  // - en mode portrait on prend p3 (p1 et p2 sont déjà utilisées en duo)
  const extraPhoto = isShortText
    ? (isPaysage ? p2 : p3)
    : undefined;

  const textHtml = paragraphs.length > 0 || extraPhoto
    ? `<div class="tri-text">
        ${paragraphs.map(p => `<p class="tri-text-p">${esc(p)}</p>`).join('')}
        ${extraPhoto ? `<div class="tri-extra-photo photo-frame">${photoImg(extraPhoto, projet.nom)}</div>` : ''}
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
