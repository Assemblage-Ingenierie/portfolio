import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

/**
 * Mosaïque : 4 ou 5 photos.
 * - 4 photos : grille 2×2 (60mm × 60mm chaque cellule)
 * - 5 photos : 1 grande (haut, plein largeur, 60mm) + 4 petites (rangée du bas, 36mm)
 */
const CSS = `
.mos-page {
  padding: 14mm 18mm 12mm 18mm;
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto;
  gap: 5mm;
}
.mos-grid {
  display: grid;
  gap: 3mm;
}
.mos-grid--4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 60mm 60mm;
}
.mos-grid--5 {
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: 60mm 36mm;
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
    // 1 à 4 photos en grille 2×2 (cases vides si <4)
    gridHtml = `<div class="mos-grid mos-grid--4">
      ${[0, 1, 2, 3].map(i => photos[i]
        ? `<div class="photo-frame">${photoImg(photos[i], projet.nom)}</div>`
        : '<div></div>'
      ).join('')}
    </div>`;
  }

  const body = `<article class="page mos-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '28pt')}

    ${gridHtml}

    ${metaGridHtml(projet)}

    <div>${descriptionHtml(projet, 2)}</div>

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
