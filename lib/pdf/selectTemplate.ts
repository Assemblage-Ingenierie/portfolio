import type { Projet, TemplateChoice } from '@/types/projet';

export function nbPhotos(projet: Pick<Projet, 'photoCouverture' | 'photosProjet'>): number {
  return (projet.photoCouverture ? 1 : 0) + (projet.photosProjet?.length ?? 0);
}

export function autoSelectTemplate(
  projet: Pick<Projet, 'photoCouverture' | 'photosProjet' | 'description'>
): TemplateChoice {
  const n = nbPhotos(projet);
  const len = projet.description?.length ?? 0;
  if (len > 2500) return 'Galerie';
  if (n >= 4) return 'Mosaïque';
  if (n === 3) return 'Triptyque';
  if (n === 2) return 'Diptyque';
  return 'Solo';
}

const TEMPLATE_VALUES: TemplateChoice[] = ['Solo', 'Diptyque', 'Triptyque', 'Mosaïque', 'Galerie'];

export function isTemplateChoice(v: unknown): v is TemplateChoice {
  return typeof v === 'string' && (TEMPLATE_VALUES as string[]).includes(v);
}
