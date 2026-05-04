import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

const CSS = `
.solo-page {
  padding: 14mm 18mm 12mm 18mm;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto;
  gap: 5mm;
}
.solo-hero {
  width: 100%;
  height: 110mm;
}
.solo-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5mm;
}
`;

export function renderSolo(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet);
  const cover = photos[0];

  const body = `<article class="page solo-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '32pt')}

    ${cover ? `<div class="solo-hero photo-frame">${photoImg(cover, projet.nom)}</div>` : ''}

    ${metaGridHtml(projet)}

    <div class="solo-content">
      ${descriptionHtml(projet, 2)}
    </div>

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
