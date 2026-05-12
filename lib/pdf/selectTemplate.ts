import type { Projet, TemplateChoice } from '@/types/projet';

export function nbPhotos(projet: Pick<Projet, 'photoCouverture' | 'photosProjet'>): number {
  return (projet.photoCouverture ? 1 : 0) + (projet.photosProjet?.length ?? 0);
}

/**
 * Template par défaut quand aucune valeur n'est sauvegardée en Airtable.
 * Manuel depuis 2026-05 — toutes les fiches sont créées avec les sliders
 * Manuel et un set de défauts bandeau (titre 14pt, status/labels/values/
 * description 10pt, lignes masquées) sauvegardé dans `Config template manuel`.
 */
export function autoSelectTemplate(
  _projet: Pick<Projet, 'photoCouverture' | 'photosProjet' | 'description'>
): TemplateChoice {
  return 'Str-Env';
}

const TEMPLATE_VALUES: TemplateChoice[] = ['Solo', 'Diptyque', 'Triptyque', 'Str-Env', 'Dev'];

export function isTemplateChoice(v: unknown): v is TemplateChoice {
  return typeof v === 'string' && (TEMPLATE_VALUES as string[]).includes(v);
}
