import type { Projet } from '@/types/projet';
import { renderShell, TemplateBundle } from './templates/shared';
import { renderSolo } from './templates/solo';
import { renderDiptyque } from './templates/diptyque';
import { renderTriptyque } from './templates/triptyque';
import { renderManuel } from './templates/manuel';
import { renderDev } from './templates/dev';
import type { ManualConfig } from './manualConfig';

export interface RenderOptions {
  manualConfig?: ManualConfig;
}

/**
 * Dispatcher : sélectionne le template selon `projet.template`.
 * Les templates supportés sont Solo, Diptyque, Triptyque (défaut) et Manuel.
 *
 * Pour Str-Env / Dev, si `options.manualConfig` n'est PAS fourni, on
 * retombe sur `projet.savedManualConfig` (mise en page persistée dans
 * Airtable via le bouton « Sauvegarder la mise en page »). Sans ça, la
 * composition portfolio rendrait toutes les fiches Str-Env/Dev avec
 * `DEFAULT_MANUAL_CONFIG` (= aperçu vide), au lieu du layout sauvegardé.
 * Les callers qui passent un config explicite (aperçu fiche live, page
 * /projet/[slug]/print avec config URL-encoded) gardent leur priorité.
 */
export function renderTemplate(projet: Projet, options?: RenderOptions): TemplateBundle {
  const manualConfig = options?.manualConfig ?? projet.savedManualConfig;
  switch (projet.template) {
    case 'Solo':
      return renderSolo(projet);
    case 'Diptyque':
      return renderDiptyque(projet);
    case 'Triptyque':
      return renderTriptyque(projet);
    case 'Str-Env':
      return renderManuel(projet, manualConfig);
    case 'Dev':
      return renderDev(projet, manualConfig);
    default:
      return renderTriptyque(projet);
  }
}

export function renderPdfHtml(projet: Projet, options?: RenderOptions): string {
  const bundle = renderTemplate(projet, options);
  return renderShell(projet, bundle);
}
