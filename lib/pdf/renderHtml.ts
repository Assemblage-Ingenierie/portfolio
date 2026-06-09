import type { Projet } from '@/types/projet';
import { renderShell, TemplateBundle } from './templates/shared';
import { renderManuel } from './templates/manuel';
import { renderDev } from './templates/dev';
import type { ManualConfig } from './manualConfig';

export interface RenderOptions {
  manualConfig?: ManualConfig;
}

/**
 * Dispatcher : sélectionne le template selon `projet.template`.
 * Seuls deux templates subsistent : Str-Env (Manuel, défaut) et Dev.
 * Les anciennes valeurs Airtable Solo / Diptyque / Triptyque retombent
 * sur Str-Env.
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
  if (projet.template === 'Dev') {
    return renderDev(projet, manualConfig);
  }
  return renderManuel(projet, manualConfig);
}

export function renderPdfHtml(projet: Projet, options?: RenderOptions): string {
  const bundle = renderTemplate(projet, options);
  return renderShell(projet, bundle);
}
