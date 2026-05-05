import type { Projet, TemplateChoice } from '@/types/projet';

export function nbPhotos(projet: Pick<Projet, 'photoCouverture' | 'photosProjet'>): number {
  return (projet.photoCouverture ? 1 : 0) + (projet.photosProjet?.length ?? 0);
}

/**
 * Template par défaut quand aucune valeur n'est sauvegardée en Airtable.
 * Triptyque est le choix par défaut depuis la suppression de Mosaïque/Galerie.
 */
export function autoSelectTemplate(
  _projet: Pick<Projet, 'photoCouverture' | 'photosProjet' | 'description'>
): TemplateChoice {
  return 'Triptyque';
}

const TEMPLATE_VALUES: TemplateChoice[] = ['Solo', 'Diptyque', 'Triptyque', 'Manuel'];

export function isTemplateChoice(v: unknown): v is TemplateChoice {
  return typeof v === 'string' && (TEMPLATE_VALUES as string[]).includes(v);
}
