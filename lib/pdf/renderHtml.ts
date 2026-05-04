import type { Projet } from '@/types/projet';
import { renderShell, TemplateBundle } from './templates/shared';
import { renderSolo } from './templates/solo';
import { renderDiptyque } from './templates/diptyque';
import { renderMosaique } from './templates/mosaique';

/**
 * Dispatcher : sélectionne le template selon `projet.template`.
 * Triptyque et Galerie ne sont pas encore implémentés — ils retombent sur Mosaïque pour l'instant.
 */
function renderTemplate(projet: Projet): TemplateBundle {
  switch (projet.template) {
    case 'Solo':
      return renderSolo(projet);
    case 'Diptyque':
      return renderDiptyque(projet);
    case 'Mosaïque':
    case 'Triptyque': // TODO: template dédié
    case 'Galerie':   // TODO: template multi-pages dédié
      return renderMosaique(projet);
    default:
      return renderSolo(projet);
  }
}

export function renderPdfHtml(projet: Projet): string {
  const bundle = renderTemplate(projet);
  return renderShell(projet, bundle);
}
