import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

/**
 * Mosaïque : 4 ou 5 photos. La grille de photos prend l'espace restant
 * après header/title/meta/description/footer (shrink-only via .photo-img).
 *
 * - 4 photos : 2×2
 * - 5 photos : 1 grande sur toute la largeur (rangée 1) + 4 petites (rangée 2)
 */
const CSS = `
.mos-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}

.mos-page > header,
.mos-page > .t-title-block,
.mos-page > .t-meta-grid,
.mos-page > .mos-text,
.mos-page > footer {
  flex: 0 0 auto;
}

.mos-grid {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  gap: 3mm;
}
.mos-grid--4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
}
.mos-grid--5 {
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 1.6fr 1fr;
}
.mos-grid--5 .mos-cell--hero { grid-column: 1 / -1; }
.mos-grid .photo-frame { width: 100%; height: 100%; }
`;

export function renderMosaique(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet).slice(0, 5);
  const n = photos.length;

  let gridHtml = '';
  if (n === 5) {
    gridHtml = `<div class="mos-grid mos-grid--5">
      <div class="photo-frame mos-cell--hero">${photoImg(photos[0], projet.nom)}</div>
      ${photos.slice(1).map(p => `<div class="photo-frame">${photoImg(p, projet.nom)}</div>`).join('')}
    </div>`;
  } else if (n >= 1) {
    gridHtml = `<div class="mos-grid mos-grid--4">
      ${[0, 1, 2, 3].map(i => photos[i]
        ? `<div class="photo-frame">${photoImg(photos[i], projet.nom)}</div>`
        : '<div></div>'
      ).join('')}
    </div>`;
  }

  const body = `<article class="page mos-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '24pt')}

    ${metaGridHtml(projet)}

    <div class="mos-text">${descriptionHtml(projet, 2)}</div>

    ${gridHtml}

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
