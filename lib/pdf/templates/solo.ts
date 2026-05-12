import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

/**
 * Solo : 1 photo, texte en un seul paragraphe pleine largeur, photo après le texte.
 * La photo est dans une zone flex:1 — elle prend l'espace vertical restant.
 * Combinée à .photo-img { object-fit: contain; max-width/height:100%; width/height:auto },
 * la photo se réduit (shrink-only) pour que tout (texte + photo + footer) tienne sur A4.
 */
const CSS = `
/* .solo-page hérite de .page : 210mm × 297mm + box-sizing: border-box. */
.solo-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}

/* Toutes les sections au-dessus de la photo : taille naturelle, pas d'extension */
.solo-page > header,
.solo-page > .t-title-block,
.solo-page > .t-meta-grid,
.solo-page > .solo-text,
.solo-page > footer {
  flex: 0 0 auto;
}

.solo-text {
  /* Description plein largeur, paragraphe unique compact */
  font-family: var(--sans);
}

/* Photo : prend tout l'espace vertical restant, shrink-only via .photo-img */
.solo-hero {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
}
`;

export function renderSolo(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet);
  const cover = photos[0];

  const body = `<article class="page solo-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '28pt')}

    ${metaGridHtml(projet)}

    <div class="solo-text">
      ${descriptionHtml(projet, 1, true)}
    </div>

    ${cover ? `<div class="solo-hero photo-frame">${photoImg(cover, projet.nom, projet)}</div>` : ''}

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
