import type { Projet } from '@/types/projet';
import {
  TemplateBundle,
  headerHtml, footerHtml, titleBlockHtml, metaGridHtml, descriptionHtml,
  photoImg, allPhotos,
} from './shared';

/**
 * Diptyque : 2 photos côte à côte. Photos prennent l'espace vertical restant
 * après header/title/meta/description/footer (shrink-only via .photo-img).
 */
const CSS = `
.dip-page {
  padding: 14mm 18mm 12mm 18mm;
  display: flex;
  flex-direction: column;
  gap: 4mm;
}

.dip-page > header,
.dip-page > .t-title-block,
.dip-page > .t-meta-grid,
.dip-page > .dip-text,
.dip-page > footer {
  flex: 0 0 auto;
}

.dip-photos {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3mm;
}
.dip-photos .photo-frame {
  width: 100%;
  height: 100%;
}
`;

export function renderDiptyque(projet: Projet): TemplateBundle {
  const photos = allPhotos(projet).slice(0, 2);
  const [p1, p2] = photos;

  const body = `<article class="page dip-page">
    ${headerHtml(projet)}

    ${titleBlockHtml(projet, '26pt')}

    ${metaGridHtml(projet)}

    <div class="dip-text">${descriptionHtml(projet, 2)}</div>

    ${(p1 || p2) ? `<div class="dip-photos">
      ${p1 ? `<div class="photo-frame">${photoImg(p1, projet.nom)}</div>` : '<div></div>'}
      ${p2 ? `<div class="photo-frame">${photoImg(p2, projet.nom)}</div>` : '<div></div>'}
    </div>` : ''}

    ${footerHtml(projet)}
  </article>`;

  return { body, css: CSS };
}
