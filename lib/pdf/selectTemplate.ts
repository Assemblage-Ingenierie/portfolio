import type { Projet, TemplateChoice } from '@/types/projet';

export function nbPhotos(projet: Pick<Projet, 'photoCouverture' | 'photosProjet'>): number {
  return (projet.photoCouverture ? 1 : 0) + (projet.photosProjet?.length ?? 0);
}

/**
 * Template par défaut quand aucune valeur n'est sauvegardée en Airtable.
 * Choisi en fonction du champ multi-select "Vignette pôle" :
 *   - contient DEV → "Dev"
 *   - sinon (STR, ENV, vide, mix sans DEV) → "Str-Env"
 * Le champ Airtable "Template" explicite reste prioritaire (cf. mapper).
 */
export function autoSelectTemplate(
  projet: Pick<Projet, 'photoCouverture' | 'photosProjet' | 'description' | 'vignettePoles' | 'pole'>
): TemplateChoice {
  const poles = (projet.vignettePoles && projet.vignettePoles.length > 0)
    ? projet.vignettePoles
    : projet.pole ? [projet.pole] : [];
  const codes = new Set(poles.map((p) => p.toUpperCase()));
  if (codes.has('DEV')) return 'Dev';
  return 'Str-Env';
}

const TEMPLATE_VALUES: TemplateChoice[] = ['Solo', 'Diptyque', 'Triptyque', 'Str-Env', 'Dev'];

export function isTemplateChoice(v: unknown): v is TemplateChoice {
  return typeof v === 'string' && (TEMPLATE_VALUES as string[]).includes(v);
}
