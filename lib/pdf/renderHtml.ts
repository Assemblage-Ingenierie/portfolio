import type { Projet } from '@/types/projet';
import { renderShell, TemplateBundle } from './templates/shared';
import { renderSolo } from './templates/solo';
import { renderDiptyque } from './templates/diptyque';
import { renderTriptyque } from './templates/triptyque';
import { renderManuel } from './templates/manuel';
import { renderReference } from './templates/reference';
import type { ManualConfig } from './manualConfig';

export interface RenderOptions {
  manualConfig?: ManualConfig;
}

/**
 * Dispatcher : sélectionne le template selon `projet.template`.
 * Les templates supportés sont Solo, Diptyque, Triptyque (défaut) et Manuel.
 */
export function renderTemplate(projet: Projet, options?: RenderOptions): TemplateBundle {
  switch (projet.template) {
    case 'Solo':
      return renderSolo(projet);
    case 'Diptyque':
      return renderDiptyque(projet);
    case 'Triptyque':
      return renderTriptyque(projet);
    case 'Manuel':
      return renderManuel(projet, options?.manualConfig);
    case 'Référence':
      return renderReference(projet);
    default:
      return renderTriptyque(projet);
  }
}

export function renderPdfHtml(projet: Projet, options?: RenderOptions): string {
  const bundle = renderTemplate(projet, options);
  return renderShell(projet, bundle);
}
