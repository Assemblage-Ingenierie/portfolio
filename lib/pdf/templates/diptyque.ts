import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

const CSS = `
.dip-page {
  padding: 14mm 18mm 12mm 18mm;
  display: grid;
  grid-template-rows: auto auto auto auto 1fr auto;
  gap: 5mm;
}
.dip-photos {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
  height: 95mm;
}
.dip-photos .photo-frame { width: 100%; height: 100%; }
`;

export function renderDiptyque(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet).slice(0, 2);
  const [p1, p2] = photos;

  const body = `<article class="page dip-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '30pt')}

    ${(p1 || p2) ? `<div class="dip-photos">
      ${p1 ? `<div class="photo-frame">${photoImg(p1, projet.nom)}</div>` : '<div></div>'}
      ${p2 ? `<div class="photo-frame">${photoImg(p2, projet.nom)}</div>` : '<div></div>'}
    </div>` : ''}

    ${metaGridHtml(projet)}

    <div>${descriptionHtml(projet, 2)}</div>

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
